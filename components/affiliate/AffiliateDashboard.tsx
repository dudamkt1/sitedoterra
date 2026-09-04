"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL, formatDate } from "@/lib/utils";
import { StatCard, StatusBadge, Button, Input, Modal } from "@/components/dashboard/ui";
import type {
  AffiliatePaymentMethod,
  AffiliatePayoutMethod,
  AffiliatePixKeyType,
} from "@/types";

const PIX_KEY_TYPE_OPTIONS: { value: AffiliatePixKeyType; label: string }[] = [
  { value: "cpf_cnpj", label: "CPF/CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

const PIX_KEY_TYPE_PLACEHOLDERS: Record<AffiliatePixKeyType, string> = {
  cpf_cnpj: "000.000.000-00 ou 00.000.000/0001-00",
  email: "seuemail@exemplo.com",
  phone: "+55 11 99999-9999",
  random: "Cole aqui sua chave aleatória (UUID)",
};

function isValidPixKey(key: string, type: AffiliatePixKeyType): boolean {
  const trimmed = (key || "").trim();
  if (!trimmed) return false;
  switch (type) {
    case "cpf_cnpj":
      return trimmed.replace(/\D/g, "").length >= 11;
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    case "phone":
      return trimmed.replace(/\D/g, "").length >= 10 && trimmed.replace(/\D/g, "").length <= 15;
    case "random":
      return /^[A-Za-z0-9-]{32,36}$/.test(trimmed.replace(/\s/g, ""));
    default:
      return false;
  }
}

function isValidMpEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

interface AffiliateSettings {
  commission_percent: number;
  min_payout_amount: number;
  program_active: boolean;
  cookie_max_age_days: number;
  allow_inactive_site_affiliate: boolean;
}

interface AffiliateStatus {
  is_active: boolean;
  accepted_terms_at: string | null;
  accepted_terms_version: number | null;
}

interface AffiliateClick {
  id: string;
  source_subdomain: string;
  clicked_at: string;
  converted: boolean;
}

interface AffiliateConversion {
  id: string;
  sale_amount: number;
  commission_amount: number;
  status: "pendente" | "aprovado" | "pago" | "estornado";
  created_at: string;
  new_customer_user_id: string;
}

interface AffiliatePayout {
  id: string;
  amount: number;
  method: "pix" | "mercado_pago";
  status: "solicitado" | "em_analise" | "pago" | "rejeitado";
  requested_at: string;
  paid_at: string | null;
  pix_key: string | null;
  pix_key_snapshot: string | null;
  pix_key_type_snapshot: AffiliatePixKeyType | null;
  mp_email_snapshot: string | null;
  payment_method_label: string | null;
}

interface AffiliateSummary {
  total_clicks: number;
  total_conversions: number;
  available_balance: number;
  pending_balance: number;
  total_paid: number;
}

interface AffiliateDashboardProps {
  userId: string;
  userEmail: string;
  userName: string;
  tenantSlug: string;
  isDemo: boolean;
  /** Status atual do próprio site do afiliado (default: true — modo demo/legado). */
  siteActive?: boolean;
}

export function AffiliateDashboard({ userId, userEmail, userName, tenantSlug, isDemo, siteActive = true }: AffiliateDashboardProps) {
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [status, setStatus] = useState<AffiliateStatus | null>(null);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [clicks, setClicks] = useState<AffiliateClick[]>([]);
  const [conversions, setConversions] = useState<AffiliateConversion[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<AffiliatePaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ====== Estado: Dados de Recebimento ======
  const [pmForm, setPmForm] = useState<{
    method: AffiliatePayoutMethod;
    pixKeyType: AffiliatePixKeyType;
    pixKey: string;
    mpEmail: string;
  }>({
    method: "pix",
    pixKeyType: "cpf_cnpj",
    pixKey: "",
    mpEmail: "",
  });
  const [savingPm, setSavingPm] = useState(false);
  const [pmMsg, setPmMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pmEditing, setPmEditing] = useState(false);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ method: "pix" as "pix" | "mercado_pago", pix_key: "", amount: "" });
  const [submitting, setSubmitting] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");

  const referralLink = tenantSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenantSlug}?ref=${userId}` : "";

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [settingsRes, statusRes, summaryRes, clicksRes, conversionsRes, payoutsRes, pmRes] = await Promise.all([
        fetch("/api/affiliate/settings").then(r => r.json()),
        fetch("/api/affiliate/status").then(r => r.json()),
        fetch("/api/affiliate/summary").then(r => r.json()),
        fetch("/api/affiliate/clicks").then(r => r.json()),
        fetch("/api/affiliate/conversions").then(r => r.json()),
        fetch("/api/affiliate/payouts").then(r => r.json()),
        fetch("/api/affiliate/payment-method").then(r => r.json()),
      ]);

      if (settingsRes.success) setSettings(settingsRes.data);
      if (statusRes.success) setStatus(statusRes.data);
      if (summaryRes.success) setSummary(summaryRes.data);
      if (clicksRes.success) setClicks(clicksRes.data);
      if (conversionsRes.success) setConversions(conversionsRes.data);
      if (payoutsRes.success) setPayouts(payoutsRes.data);
      if (pmRes.success && pmRes.data) {
        setPaymentMethod(pmRes.data);
        // Pré-popula o formulário com os dados atuais
        setPmForm({
          method: pmRes.data.method || "pix",
          pixKeyType: pmRes.data.pix_key_type || "cpf_cnpj",
          pixKey: pmRes.data.pix_key || "",
          mpEmail: pmRes.data.mp_email || "",
        });
      }
    } catch (err) {
      setError("Erro ao carregar dados do programa de afiliados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function activateAffiliate() {
    try {
      const res = await fetch("/api/affiliate/activate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatus({ ...status!, is_active: true, accepted_terms_at: new Date().toISOString(), accepted_terms_version: 1 });
        setShowTermsModal(false);
      } else {
        alert(data.error || "Erro ao ativar");
      }
    } catch {
      alert("Erro ao ativar");
    }
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    alert("Link copiado!");
  }

  async function savePaymentMethod() {
    setSavingPm(true);
    setPmMsg(null);
    try {
      // Validação client-side antes de enviar
      if (pmForm.method === "pix") {
        if (!pmForm.pixKeyType) {
          setPmMsg({ ok: false, text: "Selecione o tipo de chave PIX." });
          setSavingPm(false);
          return;
        }
        if (!isValidPixKey(pmForm.pixKey, pmForm.pixKeyType)) {
          setPmMsg({ ok: false, text: "Chave PIX inválida para o tipo selecionado." });
          setSavingPm(false);
          return;
        }
      } else {
        if (!isValidMpEmail(pmForm.mpEmail)) {
          setPmMsg({ ok: false, text: "E-mail do Mercado Pago inválido." });
          setSavingPm(false);
          return;
        }
      }

      const payload: Record<string, unknown> = { method: pmForm.method };
      if (pmForm.method === "pix") {
        payload.pixKeyType = pmForm.pixKeyType;
        payload.pixKey = pmForm.pixKey.trim();
      } else {
        payload.mpEmail = pmForm.mpEmail.trim();
      }

      const res = await fetch("/api/affiliate/payment-method", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentMethod(data.data);
        setPmEditing(false);
        setPmMsg({ ok: true, text: "Dados de recebimento salvos com sucesso!" });
      } else {
        setPmMsg({ ok: false, text: data.error || "Erro ao salvar." });
      }
    } catch {
      setPmMsg({ ok: false, text: "Erro ao salvar dados de recebimento." });
    } finally {
      setSavingPm(false);
    }
  }

  async function requestPayout() {
    if (!payoutAmount) {
      alert("Informe o valor do saque");
      return;
    }

    // Regra: afiliado DEVE ter dados de recebimento cadastrados.
    if (!paymentMethod) {
      alert(
        "Cadastre seus dados de recebimento antes de solicitar um saque."
      );
      // Faz scroll para a seção de cadastro
      const el = document.getElementById("affiliate-payment-method-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < (settings?.min_payout_amount || 50)) {
      alert(`Valor mínimo para saque: ${formatBRL((settings?.min_payout_amount || 50) * 100)}`);
      return;
    }
    if (amount > (summary?.available_balance || 0)) {
      alert("Saldo insuficiente");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          // Não envia mais method/pix_key — o backend usa o payment_method
          // cadastrado como fonte da verdade + faz snapshot.
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPayoutModal(false);
        setPayoutAmount("");
        setPayoutForm({ method: "pix", pix_key: "", amount: "" });
        fetchData();
      } else {
        alert(data.error || "Erro ao solicitar saque");
      }
    } catch {
      alert("Erro ao solicitar saque");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-center py-8">{error}</div>;
  }

  const programActive = settings?.program_active && status?.is_active;
  const notActivated = !status?.is_active;
  const allowInactiveSite = settings?.allow_inactive_site_affiliate !== false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Programa de Afiliados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Indique consultoras doTERRA e ganhe comissão por cada ativação de site.
        </p>
      </div>

      {/* Status do Programa */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title">Status do Programa</h2>
          <StatusBadge status={programActive ? "active" : "pending"} />
        </div>
        {notActivated && settings?.program_active && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
            <p className="text-sm text-amber-800 mb-3">
              <strong>Programa não ativado:</strong> Aceite os termos para começar a ganhar comissões.
            </p>
            <Button onClick={() => setShowTermsModal(true)}>Ativar Minha Participação</Button>
          </div>
        )}
        {!settings?.program_active && (
          <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 mb-4">
            <p className="text-sm text-gray-600">
              <strong>Programa pausado:</strong> O programa de afiliados está temporariamente desativado pela administração.
            </p>
          </div>
        )}

        {/* Cenário 1: site do afiliado está inativo E o Super Admin PERMITE
            indicações sem site ativo. */}
        {programActive && !siteActive && allowInactiveSite && (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-800">
                <strong>Seu site ainda não está ativado.</strong> Mas você já pode divulgar
                seu link de afiliado e indicar novos clientes.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Seu link de indicação: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{referralLink}</code>
            </p>
            <p className="text-xs text-gray-500">
              Ative seu site para disponibilizar sua própria página profissional.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={copyReferralLink} variant="outline">📋 Copiar Link</Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Conheça a plataforma TopConsultores para consultoras doTERRA: ${referralLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-green flex items-center gap-2"
              >
                📱 Compartilhar no WhatsApp
              </a>
              <a
                href="/painel/assinatura"
                className="btn btn-primary flex items-center gap-2"
              >
                🚀 Ativar meu site
              </a>
            </div>
          </div>
        )}

        {/* Cenário 2: site do afiliado está inativo E o Super Admin BLOQUEOU
            indicações sem site ativo. */}
        {programActive && !siteActive && !allowInactiveSite && (
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-100 border border-gray-200 p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Seu site ainda não está ativado.</strong>
              </p>
              <p className="text-sm text-gray-600">
                No momento, as indicações de afiliados estão disponíveis somente para
                usuários com site ativo.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Ative seu site para começar a divulgar seu link de afiliado.
              </p>
            </div>
            <a
              href="/painel/assinatura"
              className="btn btn-primary flex items-center gap-2 w-fit"
            >
              🚀 Ativar meu site
            </a>
          </div>
        )}

        {/* Cenário 3: site do afiliado está ativo (comportamento padrão). */}
        {programActive && siteActive && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Seu link de indicação: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{referralLink}</code>
            </p>
            <div className="flex gap-2">
              <Button onClick={copyReferralLink} variant="outline">📋 Copiar Link</Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Conheça a plataforma TopConsultores para consultoras doTERRA: ${referralLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-green flex items-center gap-2"
              >
                📱 Compartilhar no WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Resumo */}
      {programActive && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Cliques no link" value={summary.total_clicks} icon="🔗" />
          <StatCard label="Conversões" value={summary.total_conversions} icon="✅" />
          <StatCard label="Saldo disponível" value={formatBRL(summary.available_balance * 100)} icon="💰" sub="Pronto para saque" />
          <StatCard label="Saldo pendente" value={formatBRL(summary.pending_balance * 100)} icon="⏳" sub="Aguardando aprovação" />
        </div>
      )}

      {/* Solicitar Saque */}
      {programActive && summary && summary.available_balance > 0 && (
        <div className="card">
          <h2 className="card-title mb-3">Solicitar Saque</h2>
          <p className="text-sm text-gray-500 mb-4">
            Saldo disponível: <strong>{formatBRL(summary.available_balance * 100)}</strong> | Mínimo: {formatBRL((settings?.min_payout_amount || 50) * 100)}
          </p>
          {!paymentMethod && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-3">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Cadastre seus dados de recebimento antes de solicitar um saque.</strong>
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Você pode cadastrar abaixo na seção <em>Dados para recebimento</em>.
              </p>
            </div>
          )}
          <Button
            onClick={() => {
              if (!paymentMethod) {
                const el = document.getElementById("affiliate-payment-method-section");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
              }
              setShowPayoutModal(true);
            }}
            disabled={!paymentMethod}
            className={!paymentMethod ? "opacity-50 cursor-not-allowed" : ""}
          >
            Solicitar Saque
          </Button>
        </div>
      )}

      {/* ============================================================
          DADOS PARA RECEBIMENTO — afiliação cadastra PIX ou Mercado Pago
          ============================================================ */}
      {programActive && (
        <div id="affiliate-payment-method-section" className="card">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <h2 className="card-title mb-1">💰 Dados para recebimento</h2>
              <p className="text-sm text-gray-500">
                Escolha como deseja receber suas comissões. Esses dados serão
                utilizados quando você solicitar um saque.
              </p>
            </div>
            {paymentMethod && !pmEditing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 text-xs px-2 py-1 border border-green-200">
                ✓ Dados de recebimento cadastrados
              </span>
            )}
          </div>

          {paymentMethod && !pmEditing && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mt-3">
              <p className="text-sm text-gray-700">
                <strong>Método:</strong>{" "}
                {paymentMethod.method === "pix"
                  ? `PIX (${PIX_KEY_TYPE_OPTIONS.find((o => o.value === paymentMethod.pix_key_type))?.label || "—"})`
                  : "Mercado Pago"}
              </p>
              {paymentMethod.method === "pix" && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Chave PIX:</strong>{" "}
                  <code className="bg-white px-2 py-1 rounded text-xs border border-gray-200 break-all">
                    {paymentMethod.pix_key}
                  </code>
                </p>
              )}
              {paymentMethod.method === "mercado_pago" && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>E-mail Mercado Pago:</strong>{" "}
                  <code className="bg-white px-2 py-1 rounded text-xs border border-gray-200">
                    {paymentMethod.mp_email}
                  </code>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Atualizado em {formatDate(paymentMethod.updated_at)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={() => { setPmEditing(true); setPmMsg(null); }}>
                  Editar dados
                </Button>
              </div>
            </div>
          )}

          {(!paymentMethod || pmEditing) && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">💰 Como você quer receber suas comissões?</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 max-w-md">
                <button
                  type="button"
                  onClick={() => setPmForm({ ...pmForm, method: "pix" })}
                  className={`btn !py-3 ${pmForm.method === "pix" ? "btn-primary" : "btn-outline"}`}
                >
                  PIX
                </button>
                <button
                  type="button"
                  onClick={() => setPmForm({ ...pmForm, method: "mercado_pago" })}
                  className={`btn !py-3 ${pmForm.method === "mercado_pago" ? "btn-primary" : "btn-outline"}`}
                >
                  Mercado Pago
                </button>
              </div>

              {pmForm.method === "pix" && (
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="label">Tipo de chave PIX</label>
                    <select
                      className="input"
                      value={pmForm.pixKeyType}
                      onChange={(e) => setPmForm({ ...pmForm, pixKeyType: e.target.value as AffiliatePixKeyType, pixKey: "" })}
                    >
                      {PIX_KEY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Chave PIX</label>
                    <Input
                      placeholder={PIX_KEY_TYPE_PLACEHOLDERS[pmForm.pixKeyType]}
                      value={pmForm.pixKey}
                      onChange={(e) => setPmForm({ ...pmForm, pixKey: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {pmForm.method === "mercado_pago" && (
                <div className="space-y-2 max-w-md">
                  <label className="label">E-mail da conta Mercado Pago</label>
                  <Input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={pmForm.mpEmail}
                    onChange={(e) => setPmForm({ ...pmForm, mpEmail: e.target.value })}
                  />
                </div>
              )}

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                <strong>Importante:</strong> cadastre uma conta que esteja em seu nome/responsabilidade e revise os dados antes de solicitar um saque.
              </div>

              {pmMsg && (
                <p className={`text-sm rounded-lg px-3 py-2 ${pmMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {pmMsg.text}
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={savePaymentMethod} disabled={savingPm}>
                  {savingPm ? "Salvando..." : pmEditing ? "Atualizar dados" : "Salvar dados"}
                </Button>
                {pmEditing && (
                  <Button variant="outline" onClick={() => {
                    setPmEditing(false);
                    setPmMsg(null);
                    // Restaura o formulário com os valores atuais
                    if (paymentMethod) {
                      setPmForm({
                        method: paymentMethod.method || "pix",
                        pixKeyType: paymentMethod.pix_key_type || "cpf_cnpj",
                        pixKey: paymentMethod.pix_key || "",
                        mpEmail: paymentMethod.mp_email || "",
                      });
                    }
                  }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversões */}
      {programActive && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Conversões Recentes</h2>
          </div>
          {conversions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma conversão registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Cliente</th>
                    <th className="pb-2">Venda</th>
                    <th className="pb-2">Comissão</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.slice(0, 20).map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600">{formatDate(c.created_at)}</td>
                      <td className="py-3 text-gray-600">{c.new_customer_user_id.slice(0, 8)}...</td>
                      <td className="py-3 text-gray-600">{formatBRL(c.sale_amount * 100)}</td>
                      <td className="py-3 font-medium text-[#1d5c3a]">{formatBRL(c.commission_amount * 100)}</td>
                      <td className="py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Saques */}
      {programActive && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Histórico de Saques</h2>
          </div>
          {payouts.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum saque solicitado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Valor</th>
                    <th className="pb-2">Método</th>
                    <th className="pb-2">Dados de pagamento</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => {
                    const label = p.payment_method_label
                      || (p.method === "pix" ? "PIX" : "Mercado Pago");
                    const pixKey = p.pix_key_snapshot || p.pix_key;
                    const mpEmail = p.mp_email_snapshot;
                    return (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="py-3 text-gray-600">{formatDate(p.requested_at)}</td>
                        <td className="py-3 font-medium text-[#1d5c3a]">{formatBRL(p.amount * 100)}</td>
                        <td className="py-3 text-gray-600">{label}</td>
                        <td className="py-3 text-gray-600 text-xs">
                          {p.method === "pix"
                            ? (pixKey || "—")
                            : (mpEmail || "—")}
                        </td>
                        <td className="py-3"><StatusBadge status={p.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cliques */}
      {programActive && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Cliques Recentes (últimos 50)</h2>
          </div>
          {clicks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum clique registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Subdomínio</th>
                    <th className="pb-2">Convertido</th>
                  </tr>
                </thead>
                <tbody>
                  {clicks.slice(0, 50).map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600">{formatDate(c.clicked_at)}</td>
                      <td className="py-3 text-gray-600">{c.source_subdomain}</td>
                      <td className="py-3">
                        {c.converted ? (
                          <span className="badge badge-green">Sim</span>
                        ) : (
                          <span className="badge badge-gray">Não</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Termos */}
      {showTermsModal && (
        <Modal open onClose={() => setShowTermsModal(false)} title="Termos do Programa de Afiliados">
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            <p className="text-sm text-gray-600">
              Ao ativar sua participação no Programa de Afiliados TopConsultores, você concorda com:
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li>Comissão de <strong>{settings?.commission_percent || 10}%</strong> sobre o valor da ativação de cada novo usuário indicado.</li>
              <li>Atribuição por <strong>first-click</strong> (primeiro clique vence) com cookie de <strong>{settings?.cookie_max_age_days || 180} dias</strong>.</li>
              <li>Saque mínimo de <strong>{formatBRL((settings?.min_payout_amount || 50) * 100)}</strong> via PIX ou Mercado Pago.</li>
              <li>Conversões ficam <strong>pendentes por 30 dias</strong> antes de serem aprovadas automaticamente.</li>
              <li>O programa pode ser alterado ou encerrado a qualquer momento pela administração.</li>
            </ul>
            <p className="text-xs text-gray-500">Versão dos termos: 1.0</p>
            <div className="flex gap-3 pt-4">
              <Button onClick={activateAffiliate} className="flex-1">Aceito e Ativo Minha Participação</Button>
              <Button variant="outline" onClick={() => setShowTermsModal(false)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Saque */}
      {showPayoutModal && (
        <Modal open onClose={() => setShowPayoutModal(false)} title="Solicitar Saque">
          <div className="space-y-4">
            {paymentMethod && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
                <strong>Dados de pagamento cadastrados:</strong>
                <div className="mt-1 text-gray-700">
                  {paymentMethod.method === "pix"
                    ? `PIX (${PIX_KEY_TYPE_OPTIONS.find((o) => o.value === paymentMethod.pix_key_type)?.label || ""}) — ${paymentMethod.pix_key}`
                    : `Mercado Pago — ${paymentMethod.mp_email}`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Estes dados serão utilizados para o pagamento desta solicitação.
                  O histórico do saque preserva os dados cadastrados no momento do pedido.
                </p>
              </div>
            )}
            <div>
              <label className="label">Valor do saque</label>
              <Input
                type="number"
                step="0.01"
                min={settings?.min_payout_amount || 50}
                max={summary?.available_balance || 0}
                placeholder={formatBRL((summary?.available_balance || 0) * 100)}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Disponível: {formatBRL((summary?.available_balance || 0) * 100)}
                {settings?.min_payout_amount && (
                  <> · Mínimo: {formatBRL(settings.min_payout_amount * 100)}</>
                )}
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={requestPayout} disabled={submitting} className="flex-1">
                {submitting ? "Enviando..." : "Confirmar Saque"}
              </Button>
              <Button variant="outline" onClick={() => setShowPayoutModal(false)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}