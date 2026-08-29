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
      <div className="max-w-[520px] mx-auto w-full py-16 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-[#e8efe8] border-t-[#103d2d] animate-spin mx-auto" />
        <p className="text-sm text-[#6b7a89] mt-4">Carregando checkout...</p>
      </div>
    );
  }

  // IDENTIFY — page version com estilo harmonizado ao checkout
  if (step === "identify") {
    return (
      <div className="max-w-[520px] mx-auto w-full">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-[28px] font-bold tracking-tight text-[#0f1a2a]">Vamos criar seu acesso</h1>
          <p className="text-[14px] leading-6 text-[#6b7a89] mt-2">Crie sua conta em segundos para continuar. Depois você configura seu site no painel.</p>
        </div>

        <div className="rounded-[16px] border border-[#eef2ee] bg-white px-4 py-3.5 flex items-center justify-between gap-3 mb-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#8a9aa8]">Plano</p>
            <p className="text-sm font-semibold text-[#0f1a2a] truncate">{planName}</p>
          </div>
          <p className="text-sm font-bold text-[#103d2d] shrink-0">{brl(activationCents)}</p>
        </div>

        {authMode === "signup" ? (
          <form onSubmit={handleSignup} className="rounded-[20px] border border-[#eef2ee] bg-white p-6 sm:p-7 space-y-4 shadow-[0_8px_28px_rgba(0,0,0,0.04)]">
            <div>
              <h3 className="text-[15px] font-semibold text-[#0f1a2a]">Crie sua conta</h3>
              <p className="text-sm text-[#6b7a89] mt-1">Apenas 3 campos. O resto você completa no painel.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-[#2d3a4a]">Nome</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" className="mt-1.5 w-full rounded-xl border border-[#dde6de] bg-white px-4 py-3.5 text-[15px] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/10 focus:border-[#103d2d]" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#2d3a4a]">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="mt-1.5 w-full rounded-xl border border-[#dde6de] bg-white px-4 py-3.5 text-[15px] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/10 focus:border-[#103d2d]" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#2d3a4a]">Senha</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="mt-1.5 w-full rounded-xl border border-[#dde6de] bg-white px-4 py-3.5 text-[15px] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/10 focus:border-[#103d2d]" />
              </div>
            </div>
            {authError && <p className="rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b]">{authError}</p>}
            {authMsg && <p className="rounded-xl bg-[#f0fdf4] border border-[#dcfce7] px-4 py-3 text-sm text-[#166534]">{authMsg}</p>}
            <button type="submit" disabled={authLoading} className="w-full rounded-xl bg-[#103d2d] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(16,61,45,0.18)] hover:bg-[#0e3326] transition disabled:opacity-60">
              {authLoading ? "Criando..." : "Continuar para pagamento →"}
            </button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => setAuthMode("login")} className="font-medium text-[#6b7a89] hover:text-[#0f1a2a]">
                Já tenho conta → <span className="underline">Entrar</span>
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="rounded-[20px] border border-[#eef2ee] bg-white p-6 sm:p-7 space-y-4 shadow-[0_8px_28px_rgba(0,0,0,0.04)]">
            <div>
              <h3 className="text-[15px] font-semibold text-[#0f1a2a]">Entrar</h3>
              <p className="text-sm text-[#6b7a89] mt-1">Voltaremos ao checkout do plano escolhido.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-[#2d3a4a]">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="mt-1.5 w-full rounded-xl border border-[#dde6de] bg-white px-4 py-3.5 text-[15px] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/10 focus:border-[#103d2d]" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#2d3a4a]">Senha</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 w-full rounded-xl border border-[#dde6de] bg-white px-4 py-3.5 text-[15px] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/10 focus:border-[#103d2d]" />
              </div>
            </div>
            {authError && <p className="rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b]">{authError}</p>}
            {authMsg && <p className="rounded-xl bg-[#f0fdf4] border border-[#dcfce7] px-4 py-3 text-sm text-[#166534]">{authMsg}</p>}
            <button type="submit" disabled={authLoading} className="w-full rounded-xl bg-[#103d2d] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(16,61,45,0.18)] hover:bg-[#0e3326] transition disabled:opacity-60">
              {authLoading ? "Entrando..." : "Entrar e continuar →"}
            </button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => setAuthMode("signup")} className="font-medium text-[#6b7a89] hover:text-[#0f1a2a]">
                Ainda não tem conta? <span className="underline">Criar conta</span>
              </button>
            </p>
          </form>
        )}
      </div>
    );
  }

  // CHECKOUT — idêntico a /checkout.png (centralizado, sem invadir NAV/rodapé)
  if (step === "checkout") {
    return (
      <div className="w-full flex flex-col items-center">
        {/* Título centralizado — exatamente como checkout.png */}
        <div className="text-center w-full max-w-[980px] mx-auto pt-1 sm:pt-2 pb-2 mb-8 sm:mb-10">
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-[#0f1a2a] leading-none">
            Ative seu site profissional
          </h1>
          <p className="text-[13.5px] sm:text-[14px] leading-6 text-[#6b7a89] mt-3 max-w-[560px] mx-auto">
            Pagamento seguro e ativação imediata após a confirmação.
          </p>
        </div>

        {/* Grid 2 colunas — exatamente checkout.png: 360px + flex */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 lg:gap-5 items-start w-full max-w-[980px] mx-auto">
          {/* ESQUERDA — Resumo do plano */}
          <div className="w-full">
            <div className="rounded-[16px] bg-white border border-[#e7ece8] shadow-[0_8px_24px_rgba(16,61,45,0.06)] overflow-hidden">
              <div className="p-6">
                <h2 className="text-[15px] font-bold text-[#0f1a2a] leading-none">Resumo do plano</h2>

                <div className="mt-6 flex gap-3.5">
                  <div className="w-[52px] h-[52px] rounded-[12px] bg-[#eef4ef] border border-[#e2ece8] flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="12" cy="12" r="9" stroke="#1a4d2e" strokeWidth="1.6" />
                      <ellipse cx="12" cy="12" rx="4.4" ry="9" stroke="#1a4d2e" strokeWidth="1.35" />
                      <path d="M3.2 12H20.8M12 3.2c1.7 2.15 2.65 4.85 2.65 8.8S13.7 18.65 12 20.8c-1.7-2.15-2.65-4.85-2.65-8.8S10.3 5.35 12 3.2Z" stroke="#1a4d2e" strokeWidth="1.25" strokeLinecap="round" />
                      <path d="M5 8.4H19M5 15.6H19" stroke="#1a4d2e" strokeWidth="1.15" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#8a9aa8] leading-none">Seu plano</p>
                    <p className="text-[15.5px] font-bold text-[#0f1a2a] mt-1.5 leading-none tracking-tight">Site Profissional</p>
                    <p className="text-[12.5px] leading-[18px] text-[#6b7a89] mt-2">Inclui domínio, hospedagem e suporte. Sem fidelidade.</p>
                  </div>
                </div>

                <div className="mt-6 border-t border-[#eef2ee]" />

                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[13px] text-[#475569] leading-none">Ativação (pagamento único)</p>
                    <p className="text-[13.5px] font-semibold text-[#0f1a2a] shrink-0 tracking-tight">{brl(activationCents)}</p>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[13px] text-[#475569] leading-none pt-0.5">Mensalidade</p>
                    <div className="text-right shrink-0">
                      <p className="text-[13.5px] font-semibold text-[#0f1a2a] leading-none tracking-tight">{brl(monthlyCents)}/mês</p>
                      <p className="text-[11px] text-[#6b7a89] mt-1 leading-none">após {trialMonths} meses</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 h-px bg-[#eef2ee]" />

                <div className="mt-5 rounded-[12px] bg-[#f2f7f3] border border-[#e6efe7] px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.13em] uppercase text-[#6b7a89] leading-none">Total hoje</p>
                    <p className="text-[22px] font-extrabold text-[#13402e] leading-none mt-1.5 tracking-tight">{brl(activationCents)}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-[#dff0e2] border border-[#cde7d1] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.07em] uppercase text-[#166534]">Pagamento único</span>
                </div>

                <div className="mt-4 rounded-[12px] bg-[#f8faf8] border border-[#edf2ed] px-3.5 py-3.5 flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-white border border-[#e2efe4] flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                  <div className="text-[12px] leading-[17px] text-[#475569]">
                    <p className="font-semibold text-[#334155] leading-none">Sem taxas escondidas.</p>
                    <p className="font-semibold text-[#334155] leading-none mt-1">Cancele quando quiser.</p>
                    <p className="text-[#64748b] mt-1">Ativação imediata após a confirmação.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DIREITA — Pagamento */}
          <div className="w-full min-w-0">
            <div className="rounded-[16px] bg-white border border-[#e7ece8] shadow-[0_8px_24px_rgba(16,61,45,0.06)] p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-[#0f1a2a] leading-none">Pagamento</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#e6ecef] px-3 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] shrink-0">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#009ee3] flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 4L-1 10.5V13.5L12 20L25 13.5V10.5Z" /></svg>
                  </span>
                  <span className="text-[11.5px] font-bold text-[#2d3a4a] tracking-tight">Mercado Pago</span>
                </span>
              </div>

              <p className="text-[12.5px] text-[#6b7a89] mt-2.5 leading-5">Escolha sua forma de pagamento abaixo.</p>

              {/* Selector — borda verde exata da referência */}
              <div className="mt-5 rounded-[12px] border-[1.5px] border-[#a7d0b4] bg-[#fbfdfb] px-3.5 py-3 flex items-center gap-3">
                <span className="w-[20px] h-[20px] rounded-full border-[5px] border-[#103d2d] bg-white flex items-center justify-center shrink-0" />
                <span className="w-8 h-8 rounded-[9px] bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#103d2d" strokeWidth="1.5"><rect x="2.5" y="5.5" width="19" height="13" rx="1.8" /><path d="M2.5 9.2H21.5" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-[#0f1a2a] leading-none">PIX e cartão — sem sair do site</p>
                  <p className="text-[11.5px] text-[#64748b] leading-none mt-1">Aprovação em segundos via PIX</p>
                </div>
                <span className="hidden sm:inline-flex items-center rounded-full bg-[#eaf6ec] border border-[#cfe8d2] px-2.5 py-1 text-[11px] font-bold text-[#1b6b2e] whitespace-nowrap tracking-tight">100% seguro</span>
              </div>

              {checkoutError && <p className="mt-4 rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b]">{checkoutError}</p>}

              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="mt-5 w-full rounded-[12px] bg-[#0f3d2d] hover:bg-[#0c3326] active:bg-[#0a2e22] px-6 py-[13px] text-center shadow-[0_6px_18px_rgba(15,61,45,0.2)] hover:shadow-[0_8px_22px_rgba(15,61,45,0.24)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span className="flex items-center justify-center gap-2 text-[14.5px] font-semibold text-white leading-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1.1" fill="white" stroke="none" /></svg>
                  {checkoutLoading ? "Processando pagamento..." : "Pagar e ativar meu site"}
                </span>
                <span className="block text-[11.5px] font-medium text-white/80 mt-1 leading-none">{checkoutLoading ? "Aguarde um instante" : `Pagamento único de ${brl(activationCents)} hoje`}</span>
              </button>

              <div className="mt-4 flex gap-3 items-start rounded-[12px] bg-[#f6faf7] border border-[#e8f0e8] px-4 py-3.5">
                <span className="w-8 h-8 rounded-full bg-white border border-[#dde8dc] flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3L17.9 6.2V12.1C17.9 15.45 15.5 18.3 12 19.4C8.5 18.3 6.1 15.45 6.1 12.1V6.2L12 3Z" stroke="#166534" strokeWidth="1.5" fill="none" />
                    <path d="M9.2 11.1L11 12.9L14.9 9.1" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#0f1a2a] leading-none">Pagamento seguro</p>
                  <p className="text-[12px] leading-[17px] text-[#64748b] mt-1">Seu pagamento é processado com segurança pelo Mercado Pago. Seus dados são protegidos com criptografia.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11.5px] leading-4 text-[#6b7a89]">
                <span>Logado como <b className="font-semibold text-[#334155]">{userEmail}</b></span>
                <span className="w-1 h-1 rounded-full bg-[#cbd5d1] mx-0.5" />
                <button type="button" onClick={() => router.push("/")} className="text-[#1a6b4a] hover:text-[#103d2d] hover:underline font-medium">voltar ao site</button>
                <span className="w-1 h-1 rounded-full bg-[#cbd5d1] mx-0.5" />
                <button type="button" onClick={() => setStep("identify")} className="text-[#1a6b4a] hover:text-[#103d2d] hover:underline font-medium">trocar conta</button>
              </div>

              <div className="mt-3.5 border-t border-[#eef2ee] pt-3.5">
                <p className="text-[11px] leading-[16px] text-[#6b7a89] text-center max-w-[520px] mx-auto">Ao continuar, você concorda com a contratação e ativação automática após a confirmação do pagamento. Suporte via WhatsApp após a compra.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefícios — barra única branca exatamente como checkout.png */}
        <div className="mt-5 w-full max-w-[980px] mx-auto rounded-[16px] bg-white border border-[#e7ece8] shadow-[0_4px_16px_rgba(0,0,0,0.04)] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#eef2ee] overflow-hidden">
          <div className="flex gap-3 items-center px-5 py-4">
            <span className="w-9 h-9 rounded-xl bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center text-[#103d2d] shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v13M12 16l-4-4M12 16l4-4" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="16" width="18" height="5" rx="1.4" /></svg>
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-[#0f1a2a] leading-none">Ativação imediata</p>
              <p className="text-[11px] text-[#64748b] mt-1 leading-none">Assim que o pagamento for confirmado</p>
            </div>
          </div>
          <div className="flex gap-3 items-center px-5 py-4">
            <span className="w-9 h-9 rounded-xl bg-[#f0f6fb] border border-[#e2e8f0] flex items-center justify-center text-[#1e3a5f] shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3L17.8 6V12.2C17.8 15.2 15.4 17.9 12 19.1C8.6 17.9 6.2 15.2 6.2 12.2V6L12 3Z" stroke="currentColor" strokeWidth="1.5" /><path d="M9 12L11 14L15 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-[#0f1a2a] leading-none">100% seguro</p>
              <p className="text-[11px] text-[#64748b] mt-1 leading-none">Seus dados sempre protegidos</p>
            </div>
          </div>
          <div className="flex gap-3 items-center px-5 py-4">
            <span className="w-9 h-9 rounded-xl bg-[#fdf8ec] border border-[#f3e8c7] flex items-center justify-center text-[#7a5a1a] shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-[#0f1a2a] leading-none">Sem fidelidade</p>
              <p className="text-[11px] text-[#64748b] mt-1 leading-none">Cancele quando quiser</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PAYMENT
  if (step === "payment") {
    return (
      <div className="w-full max-w-[680px] mx-auto">
        <div className="text-center mb-6 sm:mb-8 pt-2">
          <h1 className="text-[22px] sm:text-[26px] font-bold text-[#0f1a2a] leading-tight">Finalize seu pagamento</h1>
          <p className="text-sm text-[#6b7a89] mt-2 leading-5">Escolha PIX ou cartão no quadro abaixo. Você permanece no site.</p>
        </div>

        <div className="rounded-[16px] border border-[#eef2ee] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.11em] uppercase text-[#8a9aa8]">Total hoje</p>
            <p className="text-[18px] font-bold text-[#103d2d] leading-none mt-1.5">{brl(activationCents)}</p>
          </div>
          <p className="text-xs text-[#6b7a89] text-right leading-5">{planName}<br />{brl(monthlyCents)}/mês após {trialMonths}m</p>
        </div>

        {gateway === "stripe" && stripeClientSecret ? (
          <div className="rounded-[20px] border border-[#eef2ee] bg-white p-6 sm:p-7 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#0f1a2a] leading-5">Pagamento</h3>
              <span className="text-xs text-[#6b7a89]">Stripe • Seguro</span>
            </div>
            <p className="text-xs text-[#6b7a89] mt-1 leading-4">Preencha com segurança — seus dados são protegidos.</p>
            <div className="mt-5 rounded-xl border border-[#eef2ee] bg-[#f8faf8] p-3 sm:p-4">
              <div id="stripe-embedded-checkout" className="min-h-[380px] w-full overflow-hidden rounded-xl bg-white" />
            </div>
            <p className="text-xs text-[#6b7a89] text-center mt-4 leading-4">Você permanece no site durante todo o processo.</p>
          </div>
        ) : gateway === "mercadopago" && mpUrl ? (
          <div className="rounded-[20px] border border-[#eef2ee] bg-white p-6 sm:p-7 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#0f1a2a] leading-5">Pagamento</h3>
                <p className="text-sm text-[#6b7a89] mt-1 leading-5">Escolha sua forma de pagamento abaixo.</p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full bg-[#009ee3]/10 border border-[#009ee3]/15 px-3 py-1.5 text-xs font-semibold text-[#009ee3]">Mercado Pago</span>
            </div>

            <div className="mt-6 rounded-xl border border-[#e6ecef] bg-[#f8faf8] p-3 sm:p-4">
              <div className="rounded-xl overflow-hidden border border-[#e6ecef] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                {!mpLoaded && (
                  <div className="w-full h-[420px] sm:h-[500px] flex flex-col items-center justify-center gap-4 bg-white p-6 text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-[#e8efe8] border-t-[#103d2d] animate-spin" />
                    <p className="text-sm font-medium text-[#4a5a6a] leading-5">Carregando pagamento seguro...</p>
                    <p className="text-xs text-[#6b7a89] leading-4">Mercado Pago • Não feche esta janela</p>
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

            <p className="text-xs text-[#6b7a89] text-center mt-4 leading-5 px-2">PIX copia e cola e cartão disponíveis no quadro acima. Após a confirmação, seu site será ativado automaticamente.</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStep("checkout")} className="rounded-full border border-[#dde6de] bg-white px-4 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition leading-5">
                Voltar
              </button>
              <a href={mpUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white border border-[#dde6de] px-4 py-3.5 text-sm font-medium text-[#2d3a4a] text-center hover:bg-[#f6faf7] transition leading-5">
                Nova aba
              </a>
            </div>
            <button type="button" onClick={() => { setStep("processing"); startPolling(); }} className="mt-3 w-full rounded-full bg-[#0f1a2a] px-6 py-3.5 text-sm font-semibold text-white hover:bg-black transition leading-5">
              Já paguei, verificar ativação
            </button>

            <div className="mt-5 flex gap-3 items-start rounded-xl bg-[#f0fdf4]/60 border border-[#dcfce7] px-4 py-4">
              <span className="text-[#166534] text-sm leading-none mt-0.5">🔒</span>
              <p className="text-xs text-[#166534]/70 leading-5"><b className="text-[#14532d]">Pagamento seguro.</b> Processado pelo Mercado Pago. Seus dados de pagamento são protegidos.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-[16px] border border-[#fde7b8] bg-[#fffbeb] p-6 text-sm text-[#92400e] flex items-center gap-3 leading-5">
            <span className="w-8 h-8 rounded-full border-2 border-[#fde68a] border-t-[#d97706] animate-spin shrink-0" /> Preparando pagamento seguro...
          </div>
        )}

        {checkoutError && <p className="mt-4 rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b]">{checkoutError}</p>}
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-14 h-14 rounded-full border-4 border-[#e8efe8] border-t-[#103d2d] animate-spin mx-auto" />
        <h3 className="text-[18px] font-semibold text-[#0f1a2a] mt-5">Estamos processando seu pagamento...</h3>
        <p className="text-sm text-[#6b7a89] mt-2 leading-6">Não feche esta janela. Assim que o Mercado Pago confirmar, seu site será ativado automaticamente.</p>
        {processingMsg && <p className="text-sm text-[#166534] mt-3 font-medium">{processingMsg}</p>}
        <button type="button" onClick={() => startPolling()} className="mt-6 w-full rounded-full border border-[#dde6de] bg-white px-6 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition">
          Verificar agora
        </button>
      </div>
    );
  }

  if (step === "pending") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-14 h-14 rounded-full bg-[#fffbeb] border border-[#fde68a] flex items-center justify-center mx-auto text-xl">⏳</div>
        <h3 className="text-[18px] font-semibold text-[#0f1a2a] mt-5">Pagamento pendente</h3>
        <p className="text-sm text-[#6b7a89] mt-2 leading-6">Assim que o pagamento for confirmado, seu site será ativado automaticamente.</p>
        <div className="mt-6 flex flex-col gap-2 w-full">
          <button type="button" onClick={() => startPolling()} className="w-full rounded-full bg-[#103d2d] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#0e3326] transition">
            Verificar novamente
          </button>
          <button type="button" onClick={() => setStep("checkout")} className="w-full rounded-full border border-[#dde6de] bg-white px-6 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-14 h-14 rounded-full bg-[#fef2f2] border border-[#fecaca] flex items-center justify-center mx-auto text-xl">✕</div>
        <h3 className="text-[18px] font-semibold text-[#0f1a2a] mt-5">Não foi possível concluir o pagamento.</h3>
        <p className="text-sm text-[#6b7a89] mt-2 leading-6">Verifique os dados ou escolha outra forma de pagamento.</p>
        {checkoutError && <p className="mt-4 rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b] text-left">{checkoutError}</p>}
        <div className="mt-6 flex flex-col gap-2 w-full">
          <button type="button" onClick={() => setStep("checkout")} className="w-full rounded-full bg-[#103d2d] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#0e3326] transition">
            Tentar novamente
          </button>
          <button type="button" onClick={() => router.push("/")} className="w-full rounded-full border border-[#dde6de] bg-white px-6 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition">
            Voltar ao site
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="max-w-[520px] mx-auto w-full text-center py-12">
        <div className="w-16 h-16 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center mx-auto text-2xl">🎉</div>
        <h3 className="text-[20px] font-semibold text-[#0f1a2a] mt-5">Pagamento confirmado!</h3>
        <p className="text-sm text-[#4a5a6a] mt-2">Seu site foi ativado com sucesso.</p>
        <div className="mt-6 rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-left">
          <p className="text-sm font-semibold text-[#14532d]">Site ativado com sucesso!</p>
          <p className="text-sm text-[#166534]/80 mt-1 leading-5">Você já pode acessar seu painel. A mensalidade de {brl(monthlyCents)}/mês só começará após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 w-full">
          <button type="button" onClick={() => (window.location.href = "/painel")} className="w-full rounded-full bg-[#103d2d] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(16,61,45,0.18)] hover:bg-[#0e3326] transition">
            Ir para meu painel
          </button>
          <p className="text-xs text-[#6b7a89]">Você também receberá a confirmação por e-mail.</p>
        </div>
      </div>
    );
  }

  return null;
}
