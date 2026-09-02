"use client";

import { useState } from "react";
import { formatBRL, formatDate } from "@/lib/utils";
import { Button, Input, Modal, StatusBadge, Select, Checkbox } from "@/components/dashboard/ui";

interface AffiliateSettings {
  id: string;
  commission_percent: number;
  min_payout_amount: number;
  program_active: boolean;
  terms_version: number;
  cookie_max_age_days: number;
}

interface Affiliate {
  id: string;
  user_id: string;
  is_active: boolean;
  accepted_terms_at: string | null;
  profiles: { email: string; name: string; user_id: string; created_at: string };
}

interface Conversion {
  id: string;
  sale_amount: number;
  commission_amount: number;
  commission_percent_at_time: number;
  status: "pendente" | "aprovado" | "pago" | "estornado";
  created_at: string;
  new_customer_user_id: string;
  affiliate_status: { user_id: string };
  profiles: { email: string; name: string };
}

interface Payout {
  id: string;
  amount: number;
  method: "pix" | "mercado_pago";
  status: "solicitado" | "em_analise" | "pago" | "rejeitado";
  requested_at: string;
  paid_at: string | null;
  pix_key: string | null;
  profiles: { email: string; name: string };
}

interface AdminAffiliateDashboardProps {
  settings: AffiliateSettings;
  affiliates: Affiliate[];
  conversions: Conversion[];
  payouts: Payout[];
}

