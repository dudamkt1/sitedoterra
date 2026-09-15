import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundMpPayment } from "@/lib/mercadopago";
import { getSuperAdminEmails } from "@/lib/admin";
import { getEmailConfig, createTransportFromConfig, isEmailConfigured } from "@/lib/email";

export const runtime = "nodejs";

const GUARANTEE_DAYS = 7;

/**
 * POST /api/guarantee-cancel — Garantia de 7 dias ("Quero Cancelar").
 *
 * Fluxo em duas etapas (sincronizado painel <-> admin <-> MP):
 *   1. Na solicitação: pagamento de ativação vai IMEDIATAMENTE para
 *      `refund_pending` (STATUS "Aguardando reembolso" no painel) + pedido
 *      visível em /admin "Visão geral" (Pedidos de Reembolso) + e-mail ao
 *      Super Admin. O site segue no ar até o dinheiro voltar.
 *   2. Na confirmação do MP (webhook `refunded` ou sync): pagamento vai para
 *      `refunded` (STATUS "Reembolsado"), site DESATIVADO, histórico
 *      preservado.
 *
 * Nada de afiliados é alterado: o programa permanece ativo para o usuário.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Última ativação (qualquer estado final relevante) — idempotência: se já
  // está aguardando/devolvido, não duplica o pedido. Suporta o fallback via
  // metadata (caso a migration do enum ainda não tenha sido aplicada).
  const { data: latest } = await admin
    .from("payments")
    .select("id, status, metadata")
    .eq("tenant_id", tenant.id)
    .eq("type", "activation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRow = latest as { status?: string; metadata?: Record<string, unknown> } | null;
  const latestStatus = latestRow?.status;
  const latestPendingByMeta =
    Boolean(latestRow?.metadata?.refund_requested_at) &&
    !(latestRow?.metadata?.refunded_at);
  if (latestStatus === "refund_pending" || latestPendingByMeta) {
    return NextResponse.json({
      ok: true,
      status: "refund_pending",
      message:
        "Pedido de reembolso já registrado — status: aguardando reembolso. Assim que o Mercado Pago confirmar a devolução, o status muda para reembolsado.",
    });
  }
  if (latestStatus === "refunded") {
    return NextResponse.json({
      ok: true,
      status: "refunded",
      message: "Este pagamento já foi reembolsado.",
    });
  }

  const { data: payment } = await admin
    .from("payments")
    .select("id, amount_cents, created_at, paid_at, mercadopago_payment_id, metadata")
    .eq("tenant_id", tenant.id)
    .eq("type", "activation")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pay = payment as {
    id: string;
    amount_cents: number;
    created_at: string;
    paid_at: string | null;
    mercadopago_payment_id: string | null;
    metadata: Record<string, unknown> | null;
  } | null;

  if (!pay) {
    return NextResponse.json(
      { error: "Nenhum pagamento de ativação aprovado para cancelar." },
      { status: 400 }
    );
  }

  // Janela de 7 dias contada da aprovação (paid_at) ou da criação.
  const base = new Date(pay.paid_at || pay.created_at).getTime();
  const elapsedDays = (Date.now() - base) / 86_400_000;
  if (!Number.isFinite(base) || elapsedDays > GUARANTEE_DAYS) {
    return NextResponse.json(
      { error: "O prazo da garantia de 7 dias já terminou. Fale com nosso suporte." },
      { status: 400 }
    );
  }

  const gateway = String(pay.metadata?.gateway || "mercadopago").toLowerCase();
  if (gateway !== "mercadopago" || !pay.mercadopago_payment_id) {
    return NextResponse.json(
      { error: "Este pagamento não foi feito via Mercado Pago. Fale com nosso suporte para cancelar." },
      { status: 400 }
    );
  }

  // 1) Marca "aguardando reembolso" ANTES de chamar o MP — o status muda na
  // hora no painel e o pedido aparece no /admin, mesmo se a API do MP
  // estiver lenta ou fora do ar (o admin resolve manualmente).
  const requestedAt = new Date().toISOString();
  try {
    await admin
      .from("payments")
      .update({
        status: "refund_pending",
        metadata: {
          ...(pay.metadata || {}),
          refund_requested_at: requestedAt,
          refund_requested_by: user.id,
          refund_status: "requested",
        },
      })
      .eq("id", pay.id);
  } catch (e) {
    // Enum ainda sem o novo valor (migration pendente): registra via metadata
    // para não perder o pedido — o restante do fluxo lê os dois formatos.
    console.error("[guarantee-cancel] fallback sem enum refund_pending", e);
    try {
      await admin
        .from("payments")
        .update({
          metadata: {
            ...(pay.metadata || {}),
            refund_requested_at: requestedAt,
            refund_requested_by: user.id,
            refund_status: "requested",
          },
        })
        .eq("id", pay.id);
    } catch {}
  }
  try {
    await admin.from("billing_history").insert({
      tenant_id: tenant.id,
      plan_id: (pay.metadata?.plan_id as string | undefined) || null,
      mercadopago_payment_id: `${pay.mercadopago_payment_id}:refund_pending`,
      type: "activation",
      amount_cents: pay.amount_cents,
      currency: "brl",
      status: "refund_pending",
    });
  } catch {}

  // 2) Emite a devolução no Mercado Pago (best-effort: falhou, o pedido segue
  // pendente para o admin concluir; nunca esconde o pedido do usuário).
  let refundStatus = "requested";
  let mpError: string | null = null;
  try {
    const refund = await refundMpPayment(pay.mercadopago_payment_id);
    refundStatus = String(refund?.status || "requested");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/already|refund/i.test(msg) && /refund/i.test(msg)) {
      refundStatus = "already_refunded";
    } else {
      mpError = msg.slice(0, 300) || "falha na API do MP";
      console.error("[guarantee-cancel] reembolso MP falhou — pedido segue pendente", e);
    }
  }
  try {
    const { data: cur } = await admin
      .from("payments")
      .select("metadata")
      .eq("id", pay.id)
      .maybeSingle();
    await admin
      .from("payments")
      .update({
        metadata: {
          ...(((cur as { metadata?: Record<string, unknown> } | null)?.metadata) || {}),
          refund_status: refundStatus,
          ...(mpError ? { refund_error: mpError } : {}),
        },
      })
      .eq("id", pay.id);
  } catch {}

  const amountBRL = ((pay.amount_cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // 3) Auditoria (sempre) + e-mail ao Super Admin (best-effort via SMTP).
  // O /admin "Visão geral" lê os pedidos direto da tabela `payments`
  // (status refund_pending), então o aviso não depende do e-mail.
  try {
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: "user",
      action: "guarantee.cancel_requested",
      entity_type: "profile",
      entity_id: user.id,
      metadata: {
        tenant_id: tenant.id,
        payment_id: pay.id,
        mp_payment_id: pay.mercadopago_payment_id,
        amount_cents: pay.amount_cents,
        refund_status: refundStatus,
      },
    });
  } catch {}

  try {
    const recipients = getSuperAdminEmails();
    const cfg = await getEmailConfig();
    if (recipients.length > 0 && isEmailConfigured(cfg)) {
      const transporter = await createTransportFromConfig(cfg!);
      const fromName = cfg!.smtp_from_name || "TopConsultores";
      await transporter.sendMail({
        from: `"${fromName}" <${cfg!.smtp_from_email}>`,
        to: recipients.join(", "),
        subject: `Garantia 7 dias: reembolso aguardando (${amountBRL})`,
        html: [
          `<p>O usuário <strong>${user.email}</strong> solicitou o reembolso dentro da garantia de 7 dias.</p>`,
          `<ul>`,
          `<li>Valor: <strong>${amountBRL}</strong></li>`,
          `<li>Pagamento MP: <strong>${pay.mercadopago_payment_id}</strong></li>`,
          `<li>Tenant: <strong>${tenant.id}</strong></li>`,
          `<li>Status do reembolso no MP: <strong>${refundStatus}</strong></li>`,
          `</ul>`,
          `<p>Veja em <strong>/admin (Visão geral → Pedidos de Reembolso)</strong>. Quando o Mercado Pago confirmar a devolução, o pagamento vai para reembolsado e o site é desativado automaticamente, mantendo o histórico.</p>`,
        ].join(""),
      });
    }
  } catch (e) {
    console.error("[guarantee-cancel] falha ao avisar super admin", e);
  }

  return NextResponse.json({
    ok: true,
    status: "refund_pending",
    refund_status: refundStatus,
    message:
      mpError
        ? "Pedido de reembolso registrado — status: aguardando reembolso. A devolução automática falhou por instabilidade, mas o admin já foi avisado e concluirá a devolução."
        : "Pedido de reembolso registrado — status: aguardando reembolso. Assim que o Mercado Pago confirmar a devolução, o status muda para reembolsado e o site será desativado — seus dados ficam preservados.",
  });
}
