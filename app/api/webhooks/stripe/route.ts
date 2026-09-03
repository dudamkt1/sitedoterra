import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeResolved } from "@/lib/stripe";
import { getStripeWebhookSecretResolved } from "@/lib/gateway-config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateCustomer,
  createRecurringSubscription,
  upsertSubscriptionFromStripe,
  activateTenant,
} from "@/lib/billing";
import { registerAffiliateConversionForVisitor } from "@/lib/affiliate";

export const runtime = "nodejs";

/**
 * Webhook do Stripe — FONTE PRINCIPAL de atualização do status financeiro.
 * O frontend nunca é a fonte de verdade para pagamentos.
 *
 * Idempotência: o event id é registrado em payment_events (unique).
 * Um webhook recebido 2x não duplica dados.
 */
export async function POST(request: Request) {
  const stripe = await getStripeResolved();
  const webhookSecret = await getStripeWebhookSecretResolved();
  const admin = createAdminClient();

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret não configurado" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || "", webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ---- Idempotência ----
  const { data: inserted, error: insertErr } = await admin
    .from("payment_events")
    .insert({
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      data: body ? JSON.parse(body) : {},
    })
    .select("processed_at")
    .maybeSingle();

  const processedAt = inserted?.processed_at || null;

  if (insertErr) {
    const isDup = String(insertErr.message).toLowerCase().includes("duplicate") ||
      String(insertErr.message).toLowerCase().includes("unique");
    if (isDup) {
      // Já processado — responder 200 sem duplicar.
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Falha ao registrar evento", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Falhou ao processar: remove a claim de idempotência para que a
    // próxima tentativa do Stripe reprocesse o evento de verdade.
    await admin.from("payment_events").delete().eq("stripe_event_id", event.id);
    console.error("Erro ao processar webhook", event.type, err);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function resolveTenantFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  const admin = createAdminClient();
  const meta =
    ((invoice as any).subscription_details?.metadata as Record<string, string> | undefined) ||
    invoice.metadata;
  if (meta?.tenant_id) return meta.tenant_id as string;

  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return null;
  const { data: sub } = await admin
    .from("subscriptions")
    .select("tenant_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  return sub?.tenant_id || null;
}

async function handleEvent(event: Stripe.Event) {
  const admin = createAdminClient();
  const stripe = await getStripeResolved();

  switch (event.type) {
    // ---------------- ATIVAÇÃO PAGA ----------------
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
      const planId = session.metadata?.plan_id;
      if (!tenantId) break;

      const { data: tenant } = await admin.from("tenants").select("*").eq("id", tenantId).single();
      const { data: profile } = await admin.from("profiles").select("*").eq("user_id", tenant.user_id).single();

      // Registra pagamento de ativação (R$ 297,00)
      await admin.from("payments").upsert(
        {
          tenant_id: tenantId,
          stripe_payment_intent_id: (session.payment_intent as string) || null,
          stripe_checkout_session_id: session.id,
          type: "activation",
          amount_cents: session.amount_total || 0,
          currency: (session.currency || "brl").toLowerCase(),
          status: "succeeded",
          paid_at: new Date().toISOString(),
          metadata: { plan_id: planId },
        },
        { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true }
      );

      // Cria assinatura mensal recorrente (R$ 47,00 — 1ª cobrança após os meses
      // definidos pelo Super Admin em /admin/planos, padrão 3 meses)
      const customerId =
        (typeof session.customer === "string" ? session.customer : session.customer?.id) || null;
      const customer = customerId
        ? ((await stripe.customers.retrieve(customerId)) as Stripe.Customer)
        : await getOrCreateCustomer({
            userId: tenant.user_id,
            tenantId: tenant.id,
            email: profile.email,
            name: profile.name,
          });

      // Evita assinaturas duplicadas: se já houver assinatura ativa para o tenant, não criar outra.
      const { data: existingActive } = await admin
        .from("subscriptions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();

      // Usuário isento de mensalidade (Super Admin ativou sem recorrência):
      // não cria assinatura mensal no Stripe.
      const { data: tenantRow } = await admin
        .from("tenants")
        .select("monthly_billing_enabled")
        .eq("id", tenantId)
        .maybeSingle();
      const billingEnabled = tenantRow?.monthly_billing_enabled !== false;

      if (!existingActive && billingEnabled) {
        const subscription = await createRecurringSubscription(customer.id, {
          userId: tenant.user_id,
          tenantId: tenant.id,
          email: profile.email,
          name: profile.name,
          planId: planId || null,
        });
        await upsertSubscriptionFromStripe(subscription);
      }

      await activateTenant(tenantId, tenant.user_id);

      // ---- Atribuição de afiliado ----
      // Se a sessão foi iniciada via cookie `tc_visitor_token` (link de afiliado),
      // o `metadata.visitor_token` chega aqui. A conversão é registrada para
      // associar a venda ao afiliado correto (first-click wins — função SQL).
      const visitorToken = (session.metadata?.visitor_token as string | undefined) || null;
      if (visitorToken && tenant.user_id) {
        try {
          await registerAffiliateConversionForVisitor({
            visitorToken,
            newCustomerUserId: tenant.user_id,
            saleAmountCents: session.amount_total || 0,
          });
        } catch (convErr) {
          console.error("[stripe webhook] falha ao registrar conversão de afiliado", convErr);
        }
      }
      break;
    }

    // ---------------- ASSINATURA ----------------
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const local = await upsertSubscriptionFromStripe(sub);
      if (!local) break;

      if (sub.status === "active") {
        await activateTenant(local.tenant_id, undefined);
      }
      if (sub.status === "past_due" || sub.status === "unpaid") {
        await admin
          .from("subscriptions")
          .update({ status: mapForDb(sub.status) })
          .eq("id", local.id);
      }
      if (sub.status === "canceled" || sub.status === "paused") {
        // Isento de mensalidade: não suspende o site por billing.
        const { data: tenantRow } = await admin
          .from("tenants")
          .select("monthly_billing_enabled")
          .eq("id", local.tenant_id)
          .maybeSingle();
        if (tenantRow?.monthly_billing_enabled === false) break;

        // Período terminou / cancelado → suspende o site (dados preservados)
        const tenantId = local.tenant_id;
        await admin.from("tenants").update({ site_status: "suspended", suspended_at: new Date().toISOString() }).eq("id", tenantId);
      }
      break;
    }

    // ---------------- INVOICES / COBRANÇAS ----------------
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await resolveTenantFromInvoice(invoice);
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;

      if (invoice.subscription) {
        const subObj =
          typeof invoice.subscription === "string"
            ? await stripe.subscriptions.retrieve(invoice.subscription)
            : invoice.subscription;
        if (subObj) await upsertSubscriptionFromStripe(subObj);
      }

      // Invoice R$ 0 gerada pela billing_cycle_anchor futura (1ª mensalidade
      // só após os meses configurados): sincroniza a assinatura, mas não registra pagamento.
      if ((invoice.amount_paid || 0) <= 0) break;

      if (tenantId) {
        await admin.from("billing_history").upsert(
          {
            tenant_id: tenantId,
            subscription_id: subId || null,
            stripe_invoice_id: invoice.id,
            stripe_charge_id: invoice.charge as string | null,
            type: invoice.billing_reason === "subscription_create" ? "activation" : "subscription",
            amount_cents: invoice.amount_paid || 0,
            currency: (invoice.currency || "brl").toLowerCase(),
            status: "succeeded",
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          },
          { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
        );

        await admin.from("payments").upsert(
          {
            tenant_id: tenantId,
            stripe_payment_intent_id: (invoice.payment_intent as string) || null,
            type: "subscription",
            amount_cents: invoice.amount_paid || 0,
            currency: (invoice.currency || "brl").toLowerCase(),
            status: "succeeded",
            paid_at: new Date().toISOString(),
          },
          { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true }
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await resolveTenantFromInvoice(invoice);
      if (tenantId) {
        const { data: tenantRow } = await admin
          .from("tenants")
          .select("monthly_billing_enabled")
          .eq("id", tenantId)
          .maybeSingle();
        if (tenantRow?.monthly_billing_enabled === false) break;

        const { data: sub } = await admin
          .from("subscriptions")
          .select("id")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub) {
          await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
          await admin.from("tenants").update({ site_status: "suspended", suspended_at: new Date().toISOString() }).eq("id", tenantId);
        }
      }
      break;
    }

    case "invoice.payment_action_required": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await resolveTenantFromInvoice(invoice);
      if (tenantId) {
        const { data: sub } = await admin
          .from("subscriptions")
          .select("id")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub) await admin.from("subscriptions").update({ status: "incomplete" }).eq("id", sub.id);
      }
      break;
    }

    default:
      break;
  }
}

function mapForDb(status: string): string {
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "canceled") return "canceled";
  return status;
}
