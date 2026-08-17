"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { CLIENT_CATEGORY_COLORS, TIMELINE_EVENT_TYPES, TIMELINE_EVENT_ICONS } from "@/lib/crm-shared";
import { exportClientPdf } from "@/lib/crm-export";
import type { CrmClient, CrmSale, CrmTimelineEvent, CrmClientNote, CrmCharge, CrmTask, CrmLoyaltyPoint, CrmSettings } from "@/types";

interface DetailData {
  client: CrmClient;
  sales: CrmSale[];
  timeline: CrmTimelineEvent[];
  notes: CrmClientNote[];
  charges: CrmCharge[];
  tasks: CrmTask[];
  points: CrmLoyaltyPoint[];
  settings: CrmSettings;
  level: string;
  levels: { name: string; min_points: number }[];
  consultant_name?: string | null;
  site_name?: string | null;
}

const TABS = ["Timeline", "Dados", "Compras", "Cobranças", "Fidelidade", "Anotações", "Tarefas"] as const;
type Tab = (typeof TABS)[number];

export default function CrmClientDetail({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Timeline");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // edit form
  const [form, setForm] = useState<Record<string, string>>({});
  const [timelineForm, setTimelineForm] = useState({ event_type: "manual", title: "", description: "" });
  const [noteForm, setNoteForm] = useState("");
  const [pointsForm, setPointsForm] = useState({ amount: "", type: "ajuste", description: "" });
  const [showEdit, setShowEdit] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar cliente.");
      setData(json);
      const c = json.client;
      setForm({
        name: c.name, cpf: c.cpf || "", birth_date: c.birth_date || "", email: c.email || "",
        phone: c.phone || "", whatsapp: c.whatsapp || "", city: c.city || "", state: c.state || "",
        notes: c.notes || "", category: c.category, first_contact_at: c.first_contact_at || "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar cliente.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState label="Carregando ficha do cliente..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const c = data.client;
  const categories = data.settings?.categories?.length
    ? data.settings.categories
    : ["Lead", "Novo cliente", "Cliente ativo", "Cliente recorrente", "Cliente VIP", "Cliente inativo", "Cliente perdido"];

  async function saveEdit() {
    setSaving(true);
    try {
      await apiPut(`/api/crm/clients/${clientId}`, form);
      setToast({ ok: true, text: "Dados atualizados!" });
      setShowEdit(false);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function addTimeline() {
    if (!timelineForm.title.trim()) return;
    setSaving(true);
    try {
      await apiPost(`/api/crm/clients/${clientId}/timeline`, { ...timelineForm, event_at: new Date().toISOString() });
      setTimelineForm({ event_type: "manual", title: "", description: "" });
      setToast({ ok: true, text: "Evento adicionado!" });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao adicionar." });
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!noteForm.trim()) return;
    try {
      await apiPost(`/api/crm/clients/${clientId}/notes`, { note: noteForm });
      setNoteForm("");
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar anotação." });
    }
  }

  async function addPoints() {
    const amount = parseInt(pointsForm.amount);
    if (isNaN(amount) || amount === 0) return;
    try {
      await apiPost("/api/crm/loyalty/points", { client_id: clientId, amount, type: pointsForm.type, description: pointsForm.description });
      setPointsForm({ amount: "", type: "ajuste", description: "" });
      setToast({ ok: true, text: "Pontos registrados!" });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao registrar pontos." });
    }
  }

  async function markChargePaid(ch: CrmCharge) {
    try {
      await apiPut(`/api/crm/charges/${ch.id}`, { status: "Pago" });
      setToast({ ok: true, text: "Cobrança marcada como paga!" });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao atualizar." });
    }
  }

  async function removeClient() {
    if (!confirmDialog(`Excluir definitivamente o cliente "${c.name}"? Esta ação não pode ser desfeita (LGPD).`)) return;
    try {
      await apiDelete(`/api/crm/clients/${clientId}`);
      router.push("/painel/crm/clientes");
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao excluir." });
    }
  }

  function handleClientPdf() {
    if (!data) return;
    exportClientPdf({
      client: c,
      sales: data.sales,
      timeline: data.timeline,
      notes: data.notes,
      charges: data.charges,
      consultant_name: null,
      site_name: null,
      level: data.level,
    });
  }

  const waLink = c.whatsapp ? `https://wa.me/55${c.whatsapp.replace(/\D/g, "")}` : null;

  return (
    <div>
      <Toast msg={toast} />

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{c.name} {c.is_vip && "⭐"}</h1>
              <span className={`badge ${CLIENT_CATEGORY_COLORS[c.category] || "badge-gray"}`}>{c.category}</span>
              {c.is_vip && <span className="badge badge-gold">VIP</span>}
              {data.level && <span className="badge badge-blue">{data.level}</span>}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {c.city || ""}{c.state ? `/${c.state}` : ""} {c.email && `· ${c.email}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-outline text-xs" onClick={handleClientPdf}>📄 Exportar PDF</button>
            <button className="btn btn-outline text-xs" onClick={() => setShowEdit(true)}>✏️ Editar dados</button>
            {waLink && (
              <a className="btn btn-gold text-xs" href={waLink} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            )}
            <button className="btn btn-danger text-xs" onClick={removeClient}>🗑 Excluir</button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
          {[
            { label: "Total gasto", value: formatBRL(c.total_spent_cents || 0) },
            { label: "Compras", value: String(c.purchase_count || 0) },
            { label: "Ticket médio", value: formatBRL(c.ticket_avg_cents || 0) },
            { label: "Pontos", value: String(c.points_balance || 0) },
            { label: "Última compra", value: c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
              <p className="mt-1 text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mt-6 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium border ${
              tab === t ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t}
            {t === "Timeline" && ` (${data.timeline.length})`}
          </button>
        ))}
      </div>

      <div className="card mt-4">
        {/* TIMELINE */}
        {tab === "Timeline" && (
          <div>
            <h2 className="card-title mb-4">Linha do tempo</h2>
            <form
              className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr_auto] gap-2 mb-6"
              onSubmit={(e) => { e.preventDefault(); addTimeline(); }}
            >
              <select className="input" value={timelineForm.event_type} onChange={(e) => setTimelineForm((f) => ({ ...f, event_type: e.target.value }))}>
                {Object.entries(TIMELINE_EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="input" placeholder="Título do evento (ex.: Nova compra)" value={timelineForm.title} onChange={(e) => setTimelineForm((f) => ({ ...f, title: e.target.value }))} />
              <input className="input" placeholder="Descrição (opcional)" value={timelineForm.description} onChange={(e) => setTimelineForm((f) => ({ ...f, description: e.target.value }))} />
              <button className="btn btn-primary" disabled={saving || !timelineForm.title.trim()}>+ Adicionar</button>
            </form>
            {data.timeline.length === 0 ? (
              <EmptyState icon="📌" title="Nenhum evento na linha do tempo ainda." sub="Registre contatos, compras e mensagens para acompanhar a história do cliente." />
            ) : (
              <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
                {data.timeline.map((ev) => (
                  <li key={ev.id} className="ml-4">
                    <span className="absolute -left-2 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border-2 border-[#1d5c3a] text-[0.5rem] text-[#1d5c3a]">
                      {TIMELINE_EVENT_ICONS[ev.event_type] || "•"}
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                        {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{new Date(ev.event_at).toLocaleString("pt-BR")}</span>
                        <button
                          className="text-gray-300 hover:text-red-500 text-xs"
                          onClick={async () => {
                            if (!confirmDialog("Remover este evento?")) return;
                            await apiDelete(`/api/crm/clients/${clientId}/timeline?eventId=${ev.id}`);
                            load();
                          }}
                        >✕</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* DADOS */}
        {tab === "Dados" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="card-title mb-3">Dados pessoais</h2>
              <dl className="divide-y divide-gray-100 text-sm">
                {[
                  ["Nome completo", c.name],
                  ["CPF", c.cpf || "—"],
                  ["Nascimento", c.birth_date ? new Date(c.birth_date).toLocaleDateString("pt-BR") : "—"],
                  ["E-mail", c.email || "—"],
                  ["Telefone", c.phone || "—"],
                  ["WhatsApp", c.whatsapp || "—"],
                  ["Cidade / Estado", `${c.city || "—"}${c.state ? "/" + c.state : ""}`],
                ].map(([k, v]) => (
                  <div key={k} className="py-2 flex justify-between gap-3">
                    <dt className="text-gray-400">{k}</dt>
                    <dd className="text-right font-medium text-gray-700">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="card-title mb-3">Dados comerciais</h2>
              <dl className="divide-y divide-gray-100 text-sm">
                {[
                  ["Categoria", c.category],
                  ["Status VIP", c.is_vip ? "Sim ⭐" : "Não"],
                  ["Primeiro contato", c.first_contact_at ? new Date(c.first_contact_at).toLocaleDateString("pt-BR") : "—"],
                  ["Primeira compra", c.first_purchase_at ? new Date(c.first_purchase_at).toLocaleDateString("pt-BR") : "—"],
                  ["Última compra", c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "—"],
                  ["Total comprado", formatBRL(c.total_spent_cents || 0)],
                  ["Ticket médio", formatBRL(c.ticket_avg_cents || 0)],
                  ["Número de compras", String(c.purchase_count || 0)],
                ].map(([k, v]) => (
                  <div key={k} className="py-2 flex justify-between gap-3">
                    <dt className="text-gray-400">{k}</dt>
                    <dd className="text-right font-medium text-gray-700">{v}</dd>
                  </div>
                ))}
              </dl>
              {c.notes && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-1">Observações</h3>
                  <p className="text-sm text-gray-500 whitespace-pre-line">{c.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMPRAS */}
        {tab === "Compras" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="card-title mb-0">Histórico de compras</h2>
              <a className="btn btn-primary text-xs" href={`/painel/crm/vendas?clientId=${clientId}`}>+ Nova venda para {c.name.split(" ")[0]}</a>
            </div>
            {data.sales.length === 0 ? (
              <EmptyState icon="🛒" title="Nenhuma compra registrada." sub="Registre a primeira venda deste cliente para acompanhar o histórico." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Data</th><th>Produtos</th><th>Desconto</th><th>Total</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.sale_date).toLocaleDateString("pt-BR")}</td>
                        <td className="text-sm">{(s.items || []).map((i) => `${i.product_name} x${i.quantity}`).join(", ") || "—"}</td>
                        <td>{s.discount_cents ? formatBRL(s.discount_cents) : "—"}</td>
                        <td className="font-medium">{formatBRL(s.total_cents)}</td>
                        <td><span className="badge badge-gray">{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* COBRANÇAS */}
        {tab === "Cobranças" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="card-title mb-0">Cobranças do cliente</h2>
              <a className="btn btn-primary text-xs" href={`/painel/crm/cobrancas?clientId=${clientId}`}>+ Nova cobrança</a>
            </div>
            {data.charges.length === 0 ? (
              <EmptyState icon="🧾" title="Nenhuma cobrança para este cliente." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {data.charges.map((ch) => (
                      <tr key={ch.id}>
                        <td>{new Date(ch.due_date).toLocaleDateString("pt-BR")}</td>
                        <td className="font-medium">{formatBRL(ch.amount_cents)}</td>
                        <td><span className={`badge ${ch.status === "Pago" ? "badge-green" : ch.status === "Vencido" ? "badge-red" : "badge-yellow"}`}>{ch.status}</span></td>
                        <td>
                          {ch.status !== "Pago" && ch.status !== "Cancelado" && (
                            <button className="text-xs text-[#1d5c3a] underline" onClick={() => markChargePaid(ch)}>Marcar como paga</button>
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

        {/* FIDELIDADE */}
        {tab === "Fidelidade" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="card-title mb-0">Pontos de fidelidade</h2>
              <span className="badge badge-gold">Saldo: {c.points_balance || 0} pts</span>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-[160px_160px_1fr_auto] gap-2 mb-6" onSubmit={(e) => { e.preventDefault(); addPoints(); }}>
              <input type="number" className="input" placeholder="Pontos (+/-)" value={pointsForm.amount} onChange={(e) => setPointsForm((f) => ({ ...f, amount: e.target.value }))} />
              <select className="input" value={pointsForm.type} onChange={(e) => setPointsForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="ajuste">Ajuste manual</option>
                <option value="indicacao">Indicação</option>
                <option value="aniversario">Aniversário</option>
                <option value="especial">Ação especial</option>
                <option value="resgate">Resgate</option>
              </select>
              <input className="input" placeholder="Descrição (opcional)" value={pointsForm.description} onChange={(e) => setPointsForm((f) => ({ ...f, description: e.target.value }))} />
              <button className="btn btn-primary">+ Adicionar</button>
            </form>
            {data.points.length === 0 ? (
              <EmptyState icon="🎁" title="Nenhum ponto registrado." sub="Conceda pontos por compra, indicação, aniversário ou ajuste manual." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Data</th><th>Pontos</th><th>Tipo</th><th>Descrição</th></tr>
                  </thead>
                  <tbody>
                    {data.points.map((p) => (
                      <tr key={p.id}>
                        <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className={`font-medium ${p.amount >= 0 ? "text-green-600" : "text-red-600"}`}>{p.amount >= 0 ? "+" : ""}{p.amount}</td>
                        <td>{p.type}</td>
                        <td className="text-sm text-gray-500">{p.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ANOTAÇÕES */}
        {tab === "Anotações" && (
          <div>
            <h2 className="card-title mb-4">Anotações</h2>
            <form className="flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); addNote(); }}>
              <input className="input flex-1" placeholder="Escreva uma anotação sobre este cliente..." value={noteForm} onChange={(e) => setNoteForm(e.target.value)} />
              <button className="btn btn-primary" disabled={!noteForm.trim()}>+ Anotar</button>
            </form>
            {data.notes.length === 0 ? (
              <EmptyState icon="📝" title="Nenhuma anotação ainda." />
            ) : (
              <ul className="space-y-3">
                {data.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{n.note}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <button
                      className="text-gray-300 hover:text-red-500 text-xs"
                      onClick={async () => {
                        if (!confirmDialog("Excluir anotação?")) return;
                        await apiDelete(`/api/crm/clients/${clientId}/notes?noteId=${n.id}`);
                        load();
                      }}
                    >✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* TAREFAS */}
        {tab === "Tarefas" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="card-title mb-0">Tarefas deste cliente</h2>
              <a className="btn btn-primary text-xs" href={`/painel/crm/tarefas?clientId=${clientId}`}>+ Nova tarefa</a>
            </div>
            {data.tasks.length === 0 ? (
              <EmptyState icon="✅" title="Nenhuma tarefa para este cliente." sub="Crie lembretes como 'Entrar em contato', 'Fazer pós-venda' ou 'Parabenizar'." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.tasks.map((t) => (
                  <li key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${t.status === "Concluída" ? "text-gray-400 line-through" : "text-gray-800"}`}>{t.title}</p>
                      <p className="text-xs text-gray-400">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "Sem data"}{t.due_time ? ` · ${t.due_time}` : ""} · {t.priority}
                      </p>
                    </div>
                    <span className={`badge ${t.status === "Concluída" ? "badge-green" : "badge-yellow"}`}>{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showEdit && (
        <CrmModal title={`✏️ Editar ${c.name}`} onClose={() => setShowEdit(false)} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Field label="Nome completo"><input className="input" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            </div>
            <Field label="Categoria">
              <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>
            <Field label="Data de nascimento"><input type="date" className="input" value={form.birth_date || ""} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} /></Field>
            <Field label="CPF"><input className="input" value={form.cpf || ""} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} /></Field>
            <Field label="E-mail"><input type="email" className="input" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Telefone"><input className="input" value={form.phone || ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="WhatsApp"><input className="input" value={form.whatsapp || ""} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></Field>
            <Field label="Cidade"><input className="input" value={form.city || ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Field>
            <Field label="Estado"><input className="input" value={form.state || ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></Field>
            <Field label="Data do primeiro contato"><input type="date" className="input" value={form.first_contact_at || ""} onChange={(e) => setForm((f) => ({ ...f, first_contact_at: e.target.value }))} /></Field>
            <div className="md:col-span-2">
              <Field label="Observações"><textarea className="input min-h-20" value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={c.is_vip} onChange={async (e) => {
                await apiPut(`/api/crm/clients/${clientId}`, { is_vip: e.target.checked });
                load();
              }} />
              Marcar como cliente VIP manualmente
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn btn-outline" onClick={() => setShowEdit(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !form.name} onClick={saveEdit}>{saving ? "Salvando..." : "Salvar alterações"}</button>
          </div>
        </CrmModal>
      )}
    </div>
  );
}