"use client";

import { useEffect, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { formatBRL } from "@/lib/utils";

interface ConfigState {
  gateway: "stripe" | "mercadopago";
  stripe: {
    secret_mask: string | null;
    webhook_mask: string | null;
    publishable_key: string;
    has_secret: boolean;
    has_webhook: boolean;
  };
  mercadopago: {
    token_mask: string | null;
    webhook_mask: string | null;
    sandbox: boolean;
    has_token: boolean;
  };
  policy: {
    plan_id: string;
    name: string;
    activation_price_cents: number;
    monthly_price_cents: number;
    trial_months: number;
    allow_cancel: boolean;
  } | null;
}

export default function AdminPaymentConfig() {
  const [cfg, setCfg] = useState<ConfigState | null>(null);
  const [gateway, setGateway] = useState<"stripe" | "mercadopago">("stripe");
  const [sandbox, setSandbox] = useState(false);

  const [stripeSecret, setStripeSecret] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");
  const [stripePublishable, setStripePublishable] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [mpWebhook, setMpWebhook] = useState("");

  const [activation, setActivation] = useState(0);
  const [monthly, setMonthly] = useState(0);
  const [trialMonths, setTrialMonths] = useState(3);
  const [allowCancel, setAllowCancel] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"stripe" | "mercadopago" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/payment-config");
        const json = await res.json();
        if (res.ok) {
          setCfg(json);
          setGateway(json.gateway);
          setStripePublishable(json.stripe.publishable_key || "");
          setSandbox(json.mercadopago.sandbox);
          if (json.policy) {
            setActivation(json.policy.activation_price_cents);
            setMonthly(json.policy.monthly_price_cents);
            setTrialMonths(json.policy.trial_months);
            setAllowCancel(json.policy.allow_cancel);
          }
        } else {
          setMsg({ ok: false, text: json.error || "Erro ao carregar." });
        }
      } catch {
        setMsg({ ok: false, text: "Falha de conexão." });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway,
          mercadopago_sandbox: sandbox,
          // Segredos só são enviados quando digitados (vazio = manter)
          ...(stripeSecret ? { stripe_secret_key: stripeSecret } : {}),
          ...(stripeWebhook ? { stripe_webhook_secret: stripeWebhook } : {}),
          ...(stripePublishable ? { stripe_publishable_key: stripePublishable } : {}),
          ...(mpToken ? { mercadopago_access_token: mpToken } : {}),
          ...(mpWebhook ? { mercadopago_webhook_secret: mpWebhook } : {}),
          policy: {
            activation_price_cents: activation,
            monthly_price_cents: monthly,
            trial_months: trialMonths,
            allow_cancel: allowCancel,
          },
        }),
      });
      const json = await res.json();
      if (res.ok) {
        let text = "Configuração salva com sucesso!";
        if (json.stripePricesNote) text += ` ${json.stripePricesNote}`;
        if (json.policySaved) text += " Política comercial atualizada.";
        setMsg({ ok: true, text });
        setStripeSecret("");
        setStripeWebhook("");
        setMpToken("");
        setMpWebhook("");
        // recarrega máscaras
        const r2 = await fetch("/api/admin/payment-config");
        if (r2.ok) setCfg(await r2.json());
      } else {
        setMsg({ ok: false, text: json.error || "Erro ao salvar." });
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão." });
    }
    setSaving(false);
  }

  async function test(gw: "stripe" | "mercadopago") {
    setTesting(gw);
    try {
      const res = await fetch("/api/admin/payment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", gateway: gw }),
      });
      const json = await res.json();
      setMsg({ ok: Boolean(json.ok), text: json.message || "Sem resposta." });
    } catch {
      setMsg({ ok: false, text: "Falha de conexão no teste." });
    }
    setTesting(null);
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando configurações...</p>;

  const gwCard = (
    key: "stripe" | "mercadopago",
    icon: string,
    title: string,
    subtitle: string,
    configured: boolean
  ) => {
    const active = gateway === key;
    return (
      <button
        type="button"
        key={key}
        onClick={() => setGateway(key)}
        className={`text-left rounded-xl border-2 p-4 transition-all ${
          active
            ? "border-[#1d5c3a] bg-[#f2faf5] shadow-sm"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-2xl">{icon}</span>
          {active && (
            <span className="rounded-full bg-[#1d5c3a] px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white">
              Ativo
            </span>
          )}
          {!active && configured && (
            <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[0.6rem] font-semibold">
              chaves OK
            </span>
          )}
        </div>
        <p className="mt-2 font-bold text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </button>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ---------- Gateway ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">1. Gateway de pagamento</h2>
        <p className="text-sm text-gray-500 mb-4">
          O gateway ativo é usado automaticamente na ativação, mensalidade e webhooks.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gwCard("stripe", "💳", "Stripe", "Cartão de crédito (internacional)", Boolean(cfg?.stripe.has_secret))}
          {gwCard("mercadopago", "🇧🇷", "Mercado Pago", "PIX + cartão (Brasil)", Boolean(cfg?.mercadopago.has_token))}
        </div>
      </div>

      {/* ---------- Chaves Stripe ---------- */}
      {gateway === "stripe" && (
        <div className="card border-[#635bff]/30">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h2 className="card-title mb-0">2. Chaves do Stripe</h2>
            <button
              type="button"
              onClick={() => test("stripe")}
              disabled={testing === "stripe"}
              className="btn btn-outline !py-1.5 !px-3 !text-xs"
            >
              {testing === "stripe" ? "Testando..." : "🔌 Testar conexão"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Dashboard → Developers → API keys / Webhooks. As chaves ficam salvas no banco
            (acesso exclusivo do servidor).
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Secret Key {cfg?.stripe.secret_mask && `(salva: ${cfg.stripe.secret_mask})`}</label>
              <PasswordField id="sk" value={stripeSecret} onChange={setStripeSecret}
                placeholder="sk_live_... ou sk_test_..." autoComplete="off" />
            </div>
            <div>
              <label className="label">Chave publicável</label>
              <input className="input" value={stripePublishable} placeholder="pk_live_... / pk_test_..."
                onChange={(e) => setStripePublishable(e.target.value)} />
            </div>
            <div>
              <label className="label">Webhook Secret {cfg?.stripe.webhook_mask && `(salva: ${cfg.stripe.webhook_mask})`}</label>
              <PasswordField id="whsec" value={stripeWebhook} onChange={setStripeWebhook}
                placeholder="whsec_..." autoComplete="off" />
              <p className="text-xs text-gray-400 mt-1">
                Endpoint do webhook: <code className="bg-gray-100 rounded px-1">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/stripe</code> — eventos: checkout.session.completed, customer.subscription.*, invoice.*
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Chaves Mercado Pago ---------- */}
      {gateway === "mercadopago" && (
        <div className="card border-[#00b8ea]/40">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h2 className="card-title mb-0">2. Chaves do Mercado Pago</h2>
            <button
              type="button"
              onClick={() => test("mercadopago")}
              disabled={testing === "mercadopago"}
              className="btn btn-outline !py-1.5 !px-3 !text-xs"
            >
              {testing === "mercadopago" ? "Testando..." : "🔌 Testar conexão"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Suas integrações → Aplicações → Credenciais de produção. O webhook é criado
            automaticamente nas preferências/planos.
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Access Token {cfg?.mercadopago.token_mask && `(salva: ${cfg.mercadopago.token_mask})`}</label>
              <PasswordField id="mp-token" value={mpToken} onChange={setMpToken}
                placeholder="APP_USR-..." autoComplete="off" />
            </div>
            <div>
              <label className="label">Webhook Secret (opcional — assinatura)</label>
              <PasswordField id="mp-wh" value={mpWebhook} onChange={setMpWebhook}
                placeholder="secreto do webhook" autoComplete="off" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
              Usar SANDBOX (ambiente de testes)
            </label>
          </div>
        </div>
      )}

      {/* ---------- Política de cobrança ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">3. Política de cobrança</h2>
        <p className="text-sm text-gray-500 mb-4">
          {cfg?.policy ? (
            <>Edita o plano ativo: <strong>{cfg.policy.name}</strong>. Sem fidelidade — o cliente pode cancelar quando quiser (se permitido abaixo).</>
          ) : (
            <>Nenhum plano ativo encontrado. Configure em Planos e Preços.</>
          )}
        </p>

        {cfg?.policy && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Valor da aquisição (centavos)</label>
                <input type="number" min={0} className="input" value={activation}
                  onChange={(e) => setActivation(Number(e.target.value))} />
                <p className="text-xs text-gray-400 mt-1">{formatBRL(activation)} · pagamento único</p>
              </div>
              <div>
                <label className="label">Mensalidade (centavos)</label>
                <input type="number" min={0} className="input" value={monthly}
                  onChange={(e) => setMonthly(Number(e.target.value))} />
                <p className="text-xs text-gray-400 mt-1">{formatBRL(monthly)}/mês</p>
              </div>
              <div>
                <label className="label">Cobrar mensal a partir de (meses)</label>
                <input type="number" min={1} className="input" value={trialMonths}
                  onChange={(e) => setTrialMonths(Number(e.target.value))} />
                <p className="text-xs text-gray-400 mt-1">Primeira cobrança após {trialMonths} {trialMonths === 1 ? "mês" : "meses"}</p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm mt-4 cursor-pointer">
              <input type="checkbox" checked={allowCancel} onChange={(e) => setAllowCancel(e.target.checked)} />
              Permitir cancelamento pelo cliente quando quiser (sem fidelização)
            </label>
            {!allowCancel && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                ⚠️ Com o cancelamento desativado, o botão some do painel do cliente — ele precisará falar com o suporte.
              </p>
            )}
          </>
        )}
      </div>

      {msg && (
        <p className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}

      <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
        {saving ? "Salvando..." : "💾 Salvar configurações"}
      </button>
    </div>
  );
}