export function AdminAffiliateDashboard({ settings, affiliates, conversions, payouts }: AdminAffiliateDashboardProps) {
  const [editingSettings, setEditingSettings] = useState(false);
  const [formSettings, setFormSettings] = useState({
    commission_percent: settings?.commission_percent || 10,
    min_payout_amount: settings?.min_payout_amount || 50,
    program_active: settings?.program_active || true,
    cookie_max_age_days: settings?.cookie_max_age_days || 180,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [conversionFilter, setConversionFilter] = useState<"all" | "pendente" | "aprovado" | "pago" | "estornado">("all");
  const [payoutFilter, setPayoutFilter] = useState<"all" | "solicitado" | "em_analise" | "pago" | "rejeitado">("all");

  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutAction, setPayoutAction] = useState<"approve" | "reject" | "pay" | null>(null);
  const [payoutNote, setPayoutNote] = useState("");

  const filteredConversions = conversionFilter === "all" ? conversions : conversions.filter(c => c.status === conversionFilter);
  const filteredPayouts = payoutFilter === "all" ? payouts : payouts.filter(p => p.status === payoutFilter);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/affiliate/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formSettings),
      });
      const data = await res.json();
      if (data.success) {
        setEditingSettings(false);
        window.location.reload();
      } else {
        alert(data.error || "Erro ao salvar");
      }
    } catch {
      alert("Erro ao salvar");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handlePayoutAction(action: "approve" | "reject" | "pay", payout: Payout) {
    setSelectedPayout(payout);
    setPayoutAction(action);
    setPayoutNote("");
  }

  async function confirmPayoutAction() {
    if (!selectedPayout || !payoutAction) return;
    try {
      const res = await fetch(`/api/admin/affiliate/payout/${selectedPayout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: payoutAction, note: payoutNote }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedPayout(null);
        setPayoutAction(null);
        window.location.reload();
      } else {
        alert(data.error || "Erro");
      }
    } catch {
      alert("Erro");
    }
  }

  // Estatísticas globais
  const totalAffiliates = affiliates.length;
  const totalConversions = conversions.length;
  const pendingConversions = conversions.filter(c => c.status === "pendente").length;
  const approvedConversions = conversions.filter(c => c.status === "aprovado").length;
  const totalCommissions = conversions
    .filter(c => c.status === "aprovado" || c.status === "pago")
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const pendingPayouts = payouts.filter(p => p.status === "solicitado").length;
  const totalPayoutsPaid = payouts.filter(p => p.status === "pago").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Programa de Afiliados (Admin)</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie configurações, afiliados, conversões e saques.</p>
      </div>

      {/* Configurações Globais */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title">Configurações Globais</h2>
          <Button onClick={() => setEditingSettings(true)} disabled={editingSettings}>
            {editingSettings ? "Salvando..." : "Editar"}
          </Button>
        </div>

        {editingSettings ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">% Comissão por ativação</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formSettings.commission_percent}
                onChange={(e) => setFormSettings({ ...formSettings, commission_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="label">Mínimo para saque (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formSettings.min_payout_amount}
                onChange={(e) => setFormSettings({ ...formSettings, min_payout_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="label">Duração do cookie (dias)</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={formSettings.cookie_max_age_days}
                onChange={(e) => setFormSettings({ ...formSettings, cookie_max_age_days: parseInt(e.target.value) || 180 })}
              />
            </div>
            <div className="flex items-end">
              <Checkbox
                checked={formSettings.program_active}
                onChange={(e) => { setFormSettings({ ...formSettings, program_active: e.target.checked }); }}
                label="Programa ativo"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div><p className="text-gray-500">% Comissão</p><p className="font-semibold">{settings?.commission_percent}%</p></div>
            <div><p className="text-gray-500">Mín. saque</p><p className="font-semibold">{formatBRL((settings?.min_payout_amount || 50) * 100)}</p></div>
            <div><p className="text-gray-500">Cookie</p><p className="font-semibold">{settings?.cookie_max_age_days} dias</p></div>
            <div><p className="text-gray-500">Status</p><p className="font-semibold"><StatusBadge status={settings?.program_active ? "active" : "pending"} /></p></div>
          </div>
        )}

        {editingSettings && (
          <div className="flex gap-3 mt-4">
            <Button onClick={saveSettings} disabled={savingSettings} className="flex-1">
              Salvar
            </Button>
            <Button variant="outline" onClick={() => { setFormSettings({ commission_percent: settings?.commission_percent || 10, min_payout_amount: settings?.min_payout_amount || 50, program_active: settings?.program_active || true, cookie_max_age_days: settings?.cookie_max_age_days || 180 }); setEditingSettings(false); }}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="card p-4"><p className="text-gray-500 text-sm">Afiliados ativos</p><p className="text-3xl font-bold">{totalAffiliates}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-sm">Total conversões</p><p className="text-3xl font-bold">{totalConversions}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-sm">Pendentes</p><p className="text-3xl font-bold text-amber-600">{pendingConversions}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-sm">Aprovadas</p><p className="text-3xl font-bold text-green-600">{approvedConversions}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-sm">Total comissões</p><p className="text-3xl font-bold text-[#1d5c3a]">{formatBRL(totalCommissions * 100)}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-sm">Saques pagos</p><p className="text-3xl font-bold">{formatBRL(totalPayoutsPaid * 100)}</p></div>
      </div>

      {/* Afiliados */}
      <div className="card">
        <h2 className="card-title mb-4">Afiliados Ativos ({totalAffiliates})</h2>
        {affiliates.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum afiliado ativo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2">Usuário</th>
                  <th className="pb-2">E-mail</th>
                  <th className="pb-2">Cadastro</th>
                  <th className="pb-2">Termos aceitos</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-3 font-medium">{a.profiles.name || "—"}</td>
                    <td className="py-3 text-gray-600">{a.profiles.email}</td>
                    <td className="py-3 text-gray-600">{formatDate(a.profiles.created_at)}</td>
                    <td className="py-3 text-gray-600">{a.accepted_terms_at ? formatDate(a.accepted_terms_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conversões */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title">Conversões ({conversions.length})</h2>
          <Select value={conversionFilter} onChange={(e) => setConversionFilter(e.target.value as typeof conversionFilter)} className="w-auto">
            <option value="all">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovados</option>
            <option value="pago">Pagos</option>
            <option value="estornado">Estornados</option>
          </Select>
        </div>
        {filteredConversions.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhuma conversão.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Afiliado</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Venda</th>
                  <th className="pb-2">% Comissão</th>
                  <th className="pb-2">Comissão</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversions.slice(0, 100).map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-600">{formatDate(c.created_at)}</td>
                    <td className="py-3 text-gray-600">{c.affiliate_status.user_id.slice(0, 8)}...</td>
                    <td className="py-3 text-gray-600">{c.profiles.name || c.profiles.email}</td>
                    <td className="py-3 text-gray-600">{formatBRL(c.sale_amount * 100)}</td>
                    <td className="py-3 text-gray-600">{c.commission_percent_at_time}%</td>
                    <td className="py-3 font-medium text-[#1d5c3a]">{formatBRL(c.commission_amount * 100)}</td>
                    <td className="py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saques */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title">Solicitações de Saque ({payouts.length})</h2>
          <Select value={payoutFilter} onChange={(e) => setPayoutFilter(e.target.value as typeof payoutFilter)} className="w-auto">
            <option value="all">Todos</option>
            <option value="solicitado">Solicitados</option>
            <option value="em_analise">Em análise</option>
            <option value="pago">Pagos</option>
            <option value="rejeitado">Rejeitados</option>
          </Select>
        </div>
        {filteredPayouts.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum saque.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Afiliado</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Método</th>
                  <th className="pb-2">Chave PIX</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-600">{formatDate(p.requested_at)}</td>
                    <td className="py-3 text-gray-600">{p.profiles.name || p.profiles.email}</td>
                    <td className="py-3 font-medium text-[#1d5c3a]">{formatBRL(p.amount * 100)}</td>
                    <td className="py-3 text-gray-600 capitalize">{p.method.replace("_", " ")}</td>
                    <td className="py-3 text-gray-600 text-xs">{p.pix_key || "—"}</td>
                    <td className="py-3"><StatusBadge status={p.status} /></td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {p.status === "solicitado" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handlePayoutAction("approve", p)}>✓ Aprovar</Button>
                            <Button size="sm" variant="outline" onClick={() => handlePayoutAction("reject", p)}>✗ Rejeitar</Button>
                          </>
                        )}
                        {p.status === "aprovado" && (
                          <Button size="sm" variant="outline" onClick={() => handlePayoutAction("pay", p)}>💰 Pagar</Button>
                        )}
                        {p.status === "pago" && <span className="text-xs text-green-600">Pago em {p.paid_at ? formatDate(p.paid_at) : "—"}</span>}
                        {p.status === "rejeitado" && <span className="text-xs text-red-600">Rejeitado</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Configurações (já embutido inline) */}

      {/* Modal Ação Saque */}
      {selectedPayout && payoutAction && (
        <Modal open onClose={() => { setSelectedPayout(null); setPayoutAction(null); }} title={payoutAction === "approve" ? "Aprovar Saque" : payoutAction === "reject" ? "Rejeitar Saque" : "Marcar como Pago"}>
          <div className="space-y-4">
            <p>
              Afiliado: <strong>{selectedPayout.profiles.name || selectedPayout.profiles.email}</strong><br />
              Valor: <strong>{formatBRL(selectedPayout.amount * 100)}</strong><br />
              Método: <strong>{selectedPayout.method.replace("_", " ")}</strong><br />
              Chave PIX: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{selectedPayout.pix_key || "—"}</code>
            </p>
            {payoutAction !== "pay" && (
              <div>
                <label className="label">Observação (opcional)</label>
                <textarea
                  className="input min-h-24"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  placeholder={payoutAction === "reject" ? "Motivo da rejeição..." : "Observação interna..."}
                />
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button onClick={confirmPayoutAction} className="flex-1" variant={payoutAction === "reject" ? "destructive" : "primary"}>
                Confirmar {payoutAction === "approve" ? "Aprovação" : payoutAction === "reject" ? "Rejeição" : "Pagamento"}
              </Button>
              <Button variant="outline" onClick={() => { setSelectedPayout(null); setPayoutAction(null); }}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}