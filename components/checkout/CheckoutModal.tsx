"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadStripe } from "@stripe/stripe-js";

const INTENT_KEY = "checkout_intent_v1";

type GatewayInfo = {
  gateway: "stripe" | "mercadopago";
  stripe: { publishableKey: string | null };
  mercadopago?: { publicKey: string | null; hasPublicKey?: boolean; sandbox?: boolean };
  offer: { id: string; name: string; activation_price_cents: number; monthly_price_cents: number; trial_months: number; activation_regular_price_cents?: number } | null;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function saveIntent(offer: GatewayInfo["offer"]) {
  try {
    if (offer) localStorage.setItem(INTENT_KEY, JSON.stringify({ offer, ts: Date.now() }));
  } catch {}
}
function loadIntent(): GatewayInfo["offer"] | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j.offer || j || null;
  } catch {
    return null;
  }
}
function clearIntent() {
  try {
    localStorage.removeItem(INTENT_KEY);
  } catch {}
}

type Step = "identify" | "checkout" | "payment" | "processing" | "success" | "error" | "pending";

/** Mensagens amigáveis para erros do Mercado Pago / gerais — nunca expõe detalhes técnicos. */
function friendlyError(raw: string): string {
  const m = (raw || "").toLowerCase();
  // Erros técnicos / config → mensagem genérica
  if (
    m.includes("access token") ||
    m.includes("secret key") ||
    m.includes("não configurado") ||
    (m.includes("sem") && m.includes("configur")) ||
    m.includes("api key") ||
    m.includes("publishable")
  ) {
    return "Pagamento temporariamente indisponível. Tente novamente em instantes ou fale com nosso suporte.";
  }
  // Mapeamento de status_detail comuns do MP (card)
  if (m.includes("cc_rejected_bad_filled_card_number") || m.includes("invalid card number") || m.includes("invalid_card_token") || m.includes("bad_filled_card_number")) {
    return "Não foi possível processar este cartão. Verifique o número e tente novamente.";
  }
  if (m.includes("cc_rejected_bad_filled_date") || m.includes("invalid expiry") || m.includes("bad_filled_date")) {
    return "Data de validade inválida. Confira o vencimento do cartão.";
  }
  if (m.includes("cc_rejected_bad_filled_security_code") || m.includes("bad_filled_security_code") || m.includes("invalid cvv")) {
    return "Código de segurança (CVV) inválido. Verifique os 3 dígitos do verso do cartão.";
  }
  if (m.includes("cc_rejected_bad_filled_other") || m.includes("invalid_card_holder") || m.includes("bad_filled_other")) {
    return "Dados do cartão incompletos. Revise as informações e tente novamente.";
  }
  if (m.includes("cc_rejected_insufficient_amount") || m.includes("insufficient amount") || m.includes("insufficient funds") || m.includes("cc_rejected_insufficient")) {
    return "Pagamento recusado por saldo insuficiente. Tente outro cartão ou use o PIX.";
  }
  if (m.includes("cc_rejected_high_risk") || m.includes("high_risk")) {
    return "Pagamento recusado por segurança. Tente outro método de pagamento ou o PIX.";
  }
  if (m.includes("cc_rejected_call_for_authorize") || m.includes("call_for_authorize")) {
    return "Seu banco exige autorização. Entre em contato com a operadora do cartão ou tente outro método.";
  }
  if (m.includes("cc_rejected_card_disabled") || m.includes("card_disabled")) {
    return "Este cartão está desabilitado para compras online. Habilite-o no app do banco ou use outro cartão.";
  }
  if (m.includes("cc_rejected_duplicated_payment") || m.includes("duplicated_payment")) {
    return "Pagamento duplicado detectado. Aguarde a confirmação ou tente novamente em alguns minutos.";
  }
  if (m.includes("cc_rejected_max_attempts") || m.includes("max_attempts")) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return "A conexão demorou para responder. Verifique sua internet e tente novamente.";
  }
  if (m.includes("network") || m.includes("fetch failed")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  // Fallback: remove prefixos técnicos e limita tamanho
  const cleaned = raw.replace(/Mercado Pago API[^\:]*:\s*/i, "").replace(/\(.*\)/, "").trim();
  if (cleaned.length > 160) return `${cleaned.slice(0, 157)}...`;
  return cleaned || "Não foi possível processar o pagamento. Tente novamente.";
}

