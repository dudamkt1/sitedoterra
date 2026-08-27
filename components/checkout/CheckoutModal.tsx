"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadStripe } from "@stripe/stripe-js";

type GatewayInfo = {
  gateway: "stripe" | "mercadopago";
  stripe: { publishableKey: string | null };
  mercadopago: { sandbox: boolean };
  offer: { id: string; name: string; activation_price_cents: number; monthly_price_cents: number; trial_months: number } | null;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CheckoutModal({ open, onClose, planId }: { open: boolean; onClose: () => void; planId?: string }) {
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "cadastro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [mpUrl, setMpUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"summary" | "auth" | "payment" | "success">("summary");

  useEffect(() => {
    if (!open) return;
    setCheckingAuth(true);
    setCheckoutError(null);
    setStripeClientSecret(null);
    setMpUrl(null);
    setStep("summary");
    // gateway
    fetch("/api/gateway").then((r) => r.json()).then((j) => setGatewayInfo(j)).catch(() => {});
    // auth
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setIsAuthed(true);
        setUserEmail(data.user.email || null);
      } else {
        setIsAuthed(false);
      }
      setCheckingAuth(false);
    });
    // also listen
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session?.user);
      setUserEmail(session?.user?.email || null);
    });
    return () => sub.subscription.unsubscribe();
  }, [open]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      setAuthLoading(false);
      return;
    }
    setAuthLoading(false);
    setIsAuthed(true);
    setStep("payment");
    startCheckout();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthMsg(null);
    if (password.length < 6) {
      setAuthError("A senha precisa ter pelo menos 6 caracteres.");
      setAuthLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }
    if (data.session) {
      setIsAuthed(true);
      setStep("payment");
      startCheckout();
    } else {
      setAuthMsg("Conta criada! Verifique seu e-mail para confirmar o cadastro e depois volte e faça login.");
    }
    setAuthLoading(false);
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    setStripeClientSecret(null);
    setMpUrl(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, embedded: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setStep("auth");
          setCheckoutError(null);
          return;
        }
        throw new Error(json.error || "Erro ao iniciar pagamento.");
      }
      if (json.gateway === "mercadopago" && json.url) {
        setMpUrl(json.url);
        setStep("payment");
      } else if (json.gateway === "stripe" && json.clientSecret) {
        setStripeClientSecret(json.clientSecret);
        setStep("payment");
      } else if (json.url) {
        // fallback redirect in new tab keeping site
        window.open(json.url, "_blank");
        setStep("success");
      }
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Erro ao iniciar pagamento.");
    }
    setCheckoutLoading(false);
  }

  // mount stripe embedded checkout when clientSecret available
  useEffect(() => {
    if (!stripeClientSecret || !gatewayInfo?.stripe.publishableKey) return;
    let destroyed = false;
    (async () => {
      const stripe = await loadStripe(gatewayInfo.stripe.publishableKey!);
      if (!stripe || destroyed) return;
      const checkout = await (stripe as any).initEmbeddedCheckout({
        fetchClientSecret: async () => stripeClientSecret,
        onComplete: () => {
          setStep("success");
          setTimeout(() => {
            window.location.href = "/painel/assinatura?sucesso=1";
          }, 1200);
        },
      });
      if (!destroyed) checkout.mount("#stripe-embedded-checkout");
    })();
    return () => { destroyed = true; };
  }, [stripeClientSecret, gatewayInfo]);

  if (!open) return null;

  const offer = gatewayInfo?.offer;
  const gateway = gatewayInfo?.gateway || "stripe";
  const activationCents = offer?.activation_price_cents || 29700;
  const monthlyCents = offer?.monthly_price_cents || 4700;
  const trialMonths = offer?.trial_months || 3;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl my-8 relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>

        {step === "summary" && (
          <>
            <div className="pr-8">
              <h3 className="card-title">Ativar seu site</h3>
              <p className="text-sm text-gray-500 mt-1">Checkout transparente — sem sair do site. O gateway ativo é definido pelo Super Admin em <code className="bg-gray-100 rounded px-1 text-xs">/admin/pagamentos</code>.</p>
            </div>

            <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ativação (pagamento único)</span>
                <span className="font-bold text-[#1d5c3a]">{brl(activationCents)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">Mensalidade</span>
                <span className="text-sm font-semibold">{brl(monthlyCents)}/mês</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Primeira mensalidade <b>apenas após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}</b> da ativação. Valores e prazo sincronizados pelo Super Admin (fonte: tabela <code>plans</code>).
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className={`badge ${gateway === "mercadopago" ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-violet-50 text-violet-700 border border-violet-200"}`}>
                  {gateway === "mercadopago" ? "🇧🇷 Mercado Pago — PIX ou cartão" : "💳 Stripe — cartão"}
                </span>
                {gatewayInfo?.mercadopago.sandbox && <span className="badge badge-yellow">SANDBOX</span>}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Após o pagamento aprovado, seu site é <b>ativado automaticamente via webhook</b> e libera o painel completo. Você será avisado aqui no painel (<code>/painel/assinatura?sucesso=1</code>), no histórico de pagamentos e a próxima cobrança só aparece após {trialMonths} meses.
            </div>

            {checkingAuth ? (
              <p className="text-sm text-gray-400 mt-4">Verificando login...</p>
            ) : isAuthed ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">✓ Logado como <b>{userEmail}</b></p>
                <button type="button" onClick={() => { setStep("payment"); startCheckout(); }} disabled={checkoutLoading} className="btn btn-primary w-full">
                  {checkoutLoading ? "Preparando pagamento..." : `Pagar ${brl(activationCents)} e ativar agora →`}
                </button>
                <p className="text-xs text-gray-400 text-center">Checkout 100% dentro do site. Seu cartão fica salvo de forma segura para a mensalidade futura.</p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-3">Você precisa estar logado para pagar. Entre ou crie sua conta sem sair desta janela:</p>
                <button type="button" onClick={() => setStep("auth")} className="btn btn-primary w-full">Entrar / Criar conta</button>
              </div>
            )}

            {checkoutError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{checkoutError}</p>}
          </>
        )}

        {step === "auth" && (
          <>
            <h3 className="card-title pr-8">Acesse sua conta</h3>
            <p className="text-xs text-gray-500 mt-1">Faça login ou cadastre-se. Ao concluir, voltamos automaticamente ao pagamento — sem perder seu plano.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setAuthTab("login")} className={`flex-1 py-2 rounded-full text-sm font-semibold border ${authTab === "login" ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : "bg-white text-gray-600 border-gray-200"}`}>Entrar</button>
              <button type="button" onClick={() => setAuthTab("cadastro")} className={`flex-1 py-2 rounded-full text-sm font-semibold border ${authTab === "cadastro" ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : "bg-white text-gray-600 border-gray-200"}`}>Criar conta</button>
            </div>

            {authTab === "login" ? (
              <form onSubmit={handleLogin} className="mt-4 space-y-3">
                <div><label className="label">E-mail</label><input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
                <div><label className="label">Senha</label><input type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
                {authError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{authError}</p>}
                {authMsg && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{authMsg}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("summary")} className="btn btn-outline flex-1">Voltar</button>
                  <button type="submit" disabled={authLoading} className="btn btn-primary flex-1">{authLoading ? "Entrando..." : "Entrar e continuar →"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="mt-4 space-y-3">
                <div><label className="label">Nome</label><input type="text" required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></div>
                <div><label className="label">E-mail</label><input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
                <div><label className="label">Senha</label><input type="password" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
                {authError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{authError}</p>}
                {authMsg && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{authMsg}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("summary")} className="btn btn-outline flex-1">Voltar</button>
                  <button type="submit" disabled={authLoading} className="btn btn-primary flex-1">{authLoading ? "Criando..." : "Criar e continuar →"}</button>
                </div>
              </form>
            )}

            <p className="text-xs text-gray-400 mt-3 text-center">Ao entrar, seu plano volta automaticamente ao checkout transparente.</p>
          </>
        )}

        {step === "payment" && (
          <>
            <div className="pr-8">
              <h3 className="card-title">Pagamento seguro</h3>
              <p className="text-xs text-gray-500 mt-1">
                {gateway === "mercadopago" ? "Mercado Pago — PIX e cartão dentro do site." : "Stripe — cartão com salvamento seguro para a mensalidade futura."}
                <span className="ml-2 text-[0.65rem] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Transparente</span>
              </p>
            </div>

            {checkoutError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{checkoutError}</p>}

            {checkoutLoading && !stripeClientSecret && !mpUrl && (
              <p className="text-sm text-gray-400 mt-4 py-6 text-center">Preparando pagamento seguro...</p>
            )}

            {gateway === "stripe" && stripeClientSecret && (
              <div className="mt-4">
                <div id="stripe-embedded-checkout" className="min-h-[320px] rounded-xl border border-gray-100" />
                <p className="text-xs text-gray-400 mt-3 text-center">Pagamento processado pelo Stripe. Seu site será ativado automaticamente assim que o webhook confirmar — você verá o aviso em <b>/painel/assinatura</b>.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setStep("summary")} className="btn btn-outline flex-1 !py-2 text-xs">Voltar</button>
                  <a href="/painel/assinatura" target="_blank" className="btn btn-outline flex-1 !py-2 text-xs text-center">Ver assinatura</a>
                </div>
              </div>
            )}

            {gateway === "mercadopago" && mpUrl && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <iframe src={mpUrl} title="Checkout Mercado Pago" className="w-full h-[520px] border-0" allow="payment *; clipboard-write" />
                </div>
                <p className="text-xs text-gray-400">PIX aprovado na hora; cartão com confirmação automática. Após aprovado, o webhook ativa seu site (primeira mensalidade só após {trialMonths} meses) e você é avisado no painel.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("summary")} className="btn btn-outline flex-1 !py-2 text-xs">Voltar</button>
                  <a href={mpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 !py-2 text-xs text-center">Abrir em nova aba ↗</a>
                </div>
                <button type="button" onClick={() => { window.location.href = "/painel/assinatura"; }} className="btn btn-outline w-full !py-2 text-xs">Já paguei, verificar ativação</button>
              </div>
            )}

            {!stripeClientSecret && !mpUrl && !checkoutLoading && (
              <div className="mt-4">
                <button type="button" onClick={startCheckout} className="btn btn-primary w-full">Tentar novamente</button>
              </div>
            )}
          </>
        )}

        {step === "success" && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto text-2xl">✓</div>
            <h3 className="card-title mt-4">Pagamento enviado!</h3>
            <p className="text-sm text-gray-600 mt-2">Seu site será ativado automaticamente assim que o webhook confirmar (segundos). Você será avisado no painel e a mensalidade de {brl(monthlyCents)} só começará após <b>{trialMonths} meses</b>.</p>
            <div className="mt-5 flex gap-2 justify-center">
              <button type="button" onClick={() => window.location.href = "/painel/assinatura?sucesso=1"} className="btn btn-primary">Ir para assinatura →</button>
              <button type="button" onClick={onClose} className="btn btn-outline">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
