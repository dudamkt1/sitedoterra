"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadStripe } from "@stripe/stripe-js";
import { MercadoPagoBrick, type PixData } from "@/components/checkout/MercadoPagoBrick";

const INTENT_KEY = "checkout_intent_v1";

type GatewayInfo = {
  gateway: "stripe" | "mercadopago";
  stripe: { publishableKey: string | null };
  mercadopago?: {
    publicKey: string | null;
    hasPublicKey?: boolean;
    sandbox?: boolean;
    pixDiscountPercent?: number;
    installments?: number;
    installmentsWithoutInterest?: boolean;
  };
  offer: { id: string; name: string; activation_price_cents: number; monthly_price_cents: number; trial_months: number; activation_regular_price_cents?: number } | null;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pixCentsFrom(activationCents: number, discountPercent: number): number {
  if (!discountPercent || discountPercent <= 0) return activationCents;
  return Math.round(activationCents * (100 - discountPercent) / 100);
}
function installmentText(activationCents: number, installments: number, withoutInterest: boolean): string | null {
  if (!installments || installments <= 0) return null;
  const per = Math.round(activationCents / installments);
  if (withoutInterest) return `${installments}x de ${brl(per)} sem juros`;
  return `${installments}x de ${brl(per)}`;
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

type Step = "identify" | "checkout" | "payment" | "pix" | "processing" | "success" | "error" | "pending";

export function friendlyError(raw: string): string {
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
  /** Método escolhido pelo cliente na tela de resumo ("pix" | "card"). */
  const [payMethod, setPayMethod] = useState<"pix" | "card" | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [mpUrl, setMpUrl] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  /** Brick indisponível/falhou → fallback sem iframe (link nova aba). */
  const [brickFailed, setBrickFailed] = useState(false);
  /** Dados do Pix (QR + copia e cola) após submit do Brick. */
  const [pix, setPix] = useState<PixData | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [processingMsg, setProcessingMsg] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const checkoutGuardRef = useRef(false);

  useEffect(() => {
    setCheckingAuth(true);
    setCheckoutError(null);
    setAuthError(null);
    setAuthMsg(null);
    setStripeClientSecret(null);
    setMpUrl(null);
    setPreferenceId(null);
    setBrickFailed(false);
    setPix(null);
    setCopiedPix(false);
    setProcessingMsg(null);
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

  async function startCheckout(method?: "pix" | "card") {
    if (checkoutLoading || checkoutGuardRef.current) return;
    checkoutGuardRef.current = true;
    setCheckoutLoading(true);
    setCheckoutError(null);
    setStripeClientSecret(null);
    setMpUrl(null);
    setPreferenceId(null);
    setBrickFailed(false);
    setPix(null);
    setCopiedPix(false);
    // Método efetivo para alinhar a preferência (fallback) e o Brick.
    const effectiveMethod = method ?? payMethod ?? (mpPixDiscount > 0 ? "pix" : "card");
    if (method) setPayMethod(method);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, embedded: true, payMethod: effectiveMethod }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setStep("identify");
          throw new Error("Faça login para continuar.");
        }
        throw new Error(friendlyError(json.error || "Não foi possível iniciar o pagamento. Tente novamente."));
      }
      if (json.gateway === "mercadopago" && (json.preferenceId || json.url)) {
        setMpUrl(json.url || null);
        setPreferenceId(json.preferenceId || null);
        setBrickFailed(false);
        setPix(null);
        setStep("payment");
        // O polling só começa após o submit no Brick (evita tela "pendente"
        // enquanto o usuário ainda preenche o cartão). No fallback (nova
        // aba), o polling começa ao abrir o link.
        if (!json.preferenceId || !gatewayInfo?.mercadopago?.publicKey) startPolling();
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

  /** Callbacks do Payment Brick (pagamento dentro do site). */
  function handleBrickApproved() {
    setProcessingMsg("Pagamento recebido! Confirmando com o banco...");
    setStep("processing");
    startPolling();
  }
  function handleBrickPix(data: PixData) {
    setPix(data);
    setCopiedPix(false);
    setStep("pix");
    startPolling();
  }
  function handleBrickPending() {
    setStep("pending");
    startPolling();
  }

  async function copyPixCode() {
    if (!pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      setCheckoutError("Não foi possível copiar. Selecione o código manualmente.");
    }
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
  const mpPixDiscount = Number(gatewayInfo?.mercadopago?.pixDiscountPercent || 0);
  const mpInstallments = Number(gatewayInfo?.mercadopago?.installments || 0);
  const mpInstallmentsWithoutInterest = gatewayInfo?.mercadopago?.installmentsWithoutInterest !== false;
  const pixCents = pixCentsFrom(activationCents, mpPixDiscount);
  const installmentLabel = installmentText(activationCents, mpInstallments, mpInstallmentsWithoutInterest);
  // Método efetivo: escolha do cliente; padrão = PIX quando há desconto, senão cartão.
  const selectedMethod: "pix" | "card" = payMethod ?? (mpPixDiscount > 0 ? "pix" : "card");
  const selectedTotalCents = selectedMethod === "pix" ? pixCents : activationCents;
  const cardPerInstallment = mpInstallments > 0 ? brl(Math.round(activationCents / mpInstallments)) : null;
  const gatewayLabel = gateway === "mercadopago" ? "Mercado Pago" : "Stripe";
  const mpPublicKey = gatewayInfo?.mercadopago?.publicKey || null;
  const brickAmount = Math.round(selectedTotalCents) / 100;
  const brickMaxInstallments = mpInstallments > 0 ? mpInstallments : 1;
  const canUseBrick = gateway === "mercadopago" && !!mpPublicKey && !brickFailed;
  const gatewaySecureText =
    gateway === "mercadopago"
      ? "Seu pagamento é processado com segurança pelo Mercado Pago. Seus dados são protegidos com criptografia."
      : "Seu pagamento é processado com segurança pelo Stripe. Seus dados são protegidos com criptografia.";

  if (checkingAuth && step === "identify") {
    return (
      <div className="max-w-[520px] mx-auto w-full px-6 py-16 sm:py-20 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-[#e8efe8] border-t-[#103d2d] animate-spin mx-auto" />
        <p className="text-sm text-[#6b7a89] mt-4 leading-relaxed">Carregando checkout...</p>
      </div>
    );
  }

  // IDENTIFY — Etapa 1 (Criar conta / Entrar) — premium, com plano no topo
  if (step === "identify") {
    return (
      <div className="w-full flex flex-col items-center px-2 sm:px-6">
        {/* Stepper discreto — Etapa 1 de 2 */}
        <div className="w-full max-w-[560px] mb-6 sm:mb-8 flex items-center justify-center gap-3">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[#103d2d]">
            <span className="w-6 h-6 rounded-full bg-[#103d2d] text-white flex items-center justify-center text-[11px] font-bold">1</span>
            Sua conta
          </span>
          <span className="h-px w-8 sm:w-12 bg-[#cfd8d2]" />
          <span className="flex items-center gap-2 text-[12px] font-medium text-[#8a9aa8]">
            <span className="w-6 h-6 rounded-full bg-white border border-[#cfd8d2] text-[#8a9aa8] flex items-center justify-center text-[11px] font-bold">2</span>
            Pagamento
          </span>
        </div>

        {/* Plano selecionado — card topo, mesma identidade visual da Etapa 2 */}
        <div className="w-full max-w-[560px] mb-6 sm:mb-8 px-1 sm:px-0">
          <div className="rounded-[20px] bg-white/90 backdrop-blur border border-[#e7ece8] shadow-[0_12px_32px_rgba(16,61,45,0.08)] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-4">
              <span className="w-11 h-11 rounded-[12px] bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#103d2d" strokeWidth="1.6">
                  <rect x="3.2" y="4.5" width="17.6" height="15" rx="2.2" />
                  <path d="M3.2 9.2H20.8" />
                  <circle cx="8.4" cy="14.2" r="1.1" fill="#103d2d" stroke="none" />
                  <path d="M12.4 14.2H17.6" strokeLinecap="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-[0.13em] uppercase text-[#8a9aa8] leading-4">Plano</p>
                <p className="text-[15px] font-bold text-[#0f1a2a] mt-0.5 leading-6 tracking-tight truncate">{planName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold tracking-[0.13em] uppercase text-[#8a9aa8] leading-4">Total hoje</p>
                <p className="text-[16px] font-extrabold text-[#103d2d] mt-0.5 leading-6 tracking-tight">{brl(activationCents)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[560px] px-1 sm:px-0">
          {authMode === "signup" ? (
            <form onSubmit={handleSignup} className="rounded-[24px] border border-[#e7ece8] bg-white/95 backdrop-blur p-6 sm:p-10 space-y-6 shadow-[0_16px_48px_rgba(16,61,45,0.09)]">
              <div className="text-center pb-1 px-1 sm:px-3">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#0f1a2a] leading-snug">Crie sua conta</h1>
                <p className="text-[14px] sm:text-[14.5px] leading-relaxed text-[#6b7a89] mt-2.5">Comece agora seu site profissional.<br className="hidden sm:block" /> Crie sua conta em poucos segundos. Depois você continuará para o pagamento seguro.</p>
              </div>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2">Nome completo</label>
                  <input type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" className="w-full rounded-[14px] border border-[#dde6de] bg-white px-4 sm:px-5 py-4 text-[15px] leading-relaxed text-[#0f1a2a] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/15 focus:border-[#103d2d] transition" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2">E-mail</label>
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="w-full rounded-[14px] border border-[#dde6de] bg-white px-4 sm:px-5 py-4 text-[15px] leading-relaxed text-[#0f1a2a] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/15 focus:border-[#103d2d] transition" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2">Senha</label>
                  <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full rounded-[14px] border border-[#dde6de] bg-white px-4 sm:px-5 py-4 text-[15px] leading-relaxed text-[#0f1a2a] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/15 focus:border-[#103d2d] transition" />
                </div>
              </div>
              {authError && (
                <div className="rounded-[12px] bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b] leading-5 flex items-start gap-2">
                  <span className="text-[15px] leading-5">⚠️</span>
                  <div className="min-w-0">
                    <p>{authError}</p>
                    {/cadastrad|already exists|user already/i.test(authError) && (
                      <button type="button" onClick={() => { setAuthError(null); setAuthMode("login"); }} className="mt-1.5 text-[13px] font-semibold text-[#103d2d] hover:underline">Já tenho uma conta → Entrar</button>
                    )}
                  </div>
                </div>
              )}
              {authMsg && <p className="rounded-[12px] bg-[#f0fdf4] border border-[#dcfce7] px-4 py-3 text-sm text-[#166534] leading-5">{authMsg}</p>}
              <button type="submit" disabled={authLoading} className="w-full rounded-[12px] bg-[#103d2d] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(16,61,45,0.18)] hover:bg-[#0e3326] active:bg-[#0a2e22] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {authLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Criando sua conta...
                  </>
                ) : (
                  <>Continuar para pagamento <span aria-hidden>→</span></>
                )}
              </button>
              <p className="text-center text-[13.5px] text-[#6b7a89] pt-1">
                Já tenho uma conta →{" "}
                <button type="button" onClick={() => { setAuthError(null); setAuthMsg(null); setAuthMode("login"); }} className="font-semibold text-[#103d2d] hover:underline">Entrar</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="rounded-[24px] border border-[#e7ece8] bg-white/95 backdrop-blur p-6 sm:p-10 space-y-6 shadow-[0_16px_48px_rgba(16,61,45,0.09)]">
              <div className="text-center pb-1 px-1 sm:px-3">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#0f1a2a] leading-snug">Entrar na sua conta</h1>
                <p className="text-[14px] sm:text-[14.5px] leading-relaxed text-[#6b7a89] mt-2.5">Voltaremos automaticamente para o pagamento do <b className="text-[#0f1a2a]">{planName}</b>.</p>
              </div>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2">E-mail</label>
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="w-full rounded-[14px] border border-[#dde6de] bg-white px-4 sm:px-5 py-4 text-[15px] leading-relaxed text-[#0f1a2a] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/15 focus:border-[#103d2d] transition" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2">Senha</label>
                  <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className="w-full rounded-[14px] border border-[#dde6de] bg-white px-4 sm:px-5 py-4 text-[15px] leading-relaxed text-[#0f1a2a] placeholder:text-[#9aa8b5] focus:outline-none focus:ring-2 focus:ring-[#103d2d]/15 focus:border-[#103d2d] transition" />
                </div>
              </div>
              {authError && <p className="rounded-[12px] bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm text-[#991b1b] leading-5">{authError}</p>}
              {authMsg && <p className="rounded-[12px] bg-[#f0fdf4] border border-[#dcfce7] px-4 py-3 text-sm text-[#166534] leading-5">{authMsg}</p>}
              <button type="submit" disabled={authLoading} className="w-full rounded-[12px] bg-[#103d2d] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(16,61,45,0.18)] hover:bg-[#0e3326] active:bg-[#0a2e22] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {authLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>Entrar e continuar para pagamento <span aria-hidden>→</span></>
                )}
              </button>
              <p className="text-center text-[13.5px] text-[#6b7a89] pt-1">
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => { setAuthError(null); setAuthMsg(null); setAuthMode("signup"); }} className="font-semibold text-[#103d2d] hover:underline">Criar conta</button>
              </p>
            </form>
          )}

          {/* Selo de segurança — alinhado com a Etapa 2 */}
          <div className="mt-5 sm:mt-6 flex items-center justify-center gap-2 text-[12px] text-[#6b7a89]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span className="leading-5">Ambiente seguro • Seus dados são protegidos com criptografia</span>
          </div>
        </div>
      </div>
    );
  }

  // CHECKOUT — moderno, centralizado, legível, com respiro generoso
  if (step === "checkout") {
    return (
      <div className="w-full flex flex-col items-center px-2 sm:px-6">
        {/* Stepper discreto — Etapa 2 de 2 */}
        <div className="w-full max-w-[1020px] mb-6 sm:mb-8 flex items-center justify-center gap-3">
          <span className="flex items-center gap-2 text-[12px] font-medium text-[#8a9aa8]">
            <span className="w-6 h-6 rounded-full bg-[#eaf6ec] border border-[#cfe8d2] text-[#1b6b2e] flex items-center justify-center text-[11px] font-bold">✓</span>
            Sua conta
          </span>
          <span className="h-px w-8 sm:w-12 bg-[#103d2d]" />
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[#103d2d]">
            <span className="w-6 h-6 rounded-full bg-[#103d2d] text-white flex items-center justify-center text-[11px] font-bold">2</span>
            Pagamento
          </span>
        </div>

        {/* Título centralizado — mais respiro e legibilidade */}
        <div className="text-center w-full max-w-[1020px] mx-auto px-3 sm:px-6 pt-1 sm:pt-2 pb-1 mb-8 sm:mb-12">
          <h1 className="text-[26px] sm:text-[34px] lg:text-[36px] font-bold tracking-[-0.02em] text-[#0f1a2a] leading-[1.2] sm:leading-[1.15]">
            Finalize a ativação do seu site
          </h1>
          <p className="text-[14px] sm:text-[15.5px] leading-relaxed text-[#5a6b7a] mt-4 max-w-[600px] mx-auto">
            Escolha a forma de pagamento e ative seu Site Profissional.
          </p>
        </div>

        {/* Grid 2 colunas — 380px + flex, centralizado, com respiro lateral no mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 lg:gap-8 items-start w-full max-w-[1020px] mx-auto">
          {/* ESQUERDA — Resumo do plano — mais respiro */}
          <div className="w-full px-1 sm:px-0">
            <div className="rounded-[24px] bg-white/95 backdrop-blur border border-[#e7ece8] shadow-[0_16px_48px_rgba(16,61,45,0.09)] overflow-hidden">
              <div className="p-6 sm:p-8 lg:p-9">
                <h2 className="text-[15px] font-bold text-[#0f1a2a] leading-6">Resumo do plano</h2>

                <div className="mt-7 flex gap-4">
                  <div className="w-[52px] h-[52px] rounded-[12px] bg-[#eef4ef] border border-[#e2ece8] flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="12" cy="12" r="9" stroke="#1a4d2e" strokeWidth="1.6" />
                      <ellipse cx="12" cy="12" rx="4.4" ry="9" stroke="#1a4d2e" strokeWidth="1.35" />
                      <path d="M3.2 12H20.8M12 3.2c1.7 2.15 2.65 4.85 2.65 8.8S13.7 18.65 12 20.8c-1.7-2.15-2.65-4.85-2.65-8.8S10.3 5.35 12 3.2Z" stroke="#1a4d2e" strokeWidth="1.25" strokeLinecap="round" />
                      <path d="M5 8.4H19M5 15.6H19" stroke="#1a4d2e" strokeWidth="1.15" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#8a9aa8] leading-4">Seu plano</p>
                    <p className="text-[15.5px] font-bold text-[#0f1a2a] mt-1 leading-6 tracking-tight">{planName}</p>
                    <p className="text-[12.5px] leading-6 text-[#64748b] mt-2">Inclui domínio, hospedagem e suporte. Sem fidelidade.</p>
                  </div>
                </div>

                <div className="mt-7 border-t border-[#eef2ee]" />

                <div className="mt-6 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[13px] text-[#475569] leading-6">Ativação (pagamento único)</p>
                    <p className="text-[13.5px] font-semibold text-[#0f1a2a] shrink-0 tracking-tight leading-6">{brl(activationCents)}</p>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[13px] text-[#475569] leading-6 pt-0.5">Mensalidade</p>
                    <div className="text-right shrink-0">
                      <p className="text-[13.5px] font-semibold text-[#0f1a2a] leading-6 tracking-tight">{brl(monthlyCents)}/mês</p>
                      <p className="text-[11px] text-[#6b7a89] mt-1.5 leading-4">após {trialMonths} meses</p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 h-px bg-[#eef2ee]" />

                <div className="mt-6 rounded-[12px] bg-[#fffbeb] border border-[#fde68a] px-4 py-3.5 flex items-center gap-3">
                  <span className="text-[18px] leading-none shrink-0" aria-hidden>🎁</span>
                  <p className="text-[12.5px] leading-5 text-[#92400e]">
                    <b>{trialMonths} {trialMonths === 1 ? "mês" : "meses"} sem mensalidade</b> — você só paga a ativação hoje.
                  </p>
                </div>

                <div className="mt-4 rounded-[12px] bg-[#f2f7f3] border border-[#e6efe7] px-4 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.13em] uppercase text-[#6b7a89] leading-4">Total hoje</p>
                    <p className="text-[22px] font-extrabold text-[#13402e] leading-6 mt-1.5 tracking-tight">{brl(activationCents)}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-[#dff0e2] border border-[#cde7d1] px-3 py-1.5 text-[10px] font-extrabold tracking-[0.07em] uppercase text-[#166534] leading-4">Pagamento único</span>
                </div>

                <div className="mt-5 rounded-[12px] bg-[#f8faf8] border border-[#edf2ed] px-4 py-4 flex gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-white border border-[#e2efe4] flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                  <div className="text-[12.5px] leading-6 text-[#475569]">
                    <p className="font-semibold text-[#334155] leading-6">Sem taxas escondidas.</p>
                    <p className="font-semibold text-[#334155] leading-6">Cancele quando quiser.</p>
                    <p className="text-[#64748b] mt-1 leading-6">Ativação imediata após a confirmação.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DIREITA — Pagamento — mais respiro */}
          <div className="w-full min-w-0 overflow-hidden px-1 sm:px-0">
            <div className="rounded-[24px] bg-white/95 backdrop-blur border border-[#e7ece8] shadow-[0_16px_48px_rgba(16,61,45,0.09)] p-6 sm:p-8 lg:p-9">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-[#0f1a2a] leading-6">Pagamento</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#e6ecef] px-3 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] shrink-0">
                  {gateway === "mercadopago" ? (
                    <>
                      <span className="w-[18px] h-[18px] rounded-full bg-[#009ee3] flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 4L-1 10.5V13.5L12 20L25 13.5V10.5Z" /></svg>
                      </span>
                      <span className="text-[11.5px] font-bold text-[#2d3a4a] tracking-tight">Mercado Pago</span>
                    </>
                  ) : (
                    <>
                      <span className="w-[18px] h-[18px] rounded-full bg-[#635bff] flex items-center justify-center text-[7px] font-bold text-white">S</span>
                      <span className="text-[11.5px] font-bold text-[#2d3a4a] tracking-tight">Stripe</span>
                    </>
                  )}
                </span>
              </div>

              <p className="text-[13px] text-[#64748b] mt-3 leading-6">
                {gateway === "mercadopago" ? "Escolha sua forma de pagamento abaixo." : "Pagamento com cartão via Stripe — seguro e sem sair do site."}
              </p>

              {/* Escolha do método — o cliente decide e o MP finaliza com a opção desejada */}
              {gateway === "mercadopago" ? (
                <div className="mt-6">
                  <p className="text-[13px] font-semibold text-[#0f1a2a] leading-6 mb-3 px-1">Como você quer pagar?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Forma de pagamento">
                    {/* PIX */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedMethod === "pix"}
                      onClick={() => setPayMethod("pix")}
                      className={`relative rounded-[14px] border-[1.5px] px-4 py-4 flex items-center gap-3 text-left transition-all ${
                        selectedMethod === "pix"
                          ? "border-[#16a34a] bg-[#f0fdf4] shadow-[0_6px_18px_rgba(22,163,74,0.12)]"
                          : "border-[#e2e8e4] bg-white hover:border-[#a7d0b4] hover:bg-[#fbfdfb]"
                      }`}
                    >
                      {mpPixDiscount > 0 && (
                        <span className="absolute -top-2.5 left-3 inline-flex items-center rounded-full bg-[#16a34a] px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase text-white leading-4">
                          {mpPixDiscount}% OFF
                        </span>
                      )}
                      <span className={`w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 transition-all ${selectedMethod === "pix" ? "border-[6px] border-[#16a34a] bg-white" : "border-2 border-[#cbd5d1] bg-white"}`} />
                      <span className="w-9 h-9 rounded-[10px] bg-[#eef6ee] border border-[#cfe8d2] flex items-center justify-center shrink-0 text-[16px]" aria-hidden>⚡</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold text-[#0f1a2a] leading-5">PIX</span>
                        <span className="block text-[12px] text-[#64748b] leading-5 mt-0.5">Aprovação em segundos</span>
                        <span className="block mt-1 leading-5">
                          <span className="text-[14px] font-extrabold text-[#16a34a]">{brl(pixCents)}</span>
                          {mpPixDiscount > 0 && <span className="text-[11.5px] text-[#8a9aa8] line-through ml-1.5">{brl(activationCents)}</span>}
                        </span>
                      </span>
                    </button>
                    {/* CARTÃO */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedMethod === "card"}
                      onClick={() => setPayMethod("card")}
                      className={`relative rounded-[14px] border-[1.5px] px-4 py-4 flex items-center gap-3 text-left transition-all ${
                        selectedMethod === "card"
                          ? "border-[#103d2d] bg-[#f4f8f5] shadow-[0_6px_18px_rgba(16,61,45,0.12)]"
                          : "border-[#e2e8e4] bg-white hover:border-[#a7d0b4] hover:bg-[#fbfdfb]"
                      }`}
                    >
                      {mpInstallments > 0 && mpInstallmentsWithoutInterest && (
                        <span className="absolute -top-2.5 left-3 inline-flex items-center rounded-full bg-[#103d2d] px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase text-white leading-4">
                          sem juros
                        </span>
                      )}
                      <span className={`w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 transition-all ${selectedMethod === "card" ? "border-[6px] border-[#103d2d] bg-white" : "border-2 border-[#cbd5d1] bg-white"}`} />
                      <span className="w-9 h-9 rounded-[10px] bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#103d2d" strokeWidth="1.5"><rect x="2.5" y="5.5" width="19" height="13" rx="1.8" /><path d="M2.5 9.2H21.5" /></svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold text-[#0f1a2a] leading-5">Cartão de crédito</span>
                        <span className="block text-[12px] text-[#64748b] leading-5 mt-0.5">
                          {mpInstallments > 0 ? <>em até <b className="text-[#0f1a2a]">{mpInstallments}x {mpInstallmentsWithoutInterest ? "sem juros" : ""}</b></> : "à vista, sem sair do site"}
                        </span>
                        <span className="block mt-1 leading-5">
                          <span className="text-[14px] font-extrabold text-[#0f1a2a]">{brl(activationCents)}</span>
                          {cardPerInstallment && <span className="block text-[11.5px] font-semibold text-[#1a6b4a]">{mpInstallments}x de {cardPerInstallment}{mpInstallmentsWithoutInterest ? " s/ juros" : ""}</span>}
                        </span>
                      </span>
                    </button>
                  </div>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-[#6b7a89] leading-5 px-1">
                    <span className="inline-flex items-center rounded-full bg-[#eaf6ec] border border-[#cfe8d2] px-2 py-0.5 text-[10.5px] font-bold text-[#1b6b2e] whitespace-nowrap leading-4">100% seguro</span>
                    via Mercado Pago, sem sair do site
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-[12px] border-[1.5px] border-[#a7d0b4] bg-[#fbfdfb] px-4 py-4 flex items-center gap-3.5">
                  <span className="w-[20px] h-[20px] rounded-full border-[5px] border-[#103d2d] bg-white flex items-center justify-center shrink-0" />
                  <span className="w-8 h-8 rounded-[9px] bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#103d2d" strokeWidth="1.5"><rect x="2.5" y="5.5" width="19" height="13" rx="1.8" /><path d="M2.5 9.2H21.5" /></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#0f1a2a] leading-6">Cartão de crédito — sem sair do site</p>
                    <p className="text-[12px] text-[#64748b] leading-5">Processamento instantâneo e seguro</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-[#eaf6ec] border border-[#cfe8d2] px-2.5 py-1 text-[11px] font-bold text-[#1b6b2e] whitespace-nowrap tracking-tight leading-4">100% seguro</span>
                </div>
              )}

              {checkoutError && <p className="mt-5 rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm leading-6 text-[#991b1b]">{checkoutError}</p>}

              <button
                type="button"
                onClick={() => startCheckout(selectedMethod)}
                disabled={checkoutLoading}
                className="mt-6 w-full rounded-[12px] bg-[#0f3d2d] hover:bg-[#0c3326] active:bg-[#0a2e22] px-6 py-4 text-center shadow-[0_6px_18px_rgba(15,61,45,0.2)] hover:shadow-[0_8px_22px_rgba(15,61,45,0.24)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span className="flex items-center justify-center gap-2 text-[15px] font-semibold text-white leading-6">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1.1" fill="white" stroke="none" /></svg>
                  {checkoutLoading ? "Processando pagamento..." : "🔒 Pagar e ativar meu site"}
                </span>
                <span className="block text-[12px] font-medium text-white/80 mt-1.5 leading-5">
                  {checkoutLoading
                    ? "Aguarde um instante"
                    : gateway === "mercadopago"
                      ? selectedMethod === "pix"
                        ? mpPixDiscount > 0
                          ? `PIX ${brl(pixCents)} com ${mpPixDiscount}% OFF hoje`
                          : `PIX ${brl(pixCents)} hoje • aprovação imediata`
                        : installmentLabel
                          ? `Cartão ${installmentLabel} • total ${brl(activationCents)} hoje`
                          : `Cartão ${brl(activationCents)} hoje`
                      : `Pagamento único de ${brl(activationCents)} hoje`}
                </span>
              </button>

              <div className="mt-6 flex gap-3.5 items-start rounded-[12px] bg-[#f6faf7] border border-[#e8f0e8] px-4 py-4">
                <span className="w-8 h-8 rounded-full bg-white border border-[#dde8dc] flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3L17.9 6.2V12.1C17.9 15.45 15.5 18.3 12 19.4C8.5 18.3 6.1 15.45 6.1 12.1V6.2L12 3Z" stroke="#166534" strokeWidth="1.5" fill="none" />
                    <path d="M9.2 11.1L11 12.9L14.9 9.1" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f1a2a] leading-6">Pagamento seguro</p>
                  <p className="text-[12.5px] leading-6 text-[#64748b] mt-1.5">{gatewaySecureText}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12px] leading-6 text-[#6b7a89] px-2">
                <span className="leading-6">Logado como <b className="font-semibold text-[#334155]">{userEmail}</b></span>
                <span className="w-1 h-1 rounded-full bg-[#cbd5d1] mx-0.5" />
                <button type="button" onClick={() => router.push("/")} className="text-[#1a6b4a] hover:text-[#103d2d] hover:underline font-medium leading-6">voltar ao site</button>
                <span className="w-1 h-1 rounded-full bg-[#cbd5d1] mx-0.5" />
                <button type="button" onClick={() => setStep("identify")} className="text-[#1a6b4a] hover:text-[#103d2d] hover:underline font-medium leading-6">trocar conta</button>
              </div>

              <div className="mt-5 border-t border-[#eef2ee] pt-5">
                <p className="text-[11.5px] leading-6 text-[#6b7a89] text-center max-w-[520px] mx-auto px-2">Ao continuar, você concorda com a contratação e ativação automática após a confirmação do pagamento. Suporte via WhatsApp após a compra.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefícios — barra única branca moderna — mais respiro e legibilidade */}
        <div className="mt-8 sm:mt-10 w-full max-w-[1020px] mx-auto rounded-[20px] bg-white/95 backdrop-blur border border-[#e7ece8] shadow-[0_12px_32px_rgba(16,61,45,0.07)] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#eef2ee] overflow-hidden px-1 sm:px-0">
          <div className="flex gap-3.5 items-center px-6 py-5">
            <span className="w-9 h-9 rounded-xl bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center text-[#103d2d] shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v13M12 16l-4-4M12 16l4-4" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="16" width="18" height="5" rx="1.4" /></svg>
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#0f1a2a] leading-6">Ativação imediata</p>
              <p className="text-[11.5px] text-[#64748b] mt-0.5 leading-5">Assim que o pagamento for confirmado</p>
            </div>
          </div>
          <div className="flex gap-3.5 items-center px-6 py-5">
            <span className="w-9 h-9 rounded-xl bg-[#f0f6fb] border border-[#e2e8f0] flex items-center justify-center text-[#1e3a5f] shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3L17.8 6V12.2C17.8 15.2 15.4 17.9 12 19.1C8.6 17.9 6.2 15.2 6.2 12.2V6L12 3Z" stroke="currentColor" strokeWidth="1.5" /><path d="M9 12L11 14L15 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#0f1a2a] leading-6">100% seguro</p>
              <p className="text-[11.5px] text-[#64748b] mt-0.5 leading-5">Seus dados sempre protegidos</p>
            </div>
          </div>
          <div className="flex gap-3.5 items-center px-6 py-5">
            <span className="w-9 h-9 rounded-xl bg-[#fdf8ec] border border-[#f3e8c7] flex items-center justify-center text-[#7a5a1a] shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#0f1a2a] leading-6">Sem fidelidade</p>
              <p className="text-[11.5px] text-[#64748b] mt-0.5 leading-5">Cancele quando quiser</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PAYMENT
  if (step === "payment") {
    return (
      <div className="w-full max-w-[720px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-6 sm:mb-8 pt-2 px-2 sm:px-4">
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#0f1a2a] leading-snug">Finalize seu pagamento</h1>
          <p className="text-[14px] sm:text-[15px] text-[#6b7a89] mt-2.5 leading-relaxed">Pague com PIX ou cartão sem sair do site. A ativação é automática após a confirmação.</p>
        </div>

        <div className="rounded-[16px] border border-[#eef2ee] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.11em] uppercase text-[#8a9aa8]">Total hoje</p>
            <p className="text-[18px] font-bold text-[#103d2d] leading-none mt-1.5">
              {gateway === "mercadopago" ? brl(selectedTotalCents) : brl(activationCents)}
            </p>
            {gateway === "mercadopago" && (
              <p className="text-[11.5px] font-semibold text-[#1a6b4a] mt-1.5 leading-4">
                {selectedMethod === "pix"
                  ? mpPixDiscount > 0 ? `PIX com ${mpPixDiscount}% OFF` : "PIX • aprovação imediata"
                  : installmentLabel ? `Cartão • ${installmentLabel}` : "Cartão de crédito"}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-[#6b7a89] text-right leading-5">{planName}<br />{brl(monthlyCents)}/mês após {trialMonths}m</p>
            {gateway === "mercadopago" && (
              <button type="button" onClick={() => setStep("checkout")} className="mt-1.5 text-[11.5px] font-semibold text-[#1a6b4a] hover:text-[#103d2d] hover:underline leading-4">
                trocar método
              </button>
            )}
          </div>
        </div>

        {gateway === "stripe" && stripeClientSecret ? (
          <div className="rounded-[24px] border border-[#e7ece8] bg-white/95 p-6 sm:p-9 shadow-[0_16px_48px_rgba(16,61,45,0.08)]">
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
        ) : gateway === "mercadopago" && (preferenceId || mpUrl) ? (
          <div className="rounded-[24px] border border-[#e7ece8] bg-white/95 p-6 sm:p-9 shadow-[0_16px_48px_rgba(16,61,45,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#0f1a2a] leading-5">Pagamento</h3>
                <p className="text-sm text-[#6b7a89] mt-1 leading-5">
                  {canUseBrick
                    ? selectedMethod === "pix"
                      ? `Você escolheu PIX${mpPixDiscount > 0 ? ` com ${mpPixDiscount}% OFF (${brl(selectedTotalCents)})` : ` (${brl(selectedTotalCents)})`}. Conclua abaixo — a confirmação é automática.`
                      : `Você escolheu cartão${installmentLabel ? ` (${installmentLabel})` : ""}. Preencha abaixo sem sair do site.`
                    : "Conclua o pagamento com segurança."}
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full bg-[#009ee3]/10 border border-[#009ee3]/15 px-3 py-1.5 text-xs font-semibold text-[#009ee3]">Mercado Pago</span>
            </div>

            {canUseBrick ? (
              <div className="mt-6">
                <MercadoPagoBrick
                  key={`${selectedMethod}-${brickAmount}-${brickMaxInstallments}`}
                  publicKey={mpPublicKey!}
                  preferenceId={preferenceId}
                  amount={brickAmount}
                  payerEmail={userEmail || email}
                  maxInstallments={brickMaxInstallments}
                  planId={offer?.id}
                  onApproved={handleBrickApproved}
                  onPixPending={handleBrickPix}
                  onPending={handleBrickPending}
                  onBrickError={() => setBrickFailed(true)}
                />
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setStep("checkout")} className="rounded-full border border-[#dde6de] bg-white px-4 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition leading-5">
                    Voltar
                  </button>
                  <button type="button" onClick={() => { setStep("processing"); startPolling(); }} className="rounded-full bg-[#0f1a2a] px-4 py-3.5 text-sm font-semibold text-white hover:bg-black transition leading-5">
                    Já paguei
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-xl border border-[#e6ecef] bg-[#f8faf8] p-5 sm:p-6 text-center">
                  <p className="text-sm font-semibold text-[#0f1a2a] leading-6">Pagamento em ambiente seguro do Mercado Pago</p>
                  <p className="text-[13px] text-[#64748b] mt-1.5 leading-5">
                    {selectedMethod === "pix"
                      ? `${brl(selectedTotalCents)} no PIX${mpPixDiscount > 0 ? ` (${mpPixDiscount}% OFF aplicado)` : ""}`
                      : `${brl(selectedTotalCents)} no cartão${installmentLabel ? ` (${installmentLabel})` : ""}`} • Após a confirmação, voltamos para ativar seu site automaticamente.
                  </p>
                  {mpUrl ? (
                    <a
                      href={mpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => startPolling()}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#009ee3] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_6px_18px_rgba(0,158,227,0.25)] hover:bg-[#0089c7] transition"
                    >
                      Ir para pagamento seguro →
                    </a>
                  ) : (
                    <p className="mt-4 text-sm text-[#991b1b]">Não foi possível preparar o pagamento. Tente novamente.</p>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setStep("checkout")} className="rounded-full border border-[#dde6de] bg-white px-4 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition leading-5">
                    Voltar
                  </button>
                  <button type="button" onClick={() => { setStep("processing"); startPolling(); }} className="rounded-full bg-[#0f1a2a] px-4 py-3.5 text-sm font-semibold text-white hover:bg-black transition leading-5">
                    Já paguei, verificar ativação
                  </button>
                </div>
              </>
            )}

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

  // PIX — QR Code + copia e cola, tudo dentro do site
  if (step === "pix") {
    return (
      <div className="w-full max-w-[600px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-6 sm:mb-8 pt-2 px-2">
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#0f1a2a] leading-snug">Pague com PIX</h1>
          <p className="text-[14px] sm:text-[15px] text-[#6b7a89] mt-2.5 leading-relaxed">Escaneie o QR Code ou use o código copia e cola. A confirmação é automática.</p>
        </div>

        <div className="rounded-[24px] border border-[#e7ece8] bg-white/95 p-6 sm:p-9 shadow-[0_16px_48px_rgba(16,61,45,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.11em] uppercase text-[#8a9aa8]">Total no PIX</p>
              <p className="text-[22px] font-extrabold text-[#13402e] leading-none mt-1.5">{mpPixDiscount > 0 ? brl(pixCents) : brl(activationCents)}</p>
            </div>
            <span className="shrink-0 inline-flex items-center rounded-full bg-[#16a34a]/10 border border-[#16a34a]/15 px-3 py-1.5 text-xs font-semibold text-[#16a34a]">PIX • Aprovação rápida</span>
          </div>

          {pix?.qr_code_base64 ? (
            <div className="mt-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code do PIX"
                className="w-[220px] h-[220px] rounded-[12px] border border-[#e6ecef] bg-white p-2"
              />
            </div>
          ) : null}

          {pix?.qr_code ? (
            <div className="mt-6">
              <p className="text-[12px] font-semibold text-[#0f1a2a] mb-2 leading-5">PIX copia e cola</p>
              <p className="rounded-[12px] border border-[#e6ecef] bg-[#f8faf8] px-4 py-3 text-[12px] leading-5 text-[#334155] break-all font-mono max-h-[96px] overflow-y-auto">{pix.qr_code}</p>
              <button
                type="button"
                onClick={copyPixCode}
                className="mt-3 w-full rounded-[12px] bg-[#103d2d] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#0e3326] transition leading-5"
              >
                {copiedPix ? "✓ Código copiado!" : "📋 Copiar código PIX"}
              </button>
            </div>
          ) : null}

          <div className="mt-6 rounded-[12px] bg-[#fffbeb] border border-[#fde68a] px-4 py-3.5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full border-2 border-[#fde68a] border-t-[#d97706] animate-spin shrink-0" aria-hidden />
            <p className="text-[13px] text-[#92400e] leading-5">Aguardando confirmação do pagamento... Não feche esta janela.</p>
          </div>

          <div className="mt-4 flex flex-col gap-2 w-full">
            <button type="button" onClick={() => startPolling()} className="w-full rounded-full bg-[#0f1a2a] px-6 py-3.5 text-sm font-semibold text-white hover:bg-black transition leading-5">
              Já paguei — verificar agora
            </button>
            <button type="button" onClick={() => setStep("payment")} className="w-full rounded-full border border-[#dde6de] bg-white px-6 py-3.5 text-sm font-medium text-[#2d3a4a] hover:bg-[#f6faf7] transition leading-5">
              Escolher outra forma
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-[560px] mx-auto w-full px-5 sm:px-8 text-center py-12 sm:py-16">
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
      <div className="max-w-[560px] mx-auto w-full px-5 sm:px-8 text-center py-12 sm:py-16">
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
      <div className="max-w-[560px] mx-auto w-full px-5 sm:px-8 text-center py-12 sm:py-16">
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
      <div className="max-w-[560px] mx-auto w-full px-5 sm:px-8 text-center py-12 sm:py-16">
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
