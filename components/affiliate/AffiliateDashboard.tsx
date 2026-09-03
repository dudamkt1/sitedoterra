"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL, formatDate } from "@/lib/utils";
import { StatCard, StatusBadge, Button, Input, Modal } from "@/components/dashboard/ui";

interface AffiliateSettings {
  commission_percent: number;
  min_payout_amount: number;
  program_active: boolean;
  cookie_max_age_days: number;
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
}

export function AffiliateDashboard({ userId, userEmail, userName, tenantSlug, isDemo }: AffiliateDashboardProps) {
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [status, setStatus] = useState<AffiliateStatus | null>(null);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [clicks, setClicks] = useState<AffiliateClick[]>([]);
  const [conversions, setConversions] = useState<AffiliateConversion[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const [settingsRes, statusRes, summaryRes, clicksRes, conversionsRes, payoutsRes] = await Promise.all([
        fetch("/api/affiliate/settings").then(r => r.json()),
        fetch("/api/affiliate/status").then(r => r.json()),
        fetch("/api/affiliate/summary").then(r => r.json()),
        fetch("/api/affiliate/clicks").then(r => r.json()),
        fetch("/api/affiliate/conversions").then(r => r.json()),
        fetch("/api/affiliate/payouts").then(r => r.json()),
      ]);

      if (settingsRes.success) setSettings(settingsRes.data);
      if (statusRes.success) setStatus(statusRes.data);
      if (summaryRes.success) setSummary(summaryRes.data);
      if (clicksRes.success) setClicks(clicksRes.data);
      if (conversionsRes.success) setConversions(conversionsRes.data);
      if (payoutsRes.success) setPayouts(payoutsRes.data);
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

  async function requestPayout() {
    if (!payoutForm.pix_key || !payoutAmount) {
      alert("Preencha todos os campos");
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
          method: payoutForm.method,
          amount,
          pix_key: payoutForm.pix_key,
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
        {programActive && (
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
          <Button onClick={() => setShowPayoutModal(true)}>Solicitar Saque</Button>
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
                    <th className="pb-2">Chave PIX</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600">{formatDate(p.requested_at)}</td>
                      <td className="py-3 font-medium text-[#1d5c3a]">{formatBRL(p.amount * 100)}</td>
                      <td className="py-3 text-gray-600 capitalize">{p.method.replace("_", " ")}</td>
                      <td className="py-3 text-gray-600 text-xs">{p.pix_key || "—"}</td>
                      <td className="py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
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
            <div>
              <label className="label">Método de pagamento</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="method" value="pix" checked={payoutForm.method === "pix"} onChange={(e) => setPayoutForm({ ...payoutForm, method: "pix" })} className="radio" />
                  <span>PIX</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="method" value="mercado_pago" checked={payoutForm.method === "mercado_pago"} onChange={(e) => setPayoutForm({ ...payoutForm, method: "mercado_pago" })} className="radio" />
                  <span>Mercado Pago</span>
                </label>
              </div>
            </div>
            {payoutForm.method === "pix" && (
              <div>
                <label className="label">Chave PIX</label>
                <Input
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  value={payoutForm.pix_key}
                  onChange={(e) => setPayoutForm({ ...payoutForm, pix_key: e.target.value })}
                />
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
              <p className="text-xs text-gray-400 mt-1">Disponível: {formatBRL((summary?.available_balance || 0) * 100)}</p>
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