export function CheckoutModal({ open, onClose, planId }: { open: boolean; onClose: () => void; planId?: string }) {
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // identify
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  // checkout/payment
  const [step, setStep] = useState<Step>("identify");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [mpUrl, setMpUrl] = useState<string | null>(null);
  const [processingMsg, setProcessingMsg] = useState<string | null>(null);
  const [mpLoaded, setMpLoaded] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const checkoutGuardRef = useRef(false);

  // load gateway + auth + intent
  useEffect(() => {
    if (!open) return;
    setCheckingAuth(true);
    setCheckoutError(null);
    setAuthError(null);
    setAuthMsg(null);
    setStripeClientSecret(null);
    setMpUrl(null);
    setProcessingMsg(null);
    setMpLoaded(false);
    checkoutGuardRef.current = false;
    if (pollRef.current) clearInterval(pollRef.current);

    // gateway
    fetch("/api/gateway")
      .then((r) => r.json())
      .then((j) => {
        setGatewayInfo(j);
        if (j.offer) saveIntent(j.offer);
        else {
          const saved = loadIntent();
          if (saved) setGatewayInfo((prev) => (prev ? { ...prev, offer: saved } : { gateway: "stripe", stripe: { publishableKey: null }, offer: saved }));
        }
      })
      .catch(() => {
        const saved = loadIntent();
        if (saved) setGatewayInfo({ gateway: "stripe", stripe: { publishableKey: null }, offer: saved });
      });

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const authed = !!data.user;
      setIsAuthed(authed);
      setUserEmail(data.user?.email || null);
      setCheckingAuth(false);
      if (authed) setStep("checkout");
      else setStep("identify");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const authed = !!session?.user;
      setIsAuthed(authed);
      setUserEmail(session?.user?.email || null);
    });
    return () => sub.subscription.unsubscribe();
  }, [open]);

  // cleanup poll on close
  useEffect(() => {
    if (!open && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [open]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthMsg(null);
    if (!name.trim()) {
      setAuthError("Informe seu nome.");
      setAuthLoading(false);
      return;
    }
    if (password.length < 6) {
      setAuthError("A senha precisa ter pelo menos 6 caracteres.");
      setAuthLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
    if (error) {
      setAuthError(friendlyError(error.message));
      setAuthLoading(false);
      return;
    }
    if (data.session) {
      setIsAuthed(true);
      setUserEmail(data.user?.email || email.trim());
      setStep("checkout");
    } else {
      setAuthMsg("Conta criada! Verifique seu e-mail para confirmar e depois faça login. Seu plano continua salvo.");
    }
    setAuthLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setAuthError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : friendlyError(error.message));
      setAuthLoading(false);
      return;
    }
    setIsAuthed(true);
    setStep("checkout");
    setAuthLoading(false);
  }

  async function startCheckout() {
    if (checkoutLoading || checkoutGuardRef.current) return;
    checkoutGuardRef.current = true;
    setCheckoutLoading(true);
    setCheckoutError(null);
    setStripeClientSecret(null);
    setMpUrl(null);
    setMpLoaded(false);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, embedded: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setStep("identify");
          throw new Error("Faça login para continuar.");
        }
        throw new Error(friendlyError(json.error || "Não foi possível iniciar o pagamento. Tente novamente."));
      }
      if (json.gateway === "mercadopago" && json.url) {
        setMpUrl(json.url);
        setStep("payment");
        startPolling();
      } else if (json.gateway === "stripe" && json.clientSecret) {
        setStripeClientSecret(json.clientSecret);
        setStep("payment");
      } else if (json.url) {
        window.open(json.url, "_blank");
        setStep("processing");
        startPolling();
      }
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Erro ao iniciar pagamento.");
      setStep("error");
    } finally {
      setCheckoutLoading(false);
      // libera guard após 1.5s para evitar spam, mas ainda protege duplo clique imediato
      setTimeout(() => (checkoutGuardRef.current = false), 1500);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const r = await fetch("/api/subscription/status");
        const j = await r.json();
        if (j.activated && j.site_status === "active") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("success");
          clearIntent();
        } else if (attempts > 40) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("pending");
        } else if (j.subscription_status === "past_due" || j.subscription_status === "unpaid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setCheckoutError("Pagamento não aprovado. Tente outro cartão ou pague via PIX.");
          setStep("error");
        }
      } catch {}
    }, 3000);
  }

  // Stripe embedded mount — inicializado somente quando necessário
  useEffect(() => {
    if (!stripeClientSecret || !gatewayInfo?.stripe.publishableKey) return;
    let destroyed = false;
    (async () => {
      const stripe = await loadStripe(gatewayInfo.stripe.publishableKey!);
      if (!stripe || destroyed) return;
      const checkout = await (stripe as unknown as { initEmbeddedCheckout: (o: unknown) => Promise<{ mount: (s: string) => void }> }).initEmbeddedCheckout({
        fetchClientSecret: async () => stripeClientSecret,
        onComplete: () => {
          setProcessingMsg("Pagamento recebido! Confirmando com o banco...");
          setStep("processing");
          startPolling();
          setTimeout(() => {
            fetch("/api/subscription/status")
              .then((r) => r.json())
              .then((j) => {
                if (j.activated) {
                  setStep("success");
                  clearIntent();
                }
              });
          }, 2500);
        },
      } as unknown);
      if (!destroyed) {
        const el = document.getElementById("stripe-embedded-checkout");
        if (el) {
          el.innerHTML = "";
          checkout.mount("#stripe-embedded-checkout");
        }
      }
    })();
    return () => {
      destroyed = true;
    };
  }, [stripeClientSecret, gatewayInfo]);

  if (!open) return null;

  const offer = gatewayInfo?.offer || loadIntent();
  const gateway = gatewayInfo?.gateway || "mercadopago";
  const activationCents = offer?.activation_price_cents ?? 29700;
  const monthlyCents = offer?.monthly_price_cents ?? 4700;
  const trialMonths = offer?.trial_months ?? 3;
  const planName = offer?.name || "Site Profissional";

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-[#fcfaf7] sm:bg-black/45 sm:backdrop-blur-sm sm:p-4 sm:items-center sm:justify-center">
      <div className="relative w-full max-w-[640px] bg-white sm:rounded-[24px] sm:shadow-[0_24px_64px_rgba(0,0,0,0.16)] min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 sm:px-8 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
              {step === "identify" ? "Vamos criar seu acesso" : step === "success" ? "Tudo pronto!" : step === "processing" || step === "pending" ? "Quase lá" : "Ativar meu site"}
            </h2>
            <p className="text-[13px] leading-5 text-slate-500 mt-1">
              {step === "identify"
                ? "Crie sua conta em segundos para continuar. Depois você configura seu site no painel."
                : step === "success"
                  ? "Seu pagamento foi confirmado."
                  : step === "processing"
                    ? "Confirmando com o Mercado Pago..."
                    : "Seu site profissional está a poucos passos de ser ativado."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="shrink-0 w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 sm:px-8 py-6 space-y-6">
          {/* IDENTIFY */}
          {step === "identify" && (
            <>
              {checkingAuth ? (
                <p className="text-sm text-slate-400 py-8 text-center">Carregando...</p>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">Plano escolhido</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{planName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#1d5c3a]">{brl(activationCents)}</p>
                      <p className="text-xs text-slate-500">{brl(monthlyCents)}/mês após {trialMonths} meses</p>
                    </div>
                  </div>

                  {authMode === "signup" ? (
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">Crie sua conta para continuar</h3>
                        <p className="text-sm text-slate-500 mt-1">Apenas 3 campos. O restante você completa depois no painel.</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-slate-700">Nome</label>
                          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700">E-mail</label>
                          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700">Senha</label>
                          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]" />
                        </div>
                      </div>
                      {authError && <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{authError}</p>}
                      {authMsg && <p className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">{authMsg}</p>}
                      <button type="submit" disabled={authLoading} className="w-full rounded-full bg-[#1d5c3a] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition disabled:opacity-60 disabled:cursor-not-allowed">
                        {authLoading ? "Criando..." : "Continuar para pagamento →"}
                      </button>
                      <p className="text-center text-sm">
                        <button type="button" onClick={() => setAuthMode("login")} className="font-medium text-slate-600 hover:text-slate-900">
                          Já tenho uma conta → <span className="underline">Entrar</span>
                        </button>
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">Entrar</h3>
                        <p className="text-sm text-slate-500 mt-1">Acesse e voltaremos ao checkout do plano que você escolheu.</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-slate-700">E-mail</label>
                          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700">Senha</label>
                          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]" />
                        </div>
                      </div>
                      {authError && <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{authError}</p>}
                      {authMsg && <p className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">{authMsg}</p>}
                      <button type="submit" disabled={authLoading} className="w-full rounded-full bg-[#1d5c3a] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition disabled:opacity-60 disabled:cursor-not-allowed">
                        {authLoading ? "Entrando..." : "Entrar e continuar →"}
                      </button>
                      <p className="text-center text-sm">
                        <button type="button" onClick={() => setAuthMode("signup")} className="font-medium text-slate-600 hover:text-slate-900">
                          Ainda não tem conta? <span className="underline">Criar conta</span>
                        </button>
                      </p>
                    </form>
                  )}
                </>
              )}
            </>
          )}

          {/* CHECKOUT PROFISSIONAL — Resumo + Pagamento */}
          {step === "checkout" && (
            <>
              {/* Resumo do Plano */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">Resumo do plano</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ativação imediata
                  </span>
                </div>
                <p className="text-[17px] font-semibold text-slate-900 mt-2">{planName}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-xs font-medium tracking-wide uppercase text-slate-500">Valor da ativação</p>
                    <p className="text-[19px] font-bold text-slate-900 mt-1.5">{brl(activationCents)}</p>
                    <p className="text-xs text-slate-500 mt-1">pagamento único hoje</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-xs font-medium tracking-wide uppercase text-slate-500">Mensalidade</p>
                    <p className="text-[19px] font-bold text-slate-900 mt-1.5">
                      {brl(monthlyCents)}
                      <span className="text-sm font-medium text-slate-500">/mês</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-[#1d5c3a] px-4 py-3.5 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">Total de hoje</span>
                  <span className="text-[20px] font-bold text-white">{brl(activationCents)}</span>
                </div>
                <p className="text-xs text-slate-400 text-center mt-3">Sem taxas escondidas • Cancele quando quiser</p>
              </div>

              {/* Pagamento seguro */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 flex gap-3">
                <span className="w-9 h-9 rounded-full bg-white border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 text-[16px]">🔒</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">Pagamento seguro</p>
                  <p className="text-sm text-emerald-800/80 mt-1 leading-5">
                    Processado por <b>{gateway === "mercadopago" ? "Mercado Pago" : "Stripe"}</b> com criptografia de ponta a ponta. Você permanece no site durante todo o processo.
                  </p>
                </div>
              </div>

              {/* Card do pagamento — onde o Brick/iframe é renderizado */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Pagamento</h3>
                  {gateway === "mercadopago" && <span className="ml-auto inline-flex items-center rounded-full bg-[#009ee3]/10 border border-[#009ee3]/15 px-2.5 py-1 text-xs font-semibold text-[#009ee3]">Mercado Pago</span>}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {gateway === "mercadopago" ? "PIX e cartão — escolha na próxima etapa sem sair do site." : "Cartão salvo com segurança para a mensalidade futura."}
                </p>
                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Plano</span><span className="font-medium text-slate-900 text-right max-w-[60%] truncate">{planName}</span></div>
                  <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Ativação</span><span className="font-medium text-slate-900">{brl(activationCents)}</span></div>
                  <div className="flex justify-between py-2"><span className="text-slate-500">Mensalidade</span><span className="font-medium text-slate-900">{brl(monthlyCents)}/mês</span></div>
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100"><span className="font-semibold text-slate-900">Total de hoje</span><span className="font-bold text-[#1d5c3a] text-[20px]">{brl(activationCents)}</span></div>
                </div>
                {checkoutError && <p className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{checkoutError}</p>}
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={checkoutLoading}
                  className="mt-5 w-full rounded-full bg-[#1d5c3a] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Preparando pagamento...
                    </>
                  ) : (
                    "Pagar e ativar meu site →"
                  )}
                </button>
                <p className="text-xs text-slate-400 text-center mt-3">Após a confirmação do pagamento, seu site será ativado automaticamente.</p>
              </div>

              <p className="text-xs text-slate-400 text-center">Logado como <b className="text-slate-600">{userEmail}</b> • <button type="button" onClick={() => setStep("identify")} className="underline hover:text-slate-600">trocar conta</button></p>
            </>
          )}

          {/* PAYMENT RENDERING */}
          {step === "payment" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Pagamento</h3>
                  <span className="ml-auto text-xs font-medium text-slate-400">Total: <b className="text-[#1d5c3a] text-sm">{brl(activationCents)}</b></span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {gateway === "mercadopago" ? "Escolha PIX ou cartão. Tudo acontece aqui, sem sair do site." : "Preencha seu cartão com segurança. Ele ficará salvo para a mensalidade."}
                </p>
                {gateway === "mercadopago" && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#009ee3]/10 border border-[#009ee3]/15 px-3 py-1.5 text-xs font-semibold text-[#009ee3]">
                    <span className="w-2 h-2 rounded-full bg-[#009ee3] animate-pulse" /> Mercado Pago • Ambiente seguro
                  </div>
                )}
              </div>

              {gateway === "stripe" && stripeClientSecret ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-4 shadow-sm overflow-hidden">
                  <div id="stripe-embedded-checkout" className="min-h-[380px] w-full max-w-full overflow-hidden" />
                  <p className="text-xs text-slate-400 text-center mt-3 px-2">Pagamento criptografado • Você permanece no site durante todo o processo.</p>
                </div>
              ) : gateway === "mercadopago" && mpUrl ? (
                <div className="space-y-4 w-full max-w-full overflow-hidden">
                  {/* PIX helper */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg shrink-0">⚡</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Pague com PIX ou cartão</p>
                        <p className="text-sm text-slate-600 mt-1 leading-5">Escolha o método dentro do quadro abaixo. Para PIX, use o QR Code ou o código copia e cola. Após a confirmação, seu site será ativado automaticamente.</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 py-2.5">
                        <p className="text-xs font-semibold text-slate-700">PIX</p>
                        <p className="text-[11px] text-slate-500">aprovação em segundos</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 py-2.5">
                        <p className="text-xs font-semibold text-slate-700">Cartão</p>
                        <p className="text-[11px] text-slate-500">crédito / débito</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 py-2.5">
                        <p className="text-xs font-semibold text-slate-700">Seguro</p>
                        <p className="text-[11px] text-slate-500">criptografado</p>
                      </div>
                    </div>
                  </div>

                  {/* Iframe card — checkout transparente */}
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] w-full max-w-full">
                    {!mpLoaded && (
                      <div className="w-full h-[420px] sm:h-[560px] flex flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
                        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#1d5c3a] animate-spin" />
                        <p className="text-sm font-medium text-slate-600">Carregando pagamento seguro...</p>
                        <p className="text-xs text-slate-400">Mercado Pago • Não feche esta janela</p>
                      </div>
                    )}
                    <iframe
                      src={mpUrl}
                      title="Pagamento seguro — Mercado Pago"
                      className={`w-full border-0 block max-w-full ${mpLoaded ? "h-[560px] sm:h-[580px]" : "h-0 overflow-hidden"}`}
                      allow="payment *; clipboard-write; clipboard-read"
                      loading="lazy"
                      onLoad={() => setMpLoaded(true)}
                    />
                  </div>

                  <p className="text-xs text-slate-400 text-center px-2">Você permanece em <b className="text-slate-600">oleos.topconsultores.com.br</b> • Pagamento 100% seguro.</p>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep("checkout")} className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                      Voltar
                    </button>
                    <a href={mpUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-full bg-white border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 text-center hover:bg-slate-50 transition">
                      Abrir em nova aba
                    </a>
                  </div>
                  <button type="button" onClick={() => { setStep("processing"); startPolling(); }} className="w-full rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-black transition">
                    Já paguei, verificar ativação
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin shrink-0" /> Preparando pagamento seguro...
                </div>
              )}

              {checkoutError && <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{checkoutError}</p>}
            </>
          )}

          {step === "processing" && (
            <div className="text-center py-8 px-2">
              <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-[#1d5c3a] animate-spin mx-auto" />
              <h3 className="text-[18px] font-semibold text-slate-900 mt-5">Processando seu pagamento...</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-6">Não feche esta janela. Assim que o Mercado Pago confirmar, seu site será ativado automaticamente. Isso pode levar alguns segundos.</p>
              {processingMsg && <p className="text-sm text-emerald-700 mt-3 font-medium">{processingMsg}</p>}
              <div className="mt-6 flex flex-col gap-2 max-w-sm mx-auto w-full">
                <button type="button" onClick={() => startPolling()} className="w-full rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Verificar agora
                </button>
              </div>
            </div>
          )}

          {step === "pending" && (
            <div className="text-center py-8 px-2">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-xl">⏳</div>
              <h3 className="text-[18px] font-semibold text-slate-900 mt-5">Pagamento pendente</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-6">Assim que o Mercado Pago confirmar o pagamento, seu site será ativado automaticamente. Se pagou via PIX, a confirmação costuma ser em segundos.</p>
              <div className="mt-6 flex flex-col gap-2 max-w-sm mx-auto w-full">
                <button type="button" onClick={() => startPolling()} className="w-full rounded-full bg-[#1d5c3a] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#164a2e] transition">
                  Verificar novamente
                </button>
                <button type="button" onClick={() => { setCheckoutError(null); setStep("checkout"); }} className="w-full rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8 px-2">
              <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-xl">✕</div>
              <h3 className="text-[18px] font-semibold text-slate-900 mt-5">Não foi possível concluir o pagamento.</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-6">Sua conta e o plano escolhido continuam salvos. Você pode tentar novamente sem perder nada.</p>
              {checkoutError && <p className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 text-left max-w-sm mx-auto w-full">{checkoutError}</p>}
              <div className="mt-6 flex flex-col gap-2 max-w-sm mx-auto w-full">
                <button type="button" onClick={() => { setCheckoutError(null); setStep("checkout"); }} className="w-full rounded-full bg-[#1d5c3a] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#164a2e] transition">
                  Tentar novamente
                </button>
                <button type="button" onClick={onClose} className="w-full rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Fechar
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8 px-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-2xl">🎉</div>
              <h3 className="text-[20px] font-semibold text-slate-900 mt-5">Pagamento aprovado! 🎉</h3>
              <p className="text-sm text-slate-600 mt-2">Seu site está sendo ativado.</p>
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left max-w-sm mx-auto w-full">
                <p className="text-sm font-semibold text-emerald-900">Site ativado com sucesso!</p>
                <p className="text-sm text-emerald-800/80 mt-1 leading-5">Você já pode acessar seu painel. A mensalidade de {brl(monthlyCents)}/mês só começará após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}.</p>
              </div>
              <div className="mt-6 flex flex-col gap-2 max-w-sm mx-auto w-full">
                <button type="button" onClick={() => (window.location.href = "/painel")} className="w-full rounded-full bg-[#1d5c3a] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition">
                  Ir para meu painel →
                </button>
                <p className="text-xs text-slate-400">Você também receberá a confirmação por e-mail.</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 sm:px-8 py-4 bg-slate-50/60">
          <p className="text-xs text-slate-400 text-center leading-4">Pagamento seguro e criptografado • Seus dados ficam vinculados à sua conta • Ativação automática após confirmação</p>
        </div>
      </div>
    </div>
  );
}
