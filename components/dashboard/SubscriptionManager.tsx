"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge, Modal } from "@/components/dashboard/ui";
import { formatBRL, formatDate } from "@/lib/utils";

/** Versão dos Termos e compromisso exibidos nesta tela. */
const SITE_TERMS_VERSION = "1.0";

interface SubManagerProps {
  subscription: any;
  plans: any[];
  billingHistory: any[];
  payments: any[];
  activation?: any;
  activationPriceCents: number;
  activationRegularPriceCents?: number;
  monthlyPriceCents: number;
  allowCancel?: boolean;
  trialMonths?: number;
  billingEnabled?: boolean;
  /** Gateway ativo definido pelo Super Admin (/admin/pagamentos). */
  activeGateway?: "stripe" | "mercadopago";
  /** Site do usuário já está ativo (tenants.site_status === "active"). Reservado para regras de exibição. */
  siteActive?: boolean;
  /** Condições do Mercado Pago configuradas pelo Super Admin (/admin/pagamentos). */
  pixDiscountPercent?: number;
  installments?: number;
  installmentsWithoutInterest?: boolean;
}

export function SubscriptionManager({
  subscription,
  plans,
  billingHistory,
  payments,
  activation,
  activationPriceCents,
  activationRegularPriceCents,
  monthlyPriceCents,
  allowCancel = true,
  trialMonths = 3,
  billingEnabled = true,
  activeGateway = "stripe",
  siteActive = true,
  pixDiscountPercent = 0,
  installments = 0,
  installmentsWithoutInterest = true,
}: SubManagerProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const paymentOk = searchParams.get("sucesso") === "1";
  const resume = searchParams.get("resume") === "1";

  const activationPaid = activation?.status === "succeeded";

  const [checking, setChecking] = useState(false);
  /** Checkout iniciado em outra aba e ainda sem confirmação (localStorage). */
  const [checkoutPending, setCheckoutPending] = useState(false);
  /** Pagamento pendente detectado via API (registro no banco). */
  const [pendingActivationPayment, setPendingActivationPayment] = useState<boolean | null>(null);
  /** Abertura do painel de demonstração ("Ainda tem dúvidas?"). */
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    try {
      if (resume) {
        try {
          window.localStorage.removeItem("site_activation_checkout");
        } catch {}
        window.location.reload();
      } else if (!activationPaid && window.localStorage.getItem("site_activation_checkout") === "1") {
        setCheckoutPending(true);
      }
    } catch {
      // localStorage indisponível — segue sem o aviso de pendência.
    }
  }, [activationPaid, resume]);

  useEffect(() => {
    async function checkPendingPayment() {
      try {
        const res = await fetch("/api/subscription/status");
        const data = await res.json();
        if (data.pendingActivationPayment) {
          setPendingActivationPayment(true);
        }
      } catch {
        // Best-effort
      }
    }
    checkPendingPayment();
  }, []);

  const pixCents = pixDiscountPercent > 0
    ? Math.round((activationPriceCents * (100 - pixDiscountPercent)) / 100)
    : activationPriceCents;

  async function recordTermsAcceptance() {
    try {
      await fetch("/api/subscription/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: SITE_TERMS_VERSION }),
      });
    } catch {
      // Best-effort: o aceite local (checkbox) já foi dado; não bloqueia o pagamento.
    }
  }

  /** Ativação com aceite obrigatório dos Termos e compromisso. */
  async function handleActivate(planId: string) {
    if (!acceptedTerms) {
      setShowTerms(true);
      setMsg({ ok: false, text: "Para ativar seu site, leia e aceite os Termos e compromisso." });
      return;
    }
    await recordTermsAcceptance();
    checkout(planId);
  }

  async function checkout(planId: string) {
    setLoading(true);
    setMsg(null);
    // O servidor decide o gateway conforme /admin/pagamentos.
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, successPath: "/painel/meu-site?ativado=1" }),
    });
    const data = await res.json();
    if (data.url) {
      // Abre o pagamento em nova aba; ao concluir, o usuário volta para /painel/meu-site.
      try {
        window.localStorage.setItem("site_activation_checkout", "1");
      } catch {}
      setCheckoutPending(true);
      window.open(data.url, "_blank", "noopener");
      setLoading(false);
      setMsg({ ok: true, text: "Pagamento aberto em nova aba. Após concluir, você voltará para o Meu site com tudo ativado." });
    } else {
      setMsg({ ok: false, text: data.error || "Não foi possível iniciar o pagamento." });
      setLoading(false);
    }
  }

  /** Verifica se o pagamento já foi confirmado (para liberar a tela). */
  async function checkPayment() {
    setChecking(true);
    try {
      const res = await fetch("/api/subscription/status");
      const data = await res.json();
      if (data.activated || data.hasActivationPayment || data.pendingActivationPayment) {
        try {
          window.localStorage.removeItem("site_activation_checkout");
        } catch {}
        window.location.reload();
      } else {
        setMsg({ ok: false, text: "Pagamento ainda não confirmado. Conclua na aba de pagamento ou gere um novo link abaixo." });
      }
    } catch {
      setMsg({ ok: false, text: "Não foi possível verificar agora. Tente novamente em instantes." });
    } finally {
      setChecking(false);
    }
  }

  async function cancel() {
    setLoading(true);
    const res = await fetch("/api/cancel-subscription", { method: "POST" });
    const data = await res.json();
    setMsg(data.success
      ? { ok: true, text: "Cancelamento agendado. Sua assinatura continua até o fim do período contratado e seu site será suspenso depois. Seus dados estão preservados." }
      : { ok: false, text: data.error || "Erro ao cancelar." });
    setLoading(false);
    setConfirmCancel(false);
  }

  async function reactivate() {
    setLoading(true);
    const res = await fetch("/api/reactivate-subscription", { method: "POST" });
    const data = await res.json();
    setMsg(data.success
      ? { ok: true, text: "Assinatura reativada! Seu site voltou ao ar." }
      : { ok: false, text: data.error || "Erro ao reativar." });
    setLoading(false);
  }

  async function openBillingPortal() {
    setLoading(true);
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMsg({ ok: false, text: data.error || "Erro ao abrir portal de pagamento." });
    setLoading(false);
  }

  /** Leva ao painel de demonstração (mesmo fluxo do site público). */
  async function handleDemo() {
    if (demoLoading) return;
    setDemoLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/demo/start", { method: "POST" });
      if (res.ok) {
        window.location.href = "/painel";
        return;
      }
      setMsg({ ok: false, text: "Não foi possível abrir a demonstração agora. Tente novamente." });
    } catch {
      setMsg({ ok: false, text: "Não foi possível abrir a demonstração agora. Tente novamente." });
    } finally {
      setTimeout(() => setDemoLoading(false), 2000);
    }
  }

  const cancelScheduled = subscription?.cancel_at_period_end === true;
  const isActive = subscription?.status === "active" && !cancelScheduled;
  const isCanceled =
    subscription?.status === "canceled" ||
    subscription?.status === "paused" ||
    cancelScheduled;
  const nextBilling = subscription?.next_billing_at || subscription?.current_period_end;
  const statusLabel = cancelScheduled
    ? "Cancelamento agendado para o fim do período"
    : undefined;

  return (
    <div className="space-y-6">
      {paymentOk && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-700">
          Pagamento confirmado! Sua assinatura está sendo ativada. Pode levar alguns instantes para o site entrar no ar.
        </div>
      )}

      {/* Banner de ativação removido — a ativação vive na seção "Ações" abaixo. */}

      {/* O resumo "Minha Assinatura" foi movido para baixo de "Ações", logo acima do histórico. */}

      {msg && (
        <p className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}

      {/* Ações */}
      <div className="card" id="assinatura-acoes" style={{ scrollMarginTop: 90 }}>
        <h2 className="card-title mb-4">Ações</h2>
        <div className="flex flex-wrap gap-3">
          {isActive && billingEnabled && (
            <>
              {(subscription?.gateway ?? activeGateway) === "stripe" && (
                <button className="btn btn-outline" onClick={openBillingPortal} disabled={loading}>
                  💳 Atualizar forma de pagamento
                </button>
              )}
              {allowCancel && !confirmCancel && (
                <button className="btn btn-danger" onClick={() => setConfirmCancel(true)} disabled={loading}>
                  Cancelar assinatura
                </button>
              )}
              {allowCancel && confirmCancel && (
                <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-red-700">Cancelar mesmo? Seu site ficará suspenso no fim do período, mas seus dados são preservados.</span>
                  <button className="btn btn-danger !py-1.5" onClick={cancel} disabled={loading}>Sim, cancelar</button>
                  <button className="btn btn-outline !py-1.5" onClick={() => setConfirmCancel(false)}>Voltar</button>
                </div>
              )}
            </>
          )}

          {isCanceled && billingEnabled && (
            <button className="btn btn-gold" onClick={reactivate} disabled={loading}>
              {loading ? "Processando..." : "♻️ Reativar assinatura"}
            </button>
          )}

          {!subscription && billingEnabled && (
            <div className="w-full space-y-4">
              <div className="rounded-xl border border-[#e3d3a1] bg-[#fffdf5] p-4 sm:p-5">
                <div className="rounded-xl border-2 border-[#1d5c3a] bg-gradient-to-br from-[#f0faf3] to-[#fffdf5] p-4 text-center mb-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Oferta de lançamento</p>
                  {(activationRegularPriceCents || 150000) > (activationPriceCents || 29700) ? (
                    <p className="mt-1 text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      <span className="text-gray-400 line-through text-lg mr-2">De {formatBRL(activationRegularPriceCents || 150000)}</span>
                      por apenas <span className="text-[#1d5c3a]">{formatBRL(activationPriceCents || 29700)}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-2xl sm:text-3xl font-bold text-[#1d5c3a]" style={{ fontFamily: "var(--font-display)" }}>
                      {formatBRL(activationPriceCents || 29700)}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">pagamento único da ativação + {trialMonths} {trialMonths === 1 ? "mês" : "meses"} sem mensalidade</p>
                </div>
              <p className="font-semibold text-base sm:text-lg" style={{ fontFamily: "var(--font-display)" }}>
                ⚡ Ativar Site Profissional — {formatBRL(activationPriceCents)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatBRL(activationPriceCents)} é o valor único da <strong>ativação</strong> (não é mensalidade).
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                  {activeGateway === "mercadopago" && pixDiscountPercent > 0 && (
                    <li>💠 <strong>PIX:</strong> {pixDiscountPercent}% de desconto — sai por <strong>{formatBRL(pixCents)}</strong></li>
                  )}
                  {activeGateway === "mercadopago" && installments > 0 && (
                    <li>💳 <strong>Cartão:</strong> em até {installments}x{installmentsWithoutInterest ? " sem juros" : ""} de {formatBRL(Math.round(activationPriceCents / installments))}</li>
                  )}
                  <li>🎁 <strong>Primeiros {trialMonths} {trialMonths === 1 ? "mês" : "meses"}: sem cobrança da mensalidade</strong></li>
                  <li>🔁 <strong>Após os {trialMonths} {trialMonths === 1 ? "mês" : "meses"}:</strong> {formatBRL(monthlyPriceCents)}/mês</li>
                  <li>✅ <strong>Sem fidelidade — cancele quando quiser</strong></li>
                </ul>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="font-semibold text-sm">💡 Quanto custaria montar isso por conta própria?</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
                    <li>🧑‍💻 Site com freelancer: <strong>R$ 2.000–5.000</strong> (só o site, pagamento único)</li>
                    <li>👥 CRM separado: <strong>R$ 50–150/mês</strong></li>
                    <li>📅 Ferramenta de agendamento: <strong>R$ 30–80/mês</strong></li>
                  </ul>
                  <p className="mt-2 text-sm text-gray-700">
                    Aqui você leva <strong>tudo junto</strong> — site + CRM + agendamento + IA — por{" "}
                    <strong>{formatBRL(activationPriceCents || 29700)}</strong> na ativação e{" "}
                    <strong>{formatBRL(monthlyPriceCents)}/mês</strong> após os {trialMonths} {trialMonths === 1 ? "mês" : "meses"} iniciais.
                  </p>
                </div>
              <p className="w-full text-xs text-gray-400 mt-3">
                  Forma de pagamento:{" "}
                  {activeGateway === "mercadopago"
                    ? "🇧🇷 Mercado Pago (PIX ou cartão)"
                    : "💳 Stripe (cartão de crédito)"}{" "}
                  — definida pela plataforma.
                </p>
                <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-800">O que você terá ao ativar</p>
                  <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600">
                    <li>🌐 Site profissional personalizado</li>
                    <li>📱 Site responsivo para celular</li>
                    <li>🛍️ Divulgação de produtos e serviços</li>
                    <li>📣 Recursos de divulgação e marketing</li>
                    <li>👥 CRM para organização dos clientes</li>
                    <li>📊 Acompanhamento e gestão</li>
                    <li>🤖 Ferramentas de IA do painel</li>
                    <li>💬 Relacionamento e comunicação</li>
                    <li>🔗 Seu próprio endereço/site</li>
                    <li>⚙️ Painel completo de administração</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">Termos e compromisso</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Leia as condições de utilização, pagamento, responsabilidade pelo conteúdo e cancelamento.
                    </p>
                  </div>
                  <button type="button" className="btn btn-outline !py-2 !px-4 text-xs shrink-0" onClick={() => setShowTerms(true)}>
                    Ler termos
                  </button>
                </div>
                <label className="mt-3 flex items-start gap-2.5 cursor-pointer rounded-lg bg-white border border-gray-200 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#1d5c3a]"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">Li e concordo com os <strong>Termos e compromisso</strong>.</span>
                </label>
              </div>

              {checkoutPending && !activationPaid && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-sm text-amber-900">⏳ Pagamento pendente</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Você iniciou a ativação mas o pagamento ainda não foi concluído.
                    Finalize na aba de pagamento ou use as opções abaixo quando quiser.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button type="button" className="btn btn-outline !py-2.5 text-xs" onClick={() => window.location.href = `/painel/assinatura?resume=1`} disabled={checking}>
                      🔄 Retomar activation
                    </button>
                    <button type="button" className="btn btn-outline !py-2.5 text-xs" onClick={checkPayment} disabled={checking}>
                      🔄 Verificar pagamento
                    </button>
                    {pendingActivationPayment && (
                      <button type="button" className="btn btn-gold !py-2.5 text-xs" onClick={checkPayment} disabled={checking}>
                        Pagar Agora
                      </button>
                    )}
                  </div>
                </div>
              )}

              {plans.map((p) => (
                <button key={p.id} className="btn btn-gold !py-3 w-full sm:w-auto !text-base" onClick={() => handleActivate(p.id)} disabled={loading}>
                  {loading ? "Processando..." : "⚡ Ativar Site Profissional"}
                </button>
              ))}
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1d5c3a] text-xl text-white" role="img" aria-label="Garantia">🛡️</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Garantia incondicional de 7 dias</p>
                  <p className="text-sm text-emerald-900 mt-0.5">Se não gostar, devolvemos <strong>100%</strong> do valor. Sem perguntas, sem burocracia.</p>
                </div>
              </div>
            </div>
          )}

          {!billingEnabled && (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
              Sua conta está ativa sem mensalidade. Não há cobranças recorrentes vinculadas.
            </p>
          )}
        </div>
      </div>

      {/* Ainda tem dúvidas? — mostra por dentro o que está incluído */}
      <div className="card border-[#d5e8db] bg-gradient-to-br from-[#f0faf3] to-white">
        <h2 className="card-title mb-1">Ainda tem dúvidas? 🤔</h2>
        <p className="text-sm text-gray-600 mb-4">
          Acesse e veja por dentro <strong>tudo o que você poderá adquirir</strong>: explore o painel de
          demonstração com Central de IA, CRM, agendamento e todas as ferramentas — sem compromisso.
        </p>
        <button type="button" className="btn btn-primary !py-3 !px-6 text-sm" onClick={handleDemo} disabled={demoLoading}>
          {demoLoading ? "Preparando demonstração..." : "👀 Ver demonstração por dentro →"}
        </button>
      </div>

      {/* Minha Assinatura (resumo) — abaixo de Ações, acima do histórico */}
      <div>
        <h2 className="card-title mb-4">Minha Assinatura</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Ativação do site</p>
            <p className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {activationPaid ? "Pago" : "Pendente"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {activationRegularPriceCents ? (
                <><span className="line-through mr-1">{formatBRL(activationRegularPriceCents)}</span> {formatBRL(activationPriceCents)} — pagamento único</>
              ) : (
                `${formatBRL(activationPriceCents)} — pagamento único`
              )}
            </p>
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Plano</p>
            <p className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {subscription?.plan?.name || "Nenhum plano ativo"}
            </p>
            {monthlyPriceCents > 0 && <p className="text-sm text-gray-400 mt-1">{formatBRL(monthlyPriceCents)}/mês</p>}
            {subscription?.gateway === "mercadopago" && (
              <p className="text-xs text-gray-400 mt-1">Pagamento via Mercado Pago</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Status</p>
            <div className="mt-2"><StatusBadge status={subscription?.status || "awaiting_activation"} /></div>
            {statusLabel && <p className="text-xs text-gray-400 mt-2">{statusLabel}</p>}
            {!billingEnabled && (
              <p className="text-xs text-emerald-600 mt-2">Ativo sem mensalidade recorrente.</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Próxima cobrança</p>
            <p className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {nextBilling ? formatDate(nextBilling) : "—"}
            </p>
            {monthlyPriceCents > 0 && <p className="text-sm text-gray-400 mt-1">{formatBRL(monthlyPriceCents)}</p>}
            {!nextBilling && (
              <p className="text-xs text-gray-400 mt-1">
                {trialMonths > 0
                  ? `primeira cobrança após ${trialMonths} ${trialMonths === 1 ? "mês" : "meses"} da ativação`
                  : "primeira cobrança após a ativação"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Histórico de pagamentos */}
      <div className="card">
        <h2 className="card-title mb-4">Histórico de pagamentos</h2>
        {billingHistory.length === 0 && payments.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.created_at)}</td>
                    <td>{h.type === "activation" ? "Ativação" : "Mensalidade"}</td>
                    <td>{formatBRL(h.amount_cents)}</td>
                    <td><StatusBadge status={h.status} /></td>
                  </tr>
                ))}
                {payments.filter((p) => !billingHistory.some((b) =>
                  (b.stripe_charge_id && b.stripe_charge_id === p.stripe_payment_intent_id) ||
                  (b.mercadopago_payment_id && b.mercadopago_payment_id === p.mercadopago_payment_id)
                )).map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.created_at)}</td>
                    <td>{p.type === "activation" ? "Ativação" : p.type === "subscription" ? "Mensalidade" : p.type}</td>
                    <td>{formatBRL(p.amount_cents)}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Termos e compromisso */}
      {showTerms && (
        <Modal open onClose={() => setShowTerms(false)} title="Termos e compromisso de utilização do site profissional">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 text-sm text-gray-600">
            <section>
              <p className="font-semibold text-gray-800">1. Objeto</p>
              <p className="mt-1">
                A ativação disponibiliza ao usuário o acesso ao site profissional e às ferramentas
                da plataforma TopConsultores, conforme os recursos existentes e as condições
                apresentadas no momento da contratação.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">2. Responsabilidade pelo conteúdo</p>
              <p className="mt-1">
                O usuário é integralmente responsável pelos conteúdos que inserir, publicar ou
                disponibilizar em seu site — textos, imagens, vídeos, produtos, serviços, preços,
                informações comerciais, dados de contato e materiais enviados por ele. Declara possuir
                autorização para utilizar esses conteúdos e compromete-se a não usar o sistema para
                atividades ilícitas ou que violem direitos de terceiros.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">3. Responsabilidade do usuário</p>
              <p className="mt-1">
                O usuário deve utilizar a plataforma conforme a legislação aplicável e responde pelas
                informações que disponibilizar ao público. A plataforma fornece a estrutura e as
                ferramentas tecnológicas, sem assumir responsabilidade pelo conteúdo comercial,
                publicitário ou informativo inserido pelo próprio usuário.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">4. Ativação</p>
              <p className="mt-1">
                A ativação ocorre após a confirmação do pagamento da taxa de ativação e, quando
                aplicável, da contratação da mensalidade correspondente. Após a confirmação, o
                sistema pode disponibilizar automaticamente o site e os recursos contratados.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">5. Condições financeiras</p>
              <div className="mt-1 rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
                <p><strong>Ativação:</strong> {formatBRL(activationPriceCents)} (pagamento único)</p>
                {activeGateway === "mercadopago" && pixDiscountPercent > 0 && (
                  <p><strong>PIX:</strong> {pixDiscountPercent}% de desconto ({formatBRL(pixCents)})</p>
                )}
                {activeGateway === "mercadopago" && installments > 0 && (
                  <p><strong>Cartão:</strong> em até {installments}x{installmentsWithoutInterest ? " sem juros" : ""}</p>
                )}
                <p><strong>Primeiros {trialMonths} {trialMonths === 1 ? "mês" : "meses"}:</strong> sem cobrança da mensalidade</p>
                <p><strong>Após os {trialMonths} {trialMonths === 1 ? "mês" : "meses"}:</strong> {formatBRL(monthlyPriceCents)}/mês</p>
              </div>
              <p className="mt-1">
                Caso as condições comerciais sejam alteradas futuramente, as novas condições serão
                apresentadas antes de qualquer nova contratação ou renovação aplicável.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">6. Cancelamento</p>
              <p className="mt-1">
                O usuário pode solicitar o cancelamento da assinatura/mensalidade quando desejar,
                observadas as condições aplicáveis e eventuais valores já vencidos. Após o
                cancelamento, o acesso aos recursos que dependem de assinatura ativa pode ser
                interrompido conforme as regras da plataforma.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">7. Disponibilidade do serviço</p>
              <p className="mt-1">
                A plataforma busca manter seus serviços disponíveis, mas indisponibilidades
                temporárias podem ocorrer por manutenção, atualizações, falhas técnicas, serviços
                de terceiros ou eventos fora de seu controle direto.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">8. Uso adequado</p>
              <p className="mt-1">
                É proibido usar a plataforma para atividades ilegais, fraudulentas, que violem
                direitos de terceiros ou prejudiquem o serviço e outros usuários.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">9. Alterações</p>
              <p className="mt-1">
                A plataforma pode atualizar funcionalidades, recursos e condições de uso. Alterações
                relevantes nas condições comerciais ou contratuais serão comunicadas de forma
                adequada, observada a legislação aplicável.
              </p>
            </section>
            <section>
              <p className="font-semibold text-gray-800">10. Aceite</p>
              <p className="mt-1">Ao aceitar e prosseguir com a ativação, o usuário declara que:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                <li>leu e compreendeu estes termos;</li>
                <li>concorda com as regras de utilização;</li>
                <li>reconhece sua responsabilidade pelos conteúdos publicados;</li>
                <li>está ciente da taxa de ativação de {formatBRL(activationPriceCents)};</li>
                <li>está ciente da mensalidade de {formatBRL(monthlyPriceCents)} após o período promocional;</li>
                <li>está ciente de que pode cancelar quando desejar, conforme as condições aplicáveis.</li>
              </ul>
            </section>
            <p className="text-xs text-gray-500">Versão dos termos: {SITE_TERMS_VERSION}</p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                className="btn btn-primary flex-1 !py-3"
                onClick={() => { setAcceptedTerms(true); setShowTerms(false); }}
              >
                Li e concordo — ativar meu site
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowTerms(false)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
