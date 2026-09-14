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
 * O usuário solicita o cancelamento dentro de 7 dias da ativação. O backend:
 *   1. valida a janela NO SERVIDOR (nunca confia no frontend);
 *   2. localiza o último pagamento de ativação APROVADO via Mercado Pago;
 *   3. emite o reembolso na API do MP;
 *   4. avisa o Super Admin (audit log + e-mail best-effort);
 *   5. o webhook (`refunded`) conclui sozinho: pagamento → reembolsado,
 *      site desativado, histórico preservado.
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

  let refundStatus = "requested";
  try {
    const refund = await refundMpPayment(pay.mercadopago_payment_id);
    refundStatus = String(refund?.status || "requested");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // Já reembolsado no MP: segue o fluxo (o sync/webhook reflete o estado).
    if (/already|refund/i.test(msg) && /refund/i.test(msg)) {
      refundStatus = "already_refunded";
    } else {
      console.error("[guarantee-cancel] falha no reembolso MP", e);
      return NextResponse.json(
        { error: "Não foi possível processar a devolução agora. Tente novamente ou fale com nosso suporte." },
        { status: 502 }
      );
    }
  }

  const amountBRL = ((pay.amount_cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // Auditoria (sempre) + e-mail ao Super Admin (best-effort via SMTP).
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
        subject: `Garantia 7 dias: devolução solicitada (${amountBRL})`,
        html: [
          `<p>O usuário <strong>${user.email}</strong> solicitou o cancelamento dentro da garantia de 7 dias.</p>`,
          `<ul>`,
          `<li>Valor: <strong>${amountBRL}</strong></li>`,
          `<li>Pagamento MP: <strong>${pay.mercadopago_payment_id}</strong></li>`,
          `<li>Tenant: <strong>${tenant.id}</strong></li>`,
          `<li>Status do reembolso no MP: <strong>${refundStatus}</strong></li>`,
          `</ul>`,
          `<p>O webhook atualizará o pagamento para reembolsado e desativará o site automaticamente, mantendo o histórico.</p>`,
        ].join(""),
      });
    }
  } catch (e) {
    console.error("[guarantee-cancel] falha ao avisar super admin", e);
  }

  return NextResponse.json({
    ok: true,
    refund_status: refundStatus,
    message:
      "Cancelamento recebido! A devolução foi solicitada no Mercado Pago. Assim que confirmada, o pagamento aparecerá como devolvido e o site será desativado — seus dados ficam preservados.",
  });
}
