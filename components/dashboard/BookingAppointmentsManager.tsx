"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingStatus, TenantBooking } from "@/types";

type Filter = "todos" | BookingStatus | "proximos" | "hoje";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  realizado: "Realizada",
  cancelado: "Cancelada",
  faltou: "Faltou",
  reagendado: "Reagendado",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  pendente: "bg-amber-50 text-amber-800 border-amber-200",
  confirmado: "bg-blue-50 text-blue-700 border-blue-200",
  realizado: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-red-50 text-red-700 border-red-200",
  faltou: "bg-gray-100 text-gray-600 border-gray-200",
  reagendado: "bg-purple-50 text-purple-700 border-purple-200",
};

const DEMO_KEY = "sitedoterra_demo_bookings_v1";

interface DemoBooking {
  id: string;
  client_name: string;
  client_whatsapp: string | null;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string;
  booking_time: string;
  notes: string | null;
  status: BookingStatus;
  source: string;
  created_at: string;
}

function toTenantBooking(d: DemoBooking): TenantBooking {
  return {
    id: d.id,
    tenant_id: "demo",
    user_id: "demo",
    client_name: d.client_name,
    client_whatsapp: d.client_whatsapp,
    client_email: d.client_email,
    client_phone: d.client_phone,
    booking_date: d.booking_date,
    booking_time: d.booking_time,
    notes: d.notes,
    status: d.status,
    source: d.source as TenantBooking["source"],
    created_at: d.created_at,
    updated_at: d.created_at,
  };
}

function loadDemo(): TenantBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return seedDemo();
    const arr = JSON.parse(raw) as DemoBooking[];
    return arr.map(toTenantBooking);
  } catch {
    return [];
  }
}
function saveDemo(list: TenantBooking[]) {
  if (typeof window === "undefined") return;
  const demo: DemoBooking[] = list.map((b) => ({
    id: b.id,
    client_name: b.client_name,
    client_whatsapp: b.client_whatsapp,
    client_email: b.client_email,
    client_phone: b.client_phone,
    booking_date: b.booking_date,
    booking_time: b.booking_time,
    notes: b.notes,
    status: b.status,
    source: b.source,
    created_at: b.created_at,
  }));
  localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
}
function seedDemo(): TenantBooking[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (n: number) => { const x = new Date(today); x.setDate(today.getDate() + n); return fmt(x); };
  const seed: DemoBooking[] = [
    { id: "demo_b1", client_name: "Juliana Lima", client_whatsapp: "5511987654321", client_email: "juliana@exemplo.com", client_phone: null, booking_date: plus(1), booking_time: "14:30", notes: "Primeira consulta — interesse em Lavanda para sono", status: "pendente", source: "painel", created_at: new Date().toISOString() },
    { id: "demo_b2", client_name: "Mariana Costa", client_whatsapp: "5521987654321", client_email: null, client_phone: null, booking_date: plus(2), booking_time: "09:00", notes: "Retorno — avaliar blend foco", status: "confirmado", source: "site", created_at: new Date().toISOString() },
    { id: "demo_b3", client_name: "Patrícia Rocha", client_whatsapp: "5511999887766", client_email: "patricia@exemplo.com", client_phone: null, booking_date: plus(-2), booking_time: "16:00", notes: "Reunião realizada com sucesso", status: "realizado", source: "painel", created_at: new Date().toISOString() },
  ];
  const mapped = seed.map(toTenantBooking);
  saveDemo(mapped);
  return mapped;
}

