"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  read: { label: "Lida", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  in_progress: { label: "Em análise", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  resolved: { label: "Resolvida", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  archived: { label: "Arquivada", cls: "bg-slate-50 text-slate-700 border-slate-200" },
};

const TYPE_LABEL: Record<string, string> = {
  suggestion: "Sugestão",
  question: "Dúvida",
  criticism: "Crítica",
  problem: "Problema / Erro",
  praise: "Elogio",
  other: "Outro",
};

type FeedbackItem = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  type: string;
  message: string;
  status: string;
  source_page: string | null;
  admin_notes: string | null;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Counts = { all: number; pending: number; read: number; in_progress: number; resolved: number; archived: number };

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "read", label: "Não lidas" },
  // "Não lidas" trata status=pending que nunca foram marcadas
  { value: "in_progress", label: "Em análise" },
  { value: "resolved", label: "Resolvidas" },
  { value: "archived", label: "Arquivadas" },
];

const TYPE_FILTERS = [
  { value: "", label: "Todos" },
  { value: "suggestion", label: "Sugestão" },
  { value: "question", label: "Dúvida" },
  { value: "criticism", label: "Crítica" },
  { value: "problem", label: "Problema / Erro" },
  { value: "praise", label: "Elogio" },
  { value: "other", label: "Outro" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function relativeTime(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d atrás`;
  return formatDate(iso);
}

export default function AdminFeedbackClient() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [open, setOpen] = useState<FeedbackItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  const unreadCount = useMemo(() => (counts?.pending || 0), [counts]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter === "read") {
        // “Não lidas” = status ainda pending (que nunca foram marcadas)
        params.set("status", "pending");
      } else if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (typeFilter) params.set("type", typeFilter);
      if (search.trim()) params.set("q", search.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/feedback?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Erro ao carregar.");
        setItems([]);
      } else {
        setItems(json.items || []);
        setTotal(json.total || 0);
        setCounts(json.counts || null);
      }
    } catch {
      setErr("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, page]);

  // Search com debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function updateFeedback(id: string, payload: { status?: string; admin_notes?: string | null }) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao atualizar.");
        return false;
      }
      // Atualiza localmente
      if (open && open.id === id && json.feedback) {
        setOpen({ ...open, ...json.feedback });
      }
      await load();
      return true;
    } catch {
      alert("Falha de conexão.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      {/* Dashboard — cards de contagem */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <CountCard label="Pendentes" value={counts?.pending || 0} active={statusFilter === "pending"} onClick={() => { setStatusFilter("pending"); setPage(1); }} accent="amber" />
        <CountCard label="Não lidas" value={counts?.pending || 0} active={statusFilter === "read"} onClick={() => { setStatusFilter("read"); setPage(1); }} accent="blue" />
        <CountCard label="Em análise" value={counts?.in_progress || 0} active={statusFilter === "in_progress"} onClick={() => { setStatusFilter("in_progress"); setPage(1); }} accent="indigo" />
        <CountCard label="Resolvidas" value={counts?.resolved || 0} active={statusFilter === "resolved"} onClick={() => { setStatusFilter("resolved"); setPage(1); }} accent="emerald" />
        <CountCard label="Arquivadas" value={counts?.archived || 0} active={statusFilter === "archived"} onClick={() => { setStatusFilter("archived"); setPage(1); }} accent="slate" />
      </div>

      {/* Filtros */}
      <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Buscar</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa5a0]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, e-mail ou conteúdo da mensagem..."
                className="w-full rounded-[10px] border border-[#dde2dc] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
              />
            </div>
          </div>
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
            >
              {TYPE_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      {err && (
        <div className="rounded-[12px] bg-red-50 border border-red-100 px-4 py-3 text-[14px] text-red-700">{err}</div>
      )}

      {loading ? (
        <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-10 text-center text-[#6b7a72] text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#cfd5cf] bg-white p-10 text-center">
          <p className="text-[15px] font-semibold text-[#2d3a4a]">Nenhuma mensagem encontrada</p>
          <p className="text-[13px] text-[#6b7a72] mt-1">Ajuste os filtros ou aguarde novas mensagens da comunidade.</p>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block rounded-[14px] border border-[#e2e8e0] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
            <table className="w-full text-left text-[13.5px]">
              <thead className="bg-[#fafaf7] border-b border-[#eef2ee] text-[#6b7a72] text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Mensagem</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const s = STATUS_LABEL[it.status] || STATUS_LABEL.pending;
                  return (
                    <tr key={it.id} className="border-b border-[#f2f4f1] hover:bg-[#fafaf7]">
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-[#0d3320] truncate max-w-[180px]">{it.user_name || it.user_email || "—"}</p>
                        <p className="text-[12px] text-[#6b7a72] truncate max-w-[180px]">{it.user_email || ""}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-[#2d3a4a]">{TYPE_LABEL[it.type] || it.type}</td>
                      <td className="px-4 py-3 align-top text-[#4a5a52] max-w-[340px]">
                        <p className="truncate">{it.message}</p>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-[#4a5a52]">
                        <p>{relativeTime(it.created_at)}</p>
                        <p className="text-[11.5px] text-[#8a9a8e]">{formatDate(it.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          type="button"
                          onClick={() => { setOpen(it); setAdminNotes(it.admin_notes || ""); }}
                          className="rounded-[8px] border border-[#dde2dc] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] transition"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {items.map((it) => {
              const s = STATUS_LABEL[it.status] || STATUS_LABEL.pending;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { setOpen(it); setAdminNotes(it.admin_notes || ""); }}
                  className="w-full text-left rounded-[14px] border border-[#e2e8e0] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0d3320] truncate">{it.user_name || it.user_email || "—"}</p>
                      <p className="text-[12px] text-[#6b7a72] truncate">{it.user_email || ""}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-[12px] mt-2 inline-flex rounded-full bg-[#f2f4f1] px-2.5 py-0.5 font-semibold text-[#4a5a52]">{TYPE_LABEL[it.type] || it.type}</p>
                  <p className="text-[13.5px] leading-5 text-[#2d3a4a] mt-2 line-clamp-3">{it.message}</p>
                  <p className="text-[11.5px] text-[#8a9a8e] mt-2">{relativeTime(it.created_at)} • {formatDate(it.created_at)}</p>
                </button>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-[13px] text-[#4a5a52]">
              <p>Mostrando {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} de {total}</p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-[8px] border border-[#dde2dc] bg-white px-3 py-1.5 font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] disabled:opacity-50"
                >
                  ← Anterior
                </button>
                <span className="px-2">{page}/{totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-[8px] border border-[#dde2dc] bg-white px-3 py-1.5 font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] disabled:opacity-50"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setOpen(null);
          }}
        >
          <div className="w-full sm:max-w-[640px] sm:w-full bg-white sm:rounded-[20px] rounded-t-[20px] shadow-[0_24px_60px_rgba(0,0,0,0.25)] max-h-[92vh] overflow-y-auto">
            <div className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-[20px] font-bold text-[#0d3320]">Mensagem do usuário</h2>
                  <p className="text-[12.5px] text-[#6b7a72] mt-1">Visualize os detalhes e gerencie o status.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  disabled={saving}
                  aria-label="Fechar"
                  className="w-9 h-9 rounded-full text-[#6b7a72] hover:bg-[#f2f4f1] flex items-center justify-center transition shrink-0 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13.5px] mt-3">
                <DetailRow label="Nome" value={open.user_name || "—"} />
                <DetailRow label="E-mail" value={open.user_email || "—"} />
                <DetailRow label="Tipo" value={TYPE_LABEL[open.type] || open.type} />
                <DetailRow label="Data" value={formatDate(open.created_at)} />
                <DetailRow label="Status" value={(STATUS_LABEL[open.status] || STATUS_LABEL.pending).label} />
                <DetailRow label="Origem" value={open.source_page || "—"} />
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-2">Mensagem completa</p>
                <div className="rounded-[12px] border border-[#e2e8e0] bg-[#fafaf7] p-4 text-[14px] leading-6 text-[#2d3a4a] whitespace-pre-wrap break-words">{open.message}</div>
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-2">Observação interna (não aparece para o usuário)</p>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Anote observações para a equipe..."
                  className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a] resize-y"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => updateFeedback(open.id, { admin_notes: adminNotes || null })}
                  className="mt-2 rounded-[10px] border border-[#dde2dc] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] transition disabled:opacity-50"
                >
                  Salvar observação
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {open.status === "pending" && (
                  <ActionButton
                    color="blue"
                    onClick={() => updateFeedback(open.id, { status: "read" })}
                    disabled={saving}
                    label="Marcar como lida"
                  />
                )}
                {open.status !== "in_progress" && open.status !== "resolved" && open.status !== "archived" && (
                  <ActionButton
                    color="indigo"
                    onClick={() => updateFeedback(open.id, { status: "in_progress" })}
                    disabled={saving}
                    label="Marcar em análise"
                  />
                )}
                {open.status !== "resolved" && open.status !== "archived" && (
                  <ActionButton
                    color="emerald"
                    onClick={() => updateFeedback(open.id, { status: "resolved" })}
                    disabled={saving}
                    label="Marcar resolvida"
                  />
                )}
                {open.status !== "archived" && (
                  <ActionButton
                    color="slate"
                    onClick={() => updateFeedback(open.id, { status: "archived" })}
                    disabled={saving}
                    label="Arquivar"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Helper de badge no sidebar (invisível, apenas para reuso de leitura) */}
      {unreadCount > 0 && <span data-feedback-unread={unreadCount} className="hidden" />}
    </div>
  );
}

function CountCard({ label, value, active, onClick, accent }: { label: string; value: number; active: boolean; onClick: () => void; accent: "amber" | "blue" | "indigo" | "emerald" | "slate" }) {
  const accentMap: Record<string, string> = {
    amber: "from-amber-50 to-amber-100/40 border-amber-200 text-amber-800",
    blue: "from-blue-50 to-blue-100/40 border-blue-200 text-blue-800",
    indigo: "from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-800",
    emerald: "from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-800",
    slate: "from-slate-50 to-slate-100/40 border-slate-200 text-slate-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-[12px] border bg-gradient-to-br p-3.5 sm:p-4 transition shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] ${accentMap[accent]} ${active ? "ring-2 ring-offset-1 ring-[#1d5c3a]/30" : ""}`}
    >
      <p className="text-[11px] font-semibold tracking-wide uppercase opacity-80">{label}</p>
      <p className="mt-1.5 text-[24px] font-extrabold leading-none">{value}</p>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[#fafaf7] border border-[#eef2ee] px-3 py-2.5">
      <p className="text-[10.5px] font-semibold tracking-wide uppercase text-[#8a9a8e]">{label}</p>
      <p className="text-[13.5px] font-semibold text-[#0d3320] mt-0.5 break-words">{value}</p>
    </div>
  );
}

function ActionButton({ color, onClick, disabled, label }: { color: "blue" | "indigo" | "emerald" | "slate"; onClick: () => void; disabled: boolean; label: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
    emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
    slate: "bg-slate-700 hover:bg-slate-800 text-white",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[10px] px-3 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${map[color]}`}
    >
      {label}
    </button>
  );
}
