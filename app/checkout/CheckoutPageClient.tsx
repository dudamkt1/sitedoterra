"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

function friendlyError(raw: string): string {
  const m = (raw || "").toLowerCase();
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
  const cleaned = raw.replace(/Mercado Pago API[^\:]*:\s*/i, "").replace(/\(.*\)/, "").trim();
  if (cleaned.length > 160) return `${cleaned.slice(0, 157)}...`;
  return cleaned || "Não foi possível processar o pagamento. Tente novamente.";
}

export default function CheckoutPageClient({ planIdParam }: { planIdParam?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = planIdParam || searchParams.get("planId") || searchParams.get("plan") || undefined;

  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("identify");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [mpUrl, setMpUrl] = useState<string | null>(null);
  const [processingMsg, setProcessingMsg] = useState<string | null>(null);
  const [mpLoaded, setMpLoaded] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const checkoutGuardRef = useRef(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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

  const offer = gatewayInfo?.offer || loadIntent();
  const gateway = gatewayInfo?.gateway || "mercadopago";
  const activationCents = offer?.activation_price_cents ?? 29700;
  const monthlyCents = offer?.monthly_price_cents ?? 4700;
  const trialMonths = offer?.trial_months ?? 3;
  const planName = offer?.name || "Site Profissional";

  if (checkingAuth && step === "identify") {
    return (
      <div className="max-w-[520px] mx-auto w-full py-12 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#1d5c3a] animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-4">Carregando checkout...</p>
      </div>
    );
  }

  // IDENTIFY — page version
  if (step === "identify") {
    return (
      <div className="max-w-[520px] mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
            Vamos criar seu acesso
          </h1>
          <p className="text-[14px] leading-6 text-slate-500 mt-2">Crie sua conta em segundos para continuar. Depois você configura seu site no painel.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">Plano</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{planName}</p>
          </div>
          <p className="text-sm font-bold text-[#1d5c3a] shrink-0">{brl(activationCents)}</p>
        </div>

        {authMode === "signup" ? (
          <form onSubmit={handleSignup} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Crie sua conta</h3>
              <p className="text-sm text-slate-500 mt-1">Apenas 3 campos. O resto você completa no painel.</p>
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
            <button type="submit" disabled={authLoading} className="w-full rounded-full bg-[#1d5c3a] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition disabled:opacity-60">
              {authLoading ? "Criando..." : "Continuar para pagamento →"}
            </button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => setAuthMode("login")} className="font-medium text-slate-600 hover:text-slate-900">
                Já tenho conta → <span className="underline">Entrar</span>
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Entrar</h3>
              <p className="text-sm text-slate-500 mt-1">Voltaremos ao checkout do plano escolhido.</p>
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
            <button type="submit" disabled={authLoading} className="w-full rounded-full bg-[#1d5c3a] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition disabled:opacity-60">
              {authLoading ? "Entrando..." : "Entrar e continuar →"}
            </button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => setAuthMode("signup")} className="font-medium text-slate-600 hover:text-slate-900">
                Ainda não tem conta? <span className="underline">Criar conta</span>
              </button>
            </p>
          </form>
        )}
      </div>
    );
  }

  // CHECKOUT central — design premium
  if (step === "checkout") {
    return (
      <div className="w-full max-w-full">
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
            Ative seu site
          </h1>
          <p className="text-[14px] sm:text-[15px] leading-6 text-slate-500 mt-2 max-w-[520px] mx-auto">Comece seu site profissional. Pagamento seguro, ativação imediata após confirmação.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 lg:gap-7 items-start">
          {/* Esquerda: Resumo */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">Seu plano</p>
              <p className="text-[18px] font-semibold text-slate-900 mt-2">{planName}</p>
              <div className="mt-5 space-y-3">
                <div className="flex items-baseline justify-between gap-3 py-3 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Ativação</span>
                  <span className="text-[15px] font-semibold text-slate-900">{brl(activationCents)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-3">
                  <span className="text-sm text-slate-500">Mensalidade</span>
                  <span className="text-right">
                    <span className="text-[15px] font-semibold text-slate-900">{brl(monthlyCents)}/mês</span>
                    <span className="block text-xs text-slate-500 mt-0.5">após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#1d5c3a] px-6 py-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-white/70">Total hoje</p>
                <p className="text-[26px] font-bold text-white leading-none mt-1">{brl(activationCents)}</p>
              </div>
              <span className="hidden sm:inline-flex text-[11px] font-semibold tracking-wide uppercase text-white/80 border border-white/20 rounded-full px-3 py-1">pagamento único</span>
            </div>

            <p className="text-xs text-slate-400 leading-4 px-1">Sem taxas escondidas. Cancele quando quiser.</p>
            <p className="text-xs text-slate-400 px-1 lg:hidden">Logado como <b className="text-slate-600">{userEmail}</b> • <button type="button" onClick={() => setStep("identify")} className="underline">trocar</button></p>
          </div>

          {/* Direita: Pagamento */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold text-slate-900">Pagamento</h2>
                <span className="inline-flex items-center rounded-full bg-[#009ee3]/10 border border-[#009ee3]/15 px-3 py-1 text-xs font-semibold text-[#009ee3]">Mercado Pago</span>
              </div>
              <p className="text-sm text-slate-500 mt-1.5">Escolha sua forma de pagamento abaixo.</p>

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm">💳</span>
                <span className="text-sm text-slate-700">PIX e cartão — sem sair do site</span>
                <span className="ml-auto hidden sm:inline text-xs text-slate-400">100% seguro</span>
              </div>

              {checkoutError && <p className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{checkoutError}</p>}

              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="mt-6 w-full rounded-full bg-[#1d5c3a] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Processando pagamento...
                  </>
                ) : (
                  "Pagar e ativar meu site"
                )}
              </button>

              <div className="mt-5 flex gap-2.5 items-start rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3.5">
                <span className="text-emerald-700 text-sm leading-none mt-0.5">🔒</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-900">Pagamento seguro</p>
                  <p className="text-xs text-emerald-800/70 mt-0.5 leading-4">Seu pagamento é processado com segurança pelo Mercado Pago. Seus dados são protegidos.</p>
                </div>
              </div>

              <p className="hidden lg:block text-xs text-slate-400 text-center mt-4">Logado como <b className="text-slate-600">{userEmail}</b> • <button type="button" onClick={() => router.push("/")} className="underline hover:text-slate-600">voltar ao site</button></p>
            </div>

            <p className="text-xs text-slate-400 text-center leading-4 px-2">Ao continuar, você concorda com a contratação e ativação automática após a confirmação do pagamento.</p>
          </div>
        </div>
      </div>
    );
  }

  // PAYMENT
  if (step === "payment") {
    return (
      <div className="w-full max-w-[640px] mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-semibold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>Finalize seu pagamento</h1>
          <p className="text-sm text-slate-500 mt-1">Escolha PIX ou cartão no quadro abaixo. Você permanece no site.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">Total hoje</p>
            <p className="text-[18px] font-bold text-[#1d5c3a] leading-none mt-1">{brl(activationCents)}</p>
          </div>
          <p className="text-xs text-slate-500 text-right leading-4">{planName}<br />{brl(monthlyCents)}/mês após {trialMonths}m</p>
        </div>

        {gateway === "stripe" && stripeClientSecret ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Pagamento</h3>
              <span className="text-xs text-slate-400">Stripe • Seguro</span>
            </div>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-2 sm:p-3">
              <div id="stripe-embedded-checkout" className="min-h-[380px] w-full overflow-hidden rounded-lg bg-white" />
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">Você permanece no site durante todo o processo.</p>
          </div>
        ) : gateway === "mercadopago" && mpUrl ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Pagamento</h3>
                <p className="text-sm text-slate-500 mt-0.5">Escolha sua forma de pagamento abaixo.</p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full bg-[#009ee3]/10 border border-[#009ee3]/15 px-2.5 py-1 text-xs font-semibold text-[#009ee3]">Mercado Pago</span>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                {!mpLoaded && (
                  <div className="w-full h-[420px] sm:h-[500px] flex flex-col items-center justify-center gap-3 bg-white p-6 text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#1d5c3a] animate-spin" />
                    <p className="text-sm font-medium text-slate-600">Carregando pagamento seguro...</p>
                    <p className="text-xs text-slate-400">Mercado Pago • Não feche esta janela</p>
                  </div>
                )}
                <iframe
                  src={mpUrl}
                  title="Pagamento seguro — Mercado Pago"
                  className={`w-full border-0 block ${mpLoaded ? "h-[520px] sm:h-[560px]" : "h-0 overflow-hidden"}`}
                  allow="payment *; clipboard-write; clipboard-read"
                  loading="lazy"
                  onLoad={() => setMpLoaded(true)}
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center mt-3 leading-4 px-2">PIX copia e cola e cartão disponíveis no quadro acima. Após a confirmação, seu site será ativado automaticamente.</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStep("checkout")} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Voltar
              </button>
              <a href={mpUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 text-center hover:bg-slate-50 transition">
                Nova aba
              </a>
            </div>
            <button type="button" onClick={() => { setStep("processing"); startPolling(); }} className="mt-2 w-full rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-black transition">
              Já paguei, verificar ativação
            </button>

            <div className="mt-4 flex gap-2 items-start rounded-xl bg-emerald-50/60 border border-emerald-100 px-3.5 py-3">
              <span className="text-emerald-700 text-sm leading-none mt-0.5">🔒</span>
              <p className="text-xs text-emerald-800/70 leading-4"><b className="text-emerald-900">Pagamento seguro.</b> Processado pelo Mercado Pago. Seus dados de pagamento são protegidos.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin shrink-0" /> Preparando pagamento seguro...
          </div>
        )}

        {checkoutError && <p className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{checkoutError}</p>}
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-[#1d5c3a] animate-spin mx-auto" />
        <h3 className="text-[18px] font-semibold text-slate-900 mt-5">Estamos processando seu pagamento...</h3>
        <p className="text-sm text-slate-500 mt-2 leading-6">Não feche esta janela. Assim que o Mercado Pago confirmar, seu site será ativado automaticamente.</p>
        {processingMsg && <p className="text-sm text-emerald-700 mt-3 font-medium">{processingMsg}</p>}
        <button type="button" onClick={() => startPolling()} className="mt-6 w-full rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
          Verificar agora
        </button>
      </div>
    );
  }

  if (step === "pending") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-xl">⏳</div>
        <h3 className="text-[18px] font-semibold text-slate-900 mt-5">Pagamento pendente</h3>
        <p className="text-sm text-slate-500 mt-2 leading-6">Assim que o pagamento for confirmado, seu site será ativado automaticamente.</p>
        <div className="mt-6 flex flex-col gap-2 w-full">
          <button type="button" onClick={() => startPolling()} className="w-full rounded-full bg-[#1d5c3a] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#164a2e] transition">
            Verificar novamente
          </button>
          <button type="button" onClick={() => setStep("checkout")} className="w-full rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-xl">✕</div>
        <h3 className="text-[18px] font-semibold text-slate-900 mt-5">Não foi possível concluir o pagamento.</h3>
        <p className="text-sm text-slate-500 mt-2 leading-6">Verifique os dados ou escolha outra forma de pagamento.</p>
        {checkoutError && <p className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 text-left">{checkoutError}</p>}
        <div className="mt-6 flex flex-col gap-2 w-full">
          <button type="button" onClick={() => setStep("checkout")} className="w-full rounded-full bg-[#1d5c3a] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#164a2e] transition">
            Tentar novamente
          </button>
          <button type="button" onClick={() => router.push("/")} className="w-full rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            Voltar ao site
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-2xl">🎉</div>
        <h3 className="text-[20px] font-semibold text-slate-900 mt-5">Pagamento confirmado!</h3>
        <p className="text-sm text-slate-600 mt-2">Seu site foi ativado com sucesso.</p>
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left">
          <p className="text-sm font-semibold text-emerald-900">Site ativado com sucesso!</p>
          <p className="text-sm text-emerald-800/80 mt-1 leading-5">Você já pode acessar seu painel. A mensalidade de {brl(monthlyCents)}/mês só começará após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 w-full">
          <button type="button" onClick={() => (window.location.href = "/painel")} className="w-full rounded-full bg-[#1d5c3a] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(29,92,58,0.18)] hover:bg-[#164a2e] transition">
            Ir para meu painel
          </button>
          <p className="text-xs text-slate-400">Você também receberá a confirmação por e-mail.</p>
        </div>
      </div>
    );
  }

  return null;
}