function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
}
function isFuture(date: string, time: string) {
  const dt = new Date(`${date}T${time}:00`);
  return dt.getTime() >= Date.now() - 60_000;
}
function whatsappLink(whatsapp: string | null, name: string, date: string, time: string) {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  const d = date.split("-").reverse().join("/");
  const text = `Olá ${name}! Confirmando nossa consulta em ${d} às ${time}. Te espero! 🌿`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function BookingAppointmentsManager() {
  const [bookings, setBookings] = useState<TenantBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoFallback, setIsDemoFallback] = useState(false);
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TenantBooking | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ client_name: "", client_whatsapp: "", client_email: "", booking_date: todayIso(), booking_time: "09:00", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings");
      if (res.status === 401) {
        // fallback demo
        setIsDemoFallback(true);
        setBookings(loadDemo());
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setBookings(json.bookings || []);
        setIsDemoFallback(false);
      } else {
        // se tabela não existe, cai no demo
        if (json.error?.includes("Tabela") || json.error?.includes("migration")) {
          setIsDemoFallback(true);
          setBookings(loadDemo());
        } else {
          setMessage({ ok: false, text: json.error || "Erro ao carregar agendamentos." });
        }
      }
    } catch {
      setIsDemoFallback(true);
      setBookings(loadDemo());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ client_name: "", client_whatsapp: "", client_email: "", booking_date: todayIso(), booking_time: "09:00", notes: "" });
    setEditing(null);
  }

  async function handleCreateOrUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name.trim()) { setMessage({ ok: false, text: "Informe o nome do cliente." }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.booking_date)) { setMessage({ ok: false, text: "Data inválida." }); return; }
    if (!/^\d{2}:\d{2}$/.test(form.booking_time)) { setMessage({ ok: false, text: "Horário inválido." }); return; }
    setSaving(true);
    setMessage(null);

    if (isDemoFallback) {
      const now = new Date().toISOString();
      if (editing) {
        const updated: TenantBooking = { ...editing, client_name: form.client_name.trim(), client_whatsapp: form.client_whatsapp.replace(/\D/g, "") || null, client_email: form.client_email.trim() || null, booking_date: form.booking_date, booking_time: form.booking_time, notes: form.notes.trim() || null };
        const next = bookings.map((b) => b.id === editing.id ? updated : b);
        setBookings(next);
        saveDemo(next);
        setMessage({ ok: true, text: "Agendamento atualizado (demonstração — salvo neste navegador)." });
      } else {
        const nb: TenantBooking = {
          id: `demo_${Date.now()}`,
          tenant_id: "demo",
          user_id: "demo",
          client_name: form.client_name.trim(),
          client_whatsapp: form.client_whatsapp.replace(/\D/g, "") || null,
          client_email: form.client_email.trim() || null,
          client_phone: null,
          booking_date: form.booking_date,
          booking_time: form.booking_time,
          notes: form.notes.trim() || null,
          status: "pendente",
          source: "painel",
          created_at: now,
          updated_at: now,
        };
        const next = [nb, ...bookings];
        setBookings(next);
        saveDemo(next);
        setMessage({ ok: true, text: "Agendamento criado (demonstração — salvo neste navegador)." });
      }
      setShowForm(false);
      resetForm();
      setSaving(false);
      return;
    }

    try {
      const url = editing ? `/api/bookings/${editing.id}` : "/api/bookings";
      const method = editing ? "PUT" : "POST";
      const payload: Record<string, string> = {
        client_name: form.client_name.trim(),
        client_whatsapp: form.client_whatsapp,
        client_email: form.client_email,
        booking_date: form.booking_date,
        booking_time: form.booking_time,
        notes: form.notes,
      };
      if (editing && editing.status !== "pendente") payload.status = editing.status;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      setMessage({ ok: true, text: editing ? "Agendamento atualizado!" : "Agendamento criado!" });
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Erro ao salvar." });
    }
    setSaving(false);
  }

  async function updateStatus(id: string, status: BookingStatus) {
    setMessage(null);
    if (isDemoFallback) {
      const next = bookings.map((b) => b.id === id ? { ...b, status } : b);
      setBookings(next);
      saveDemo(next);
      return;
    }
    const res = await fetch(`/api/bookings/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const json = await res.json();
    if (!res.ok) setMessage({ ok: false, text: json.error || "Erro ao atualizar." });
    else await load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este agendamento?")) return;
    if (isDemoFallback) {
      const next = bookings.filter((b) => b.id !== id);
      setBookings(next);
      saveDemo(next);
      return;
    }
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      setMessage({ ok: false, text: j.error || "Erro ao excluir." });
    } else await load();
  }

  function openEdit(b: TenantBooking) {
    setEditing(b);
    setForm({ client_name: b.client_name, client_whatsapp: b.client_whatsapp || "", client_email: b.client_email || "", booking_date: b.booking_date, booking_time: b.booking_time, notes: b.notes || "" });
    setShowForm(true);
  }

  const filtered = useMemo(() => {
    let list = [...bookings];
    if (filter === "hoje") list = list.filter((b) => isToday(b.booking_date));
    else if (filter === "proximos") list = list.filter((b) => isFuture(b.booking_date, b.booking_time) && ["pendente", "confirmado"].includes(b.status));
    else if (filter !== "todos") list = list.filter((b) => b.status === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => [b.client_name, b.client_whatsapp, b.client_email, b.notes].some((v) => v && v.toLowerCase().includes(q)));
    // ordena: próximos primeiro
    list.sort((a, b) => {
      const da = `${a.booking_date}T${a.booking_time}`;
      const db = `${b.booking_date}T${b.booking_time}`;
      return da.localeCompare(db);
    });
    return list;
  }, [bookings, filter, query]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const pend = bookings.filter((b) => b.status === "pendente").length;
    const conf = bookings.filter((b) => b.status === "confirmado").length;
    const prox = bookings.filter((b) => isFuture(b.booking_date, b.booking_time) && ["pendente", "confirmado"].includes(b.status)).length;
    const hoje = bookings.filter((b) => isToday(b.booking_date) && !["cancelado", "realizado"].includes(b.status)).length;
    const realiz = bookings.filter((b) => b.status === "realizado").length;
    const canc = bookings.filter((b) => b.status === "cancelado").length;
    return { total, pend, conf, prox, hoje, realiz, canc };
  }, [bookings]);

  if (loading) return <p className="text-sm text-gray-400">Carregando agendamentos...</p>;

  return (
    <div className="card">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="card-title">📅 Controle de agendamentos</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Veja os próximos atendimentos, contatos e status. Marque como <b>realizada</b> ou <b>cancelada</b> para se organizar — funciona como lembrete diário da sua agenda.
              {isDemoFallback && <span className="ml-1 text-amber-700"> (modo demonstração — salvo só neste navegador)</span>}
            </p>
          </div>
          <button type="button" className="btn btn-primary !py-2 !px-4 text-sm shrink-0" onClick={() => { resetForm(); setShowForm(true); }}>+ Novo agendamento</button>
        </div>

        {message && <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
            <p className="text-xs text-amber-800 font-semibold">Hoje</p>
            <p className="text-xl font-bold text-amber-900">{stats.hoje}</p>
            <p className="text-[0.7rem] text-amber-700">{stats.prox} próximos</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-xs text-blue-800 font-semibold">Pendentes</p>
            <p className="text-xl font-bold text-blue-900">{stats.pend}</p>
            <p className="text-[0.7rem] text-blue-700">{stats.conf} confirmados</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2.5">
            <p className="text-xs text-green-800 font-semibold">Realizadas</p>
            <p className="text-xl font-bold text-green-900">{stats.realiz}</p>
            <p className="text-[0.7rem] text-green-700">histórico</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="text-xs text-gray-600 font-semibold">Total</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-[0.7rem] text-gray-500">{stats.canc} cancelados</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "proximos", "hoje", "pendente", "confirmado", "realizado", "cancelado"] as Filter[]).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                {f === "todos" ? "Todos" : f === "proximos" ? "Próximos" : f === "hoje" ? "Hoje" : STATUS_LABEL[f as BookingStatus]}
              </button>
            ))}
          </div>
          <input className="input !py-2 sm:max-w-[260px]" placeholder="🔍 Buscar por nome, WhatsApp, email..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
          <p className="text-sm text-gray-500">Nenhum agendamento neste filtro.</p>
          <p className="text-xs text-gray-400 mt-1">Clique em “Novo agendamento” para adicionar sua próxima consulta.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const wa = whatsappLink(b.client_whatsapp, b.client_name, b.booking_date, b.booking_time);
            const isPast = !isFuture(b.booking_date, b.booking_time);
            const dbr = b.booking_date.split("-").reverse().join("/");
            return (
              <div key={b.id} className={`rounded-xl border p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between ${isPast && b.status === "pendente" ? "bg-amber-50/40 border-amber-100" : "bg-white border-gray-100"}`}>
                <div className="flex gap-3 min-w-0 flex-1">
                  <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${b.status === "realizado" ? "bg-green-50 border-green-200 text-green-700" : b.status === "cancelado" ? "bg-red-50 border-red-200 text-red-700" : "bg-[#1d5c3a] text-white border-[#1d5c3a]"}`}>
                    <span className="text-[0.65rem] font-bold uppercase tracking-wide opacity-80">{new Date(b.booking_date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                    <span className="text-lg font-bold leading-none">{b.booking_date.split("-")[2]}</span>
                    <span className="text-xs font-medium">{b.booking_time}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">{b.client_name}</span>
                      <span className={`badge border text-[0.7rem] ${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                      {isToday(b.booking_date) && <span className="badge badge-yellow">Hoje</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                      {b.client_whatsapp && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{b.client_whatsapp}</span>}
                      {b.client_email && <span>✉️ {b.client_email}</span>}
                      <span>📅 {dbr} às {b.booking_time}</span>
                    </div>
                    {b.notes && <p className="text-xs text-gray-600 mt-1 line-clamp-2 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100">{b.notes}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:flex-col sm:items-stretch sm:w-[170px] shrink-0">
                  <div className="flex gap-1.5 w-full">
                    {b.status !== "realizado" && (
                      <button type="button" onClick={() => updateStatus(b.id, "realizado")} className="flex-1 btn btn-primary !py-1.5 !px-2 !text-xs" title="Marcar como realizada">✓ Realizada</button>
                    )}
                    {b.status !== "cancelado" && (
                      <button type="button" onClick={() => updateStatus(b.id, "cancelado")} className="flex-1 btn btn-outline !py-1.5 !px-2 !text-xs" title="Marcar como cancelada">✕ Cancelar</button>
                    )}
                  </div>
                  {b.status === "pendente" && (
                    <button type="button" onClick={() => updateStatus(b.id, "confirmado")} className="btn btn-outline !py-1.5 !px-2 !text-xs w-full">Confirmar</button>
                  )}
                  {(b.status === "cancelado" || b.status === "faltou") && (
                    <button type="button" onClick={() => updateStatus(b.id, "pendente")} className="btn btn-outline !py-1.5 !px-2 !text-xs w-full">Reativar (pendente)</button>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="btn !py-1.5 !px-2 !text-xs w-full text-center" style={{ background: "#25D366", color: "white" }}>WhatsApp</a>
                  )}
                  <div className="flex gap-1.5 w-full">
                    <button type="button" onClick={() => openEdit(b)} className="flex-1 btn btn-outline !py-1.5 !px-2 !text-xs">Editar</button>
                    <button type="button" onClick={() => remove(b.id)} className="flex-1 btn btn-outline !py-1.5 !px-2 !text-xs text-red-600 border-red-200 hover:bg-red-50">Excluir</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        💡 <b>Dica de uso:</b> este painel é seu lembrete diário. Cadastre cada consulta que entrar via WhatsApp/site. Use <b>Confirmado</b> quando a cliente confirmar, <b>Realizada</b> após o atendimento e <b>Cancelada/Faltou</b> para histórico. O filtro <b>Próximos</b> mostra só o que precisa de atenção agora.
      </p>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreateOrUpdate} className="card w-full max-w-lg my-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="card-title">{editing ? "Editar agendamento" : "Novo agendamento"}</h3>
              <button type="button" className="text-gray-400 text-xl" onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
            </div>
            <div>
              <label className="label">Nome da cliente *</label>
              <input className="input" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Ex.: Juliana Lima" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">WhatsApp</label>
                <input className="input" value={form.client_whatsapp} onChange={(e) => setForm((f) => ({ ...f, client_whatsapp: e.target.value }))} placeholder="11987654321" />
              </div>
              <div>
                <label className="label">Email (opcional)</label>
                <input className="input" type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Data *</label>
                <input className="input" type="date" value={form.booking_date} onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Horário *</label>
                <input className="input" type="time" value={form.booking_time} onChange={(e) => setForm((f) => ({ ...f, booking_time: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea className="input min-h-20" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ex.: primeira consulta, interesse em Kit Sono..." />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar agendamento"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
