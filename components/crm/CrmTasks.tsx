"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog, CrmStatusBadge } from "@/components/crm/crm-ui";
import { TASK_PRIORITIES, TASK_PRIORITY_COLORS, TASK_STATUSES } from "@/lib/crm-shared";
import type { CrmTask, CrmClient } from "@/types";

export default function CrmTasks() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("clientId")) params.set("clientId", sp.get("clientId")!);
      const res = await fetch(`/api/crm/tasks?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar tarefas.");
      setTasks(json.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar tarefas.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [statusFilter]);

  useEffect(() => {
    fetch("/api/crm/clients?perPage=100").then((r) => r.json()).then((json) => setClients(json.clients || [])).catch(() => {});
  }, []);

  function openCreate() {
    const sp = new URLSearchParams(window.location.search);
    setEditing(null);
    setForm({ title: "", client_id: sp.get("clientId") || "", due_date: "", due_time: "", priority: "Média", category: "", notes: "", status: "A fazer" });
    setShowForm(true);
  }
  function openEdit(t: CrmTask) {
    setEditing(t);
    setForm({ title: t.title, client_id: t.client_id || "", due_date: t.due_date || "", due_time: t.due_time || "", priority: t.priority, category: t.category || "", notes: t.notes || "", status: t.status });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/crm/tasks/${editing.id}`, { ...form, client_id: form.client_id || null });
      } else {
        await apiPost("/api/crm/tasks", { ...form, client_id: form.client_id || null });
      }
      setToast({ ok: true, text: "Tarefa salva!" });
      setShowForm(false);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(t: CrmTask) {
    const next = t.status === "Concluída" ? "A fazer" : "Concluída";
    await apiPut(`/api/crm/tasks/${t.id}`, { status: next });
    load();
  }

  async function remove(t: CrmTask) {
    if (!confirmDialog("Excluir esta tarefa?")) return;
    try {
      await apiDelete(`/api/crm/tasks/${t.id}`);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao excluir." });
    }
  }

  const pending = tasks.filter((t) => t.status !== "Concluída");

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Tarefas e Lembretes</h1>
          <p className="text-sm text-gray-500 mt-1">{pending.length} pendentes · {tasks.length - pending.length} concluídas</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nova tarefa</button>
      </div>

      <div className="card mb-4">
        <label className="label">Filtrar por status</label>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todas</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingState label="Carregando tarefas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState icon="✅" title="Nenhuma tarefa criada." sub='Ex.: "Entrar em contato com Maria", "Fazer pós-venda", "Parabenizar cliente".' action={<button className="btn btn-primary" onClick={openCreate}>+ Criar primeira tarefa</button>} />
        </div>
      ) : (
        <div className="card">
          <ul className="divide-y divide-gray-100">
            {tasks.map((t) => (
              <li key={t.id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={t.status === "Concluída"}
                    onChange={() => toggleStatus(t)}
                    className="mt-1 w-4 h-4 accent-[#1d5c3a]"
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${t.status === "Concluída" ? "text-gray-400 line-through" : "text-gray-800"}`}>{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.client_name ? <Link href={`/painel/crm/clientes/${t.client_id}`} className="text-[#1d5c3a]">{t.client_name}</Link> : "Sem cliente"}
                      {t.due_date ? ` · ${new Date(t.due_date).toLocaleDateString("pt-BR")}` : ""}{t.due_time ? ` às ${t.due_time}` : ""}
                      {t.category ? ` · ${t.category}` : ""}
                    </p>
                    {t.notes && <p className="text-xs text-gray-500 mt-1">{t.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CrmStatusBadge value={t.priority} colorMap={TASK_PRIORITY_COLORS} />
                  <span className={`badge ${t.status === "Concluída" ? "badge-green" : t.status === "Em andamento" ? "badge-blue" : "badge-yellow"}`}>{t.status}</span>
                  <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => openEdit(t)}>Editar</button>
                  <button className="btn btn-outline !py-1 !px-2 !text-xs text-red-500" onClick={() => remove(t)}>🗑</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <CrmModal title={editing ? "✏️ Editar tarefa" : "+ Nova tarefa"} onClose={() => setShowForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Título *"><input className="input" placeholder="Ex.: Entrar em contato com Maria" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            </div>
            <Field label="Cliente (opcional)">
              <select className="input" value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select className="input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Data"><input type="date" className="input" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></Field>
            <Field label="Horário"><input type="time" className="input" value={form.due_time} onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))} /></Field>
            <Field label="Categoria"><input className="input" placeholder="Ex.: Pós-venda, Cobrança" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Observações"><textarea className="input min-h-16" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !form.title} onClick={save}>{saving ? "Salvando..." : "Salvar tarefa"}</button>
          </div>
        </CrmModal>
      )}
    </div>
  );
}