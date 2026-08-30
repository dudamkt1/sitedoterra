"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  type Category,
  type ChecklistTask,
  type Completion,
  type Frequency,
  type Priority,
  CATEGORY_LABELS,
  CATEGORY_ACCENT,
  FREQUENCY_LABELS,
  PRIORITY_DOT,
  PRIORITY_LABELS,
  WEEKDAY_SHORT,
  WEEKDAY_LONG,
  addDays,
  calculatePeriodStats,
  calculateStreak,
  endOfMonth,
  endOfWeek,
  occurrencesBetween,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "@/lib/checklist";

type Tab = "today" | "week" | "month" | "year";

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: "today", label: "Hoje", icon: "📅" },
  { value: "week", label: "Semana", icon: "🗓️" },
  { value: "month", label: "Mês", icon: "📆" },
  { value: "year", label: "Ano", icon: "🗓️" },
];

type Row = {
  task: ChecklistTask;
  occurrenceDate: Date;       // sempre presente
  isToday: boolean;
  completed: boolean;
};

export default function ChecklistClient() {
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("today");
  const [editing, setEditing] = useState<ChecklistTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);

  // ==================== DATA ====================
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/checklist/tasks", { cache: "no-store" }),
        fetch("/api/checklist/completions", { cache: "no-store" }),
      ]);
      const tJson = await tRes.json();
      const cJson = await cRes.json();
      if (tRes.ok) setTasks(tJson.items || []);
      if (cRes.ok) setCompletions(cJson.items || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Fecha menu contextual
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ==================== DERIVADOS ====================
  const completedKeys = useMemo(
    () => new Set(completions.map((c) => `${c.task_id}__${c.occurrence_date}`)),
    [completions],
  );

  const periodRange = useMemo(() => {
    const t = new Date();
    if (tab === "today") return { from: t, to: t };
    if (tab === "week") return { from: startOfWeek(t), to: endOfWeek(t) };
    if (tab === "month") return { from: startOfMonth(t), to: endOfMonth(t) };
    return { from: new Date(t.getFullYear(), 0, 1), to: new Date(t.getFullYear(), 11, 31, 23, 59, 59) };
  }, [tab]);

  // Linhas: tasks ativas (não pausadas) × cada ocorrência dentro do período
  const rows: Row[] = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.is_paused);
    const out: Row[] = [];
    for (const t of activeTasks) {
      for (const d of occurrencesBetween(t, periodRange.from, periodRange.to)) {
        const iso = toISODate(d);
        out.push({
          task: t,
          occurrenceDate: d,
          isToday: toISODate(d) === toISODate(today),
          completed: completedKeys.has(`${t.id}__${iso}`),
        });
      }
    }
    // Ordena: pendentes primeiro (hoje), depois por horário, depois alfabético
    out.sort((a, b) => {
      // tarefas de hoje no topo
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      // pendentes antes de concluídas
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // por data
      if (+a.occurrenceDate !== +b.occurrenceDate) return +a.occurrenceDate - +b.occurrenceDate;
      // por horário
      const ta = a.task.time_of_day || "99:99";
      const tb = b.task.time_of_day || "99:99";
      if (ta !== tb) return ta.localeCompare(tb);
      return a.task.title.localeCompare(b.task.title);
    });
    return out;
  }, [tasks, periodRange, completedKeys, today]);

  // Stats do período
  const periodStats = useMemo(() => {
    const items = rows.map((r) => ({ taskId: r.task.id, dateIso: toISODate(r.occurrenceDate) }));
    const total = items.length;
    const completed = items.filter((e) => completedKeys.has(`${e.taskId}__${e.dateIso}`)).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending: total - completed, percent };
  }, [rows, completedKeys]);

  // Stats de hoje
  const todayStats = useMemo(() => {
    const t = new Date();
    const todayIso = toISODate(t);
    const dailyRows = rows.filter((r) => r.isToday);
    const completed = dailyRows.filter((r) => r.completed).length;
    const total = dailyRows.length;
    return {
      total,
      completed,
      pending: total - completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      todayIso,
    };
  }, [rows]);

  // Pendentes atrasadas (diárias não concluídas em dias anteriores)
  const overdue = useMemo(() => {
    const t = new Date();
    const todayIso = toISODate(t);
    const list: { task: ChecklistTask; iso: string }[] = [];
    for (const task of tasks) {
      if (task.is_paused) continue;
      if (task.frequency !== "daily") continue;
      for (let i = 1; i <= 14; i++) {
        const d = addDays(t, -i);
        const iso = toISODate(d);
        if (iso === todayIso) continue;
        const created = new Date(task.created_at);
        if (d < new Date(created.getFullYear(), created.getMonth(), created.getDate())) break;
        if (!completedKeys.has(`${task.id}__${iso}`)) {
          list.push({ task, iso });
        } else {
          break; // sequência: se hoje -1 está ok, paramos
        }
      }
    }
    return list;
  }, [tasks, completedKeys]);

  const streak = useMemo(() => calculateStreak(tasks, completions, today), [tasks, completions, today]);

  // ==================== AÇÕES ====================
  async function toggle(taskId: string, iso: string) {
    // Optimistic update
    const key = `${taskId}__${iso}`;
    const wasCompleted = completedKeys.has(key);
    const fakeCompletion: Completion = {
      id: `local-${key}`,
      task_id: taskId,
      user_id: "",
      task_title_snapshot: null,
      frequency_snapshot: null,
      occurrence_date: iso,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setCompletions((prev) => {
      const others = prev.filter((c) => `${c.task_id}__${c.occurrence_date}` !== key);
      return wasCompleted ? others : [fakeCompletion, ...others];
    });
    try {
      const res = await fetch("/api/checklist/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, occurrence_date: iso, action: "toggle" }),
      });
      const j = await res.json();
      if (!res.ok) {
        // rollback
        setCompletions((prev) => {
          const others = prev.filter((c) => `${c.task_id}__${c.occurrence_date}` !== key);
          return wasCompleted ? [...others, fakeCompletion] : others;
        });
        setToast({ kind: "err", text: j.error || "Não foi possível atualizar." });
      } else {
        // Recarrega para sincronizar IDs/snapshots sem mexer no resto
        const cRes = await fetch("/api/checklist/completions", { cache: "no-store" });
        const cJson = await cRes.json();
        if (cRes.ok) setCompletions(cJson.items || []);
      }
    } catch {
      setCompletions((prev) => {
        const others = prev.filter((c) => `${c.task_id}__${c.occurrence_date}` !== key);
        return wasCompleted ? [...others, fakeCompletion] : others;
      });
      setToast({ kind: "err", text: "Falha de conexão." });
    }
  }

  async function pauseTask(task: ChecklistTask) {
    setMenuFor(null);
    try {
      const res = await fetch("/api/checklist/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, action: task.is_paused ? "resume" : "pause" }),
      });
      if (res.ok) {
        setToast({ kind: "ok", text: task.is_paused ? "Tarefa retomada." : "Tarefa pausada." });
        await load();
      } else {
        const j = await res.json();
        setToast({ kind: "err", text: j.error || "Erro ao pausar." });
      }
    } catch {
      setToast({ kind: "err", text: "Falha de conexão." });
    }
  }

  async function deleteTask(task: ChecklistTask) {
    setMenuFor(null);
    if (!confirm(`Excluir "${task.title}"? O histórico anterior será preservado, mas a tarefa não aparecerá mais nas listas ativas.`)) {
      return;
    }
    try {
      const res = await fetch("/api/checklist/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id }),
      });
      if (res.ok) {
        setToast({ kind: "ok", text: "Tarefa arquivada." });
        await load();
      } else {
        const j = await res.json();
        setToast({ kind: "err", text: j.error || "Erro ao excluir." });
      }
    } catch {
      setToast({ kind: "err", text: "Falha de conexão." });
    }
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition whitespace-nowrap ${
              tab === t.value
                ? "bg-[#1d5c3a] text-white shadow-[0_4px_12px_rgba(29,92,58,0.18)]"
                : "bg-white border border-[#dde2dc] text-[#2d3a4a] hover:bg-[#f5f7f4]"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cabeçalho: Bom dia + progresso de hoje */}
      <div className="rounded-[16px] border border-[#e7ece8] bg-gradient-to-br from-[#f0f8f3] via-white to-[#faf6ee] p-4 sm:p-5 shadow-[0_6px_22px_rgba(29,92,58,0.05)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#0d3320] leading-7">
              {greeting(today)}, consultor(a)! 👋
            </p>
            <p className="text-[13.5px] leading-5 text-[#4a5a52] mt-1">
              {tab === "today" && <>Sua rotina de <b className="text-[#0d3320]">hoje</b></>}
              {tab === "week" && <>Visão da <b className="text-[#0d3320]">semana atual</b></>}
              {tab === "month" && <>Visão do <b className="text-[#0d3320]">mês atual</b></>}
              {tab === "year" && <>Visão do <b className="text-[#0d3320]">{today.getFullYear()}</b></>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-[12px] bg-[#1d5c3a] hover:bg-[#164a2e] active:bg-[#103d28] text-white text-[14px] font-semibold px-4 sm:px-5 py-3 shadow-[0_6px_18px_rgba(29,92,58,0.22)] hover:shadow-[0_8px_22px_rgba(29,92,58,0.28)] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova tarefa
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Hoje" value={`${todayStats.completed}/${todayStats.total}`} sub={`${todayStats.percent}% concluído`} accent="emerald" />
          <Metric label="Pendentes" value={String(periodStats.pending)} sub="no período" accent="amber" />
          <Metric label="Concluídas" value={String(periodStats.completed)} sub="no período" accent="indigo" />
          <Metric label="Sequência" value={`🔥 ${streak.current}`} sub={streak.best > 0 ? `Melhor: ${streak.best} dias` : "Comece hoje!"} accent="rose" />
        </div>

        {/* Barra de progresso */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] text-[#4a5a52] mb-1.5">
            <span>Progresso de hoje</span>
            <span className="font-semibold text-[#0d3320]">{todayStats.percent}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#eef2ee] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1d5c3a] to-[#2d7a4f] transition-[width] duration-500"
              style={{ width: `${todayStats.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tarefas atrasadas (apenas na aba hoje) */}
      {tab === "today" && overdue.length > 0 && (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
          <p className="text-[12px] font-bold tracking-wider uppercase text-amber-800">⚠️ Pendentes (atrasadas)</p>
          <p className="text-[13px] text-amber-900/80 mt-1">Você tem {overdue.length} tarefa(s) pendente(s) de dias anteriores.</p>
          <ul className="mt-3 space-y-2">
            {overdue.map((o) => (
              <li key={`${o.task.id}-${o.iso}`} className="flex items-center gap-3 bg-white rounded-[10px] border border-amber-200 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggle(o.task.id, o.iso)}
                  className="w-5 h-5 rounded-md border-2 border-amber-400 hover:border-amber-600 hover:bg-amber-100 transition shrink-0"
                  aria-label="Concluir agora"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#0d3320] truncate">{o.task.title}</p>
                  <p className="text-[12px] text-amber-800/70">{formatIso(o.iso)} • {CATEGORY_LABELS[o.task.category]}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lista de tarefas do período */}
      {loading ? (
        <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-8 text-center text-[#6b7a72] text-sm">Carregando seu checklist...</div>
      ) : rows.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <TaskRow
              key={`${r.task.id}-${toISODate(r.occurrenceDate)}`}
              row={r}
              onToggle={() => toggle(r.task.id, toISODate(r.occurrenceDate))}
              onEdit={() => { setMenuFor(null); setEditing(r.task); }}
              onPause={() => pauseTask(r.task)}
              onDelete={() => deleteTask(r.task)}
              menuOpen={menuFor === r.task.id}
              onMenuToggle={() => setMenuFor(menuFor === r.task.id ? null : r.task.id)}
              menuRef={menuRef}
            />
          ))}
        </ul>
      )}

      {/* Tarefas pausadas (somente na aba hoje) */}
      {tab === "today" && tasks.some((t) => t.is_paused) && (
        <details className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 group">
          <summary className="cursor-pointer text-[13px] font-semibold text-[#4a5a52] list-none flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="group-open:rotate-90 transition" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
            Tarefas pausadas ({tasks.filter((t) => t.is_paused).length})
          </summary>
          <ul className="mt-3 space-y-2">
            {tasks.filter((t) => t.is_paused).map((t) => (
              <li key={t.id} className="flex items-center gap-3 bg-[#fafaf7] rounded-[10px] border border-[#eef2ee] px-3 py-2.5">
                <span className="w-5 h-5 rounded-md border-2 border-slate-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#4a5a52] truncate">{t.title}</p>
                  <p className="text-[12px] text-[#8a9a8e]">{FREQUENCY_LABELS[t.frequency]} • {CATEGORY_LABELS[t.category]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => pauseTask(t)}
                  className="rounded-[8px] border border-[#dde2dc] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1d5c3a] hover:bg-[#f5f7f4] transition"
                >
                  Retomar
                </button>
                <button
                  type="button"
                  onClick={() => deleteTask(t)}
                  aria-label="Excluir"
                  className="rounded-[8px] border border-[#dde2dc] bg-white p-1.5 text-[#9b9b8e] hover:text-red-600 transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Modal de criação / edição */}
      {(creating || editing) && (
        <TaskFormModal
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            setToast({ kind: "ok", text: editing ? "Tarefa atualizada." : "Tarefa criada." });
            await load();
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 rounded-[10px] px-4 py-3 text-[13.5px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${
            toast.kind === "ok" ? "bg-[#1d5c3a] text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTES ====================

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatIso(iso: string): string {
  const d = parseIso(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: "emerald" | "amber" | "indigo" | "rose" }) {
  const map: Record<string, string> = {
    emerald: "from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-800",
    amber: "from-amber-50 to-amber-100/40 border-amber-200 text-amber-800",
    indigo: "from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-800",
    rose: "from-rose-50 to-rose-100/40 border-rose-200 text-rose-800",
  };
  return (
    <div className={`rounded-[12px] border bg-gradient-to-br p-3 sm:p-4 ${map[accent]}`}>
      <p className="text-[10.5px] font-semibold tracking-wider uppercase opacity-80">{label}</p>
      <p className="mt-1.5 text-[20px] sm:text-[22px] font-extrabold leading-none">{value}</p>
      {sub && <p className="mt-1 text-[11.5px] opacity-80">{sub}</p>}
    </div>
  );
}

function TaskRow({
  row,
  onToggle,
  onEdit,
  onPause,
  onDelete,
  menuOpen,
  onMenuToggle,
  menuRef,
}: {
  row: Row;
  onToggle: () => void;
  onEdit: () => void;
  onPause: () => void;
  onDelete: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}) {
  const { task, completed, isToday, occurrenceDate } = row;
  return (
    <li
      className={`group rounded-[14px] border bg-white px-3 sm:px-4 py-3 sm:py-3.5 transition shadow-[0_2px_8px_rgba(0,0,0,0.03)] ${
        completed ? "border-[#d6e8d9] bg-[#f4faf5]" : "border-[#e2e8e0] hover:border-[#cfd8d2]"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={completed ? "Desmarcar" : "Concluir"}
          className={`mt-0.5 w-6 h-6 rounded-[8px] border-2 shrink-0 flex items-center justify-center transition ${
            completed
              ? "bg-[#1d5c3a] border-[#1d5c3a]"
              : "border-[#cfd5cf] hover:border-[#1d5c3a] hover:bg-[#f4faf5]"
          }`}
        >
          {completed && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-[14.5px] font-semibold leading-5 ${completed ? "line-through text-[#7a8a7e]" : "text-[#0d3320]"}`}>{task.title}</p>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${CATEGORY_ACCENT[task.category]}`}>
              {CATEGORY_LABELS[task.category]}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6b7a72]">
              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[12px] text-[#6b7a72]">
            <span>{FREQUENCY_LABELS[task.frequency]}</span>
            {task.frequency === "weekly" && task.day_of_week != null && <span>• {WEEKDAY_LONG[task.day_of_week]}</span>}
            {task.frequency === "monthly" && task.day_of_month != null && <span>• Dia {task.day_of_month}</span>}
            {task.frequency === "yearly" && task.specific_date && <span>• {formatIso(task.specific_date)}</span>}
            {task.time_of_day && <span>• ⏰ {task.time_of_day}</span>}
            {!isToday && <span className="text-[#8a9a8e]">• {formatIso(toISODate(occurrenceDate))}</span>}
          </div>
          {task.description && (
            <p className="mt-1.5 text-[12.5px] leading-5 text-[#6b7a72] whitespace-pre-wrap">{task.description}</p>
          )}
        </div>

        <div className="relative" ref={menuOpen ? menuRef : undefined}>
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Mais ações"
            className="w-8 h-8 rounded-[8px] text-[#9aa5a0] hover:bg-[#f2f4f1] hover:text-[#2d3a4a] flex items-center justify-center transition shrink-0"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-44 rounded-[12px] border border-[#e2e8e0] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1.5 text-left">
              <MenuItem onClick={onEdit} icon="✏️" label="Editar" />
              <MenuItem onClick={onPause} icon="⏸️" label={task.is_paused ? "Retomar" : "Pausar"} />
              <MenuItem onClick={onDelete} icon="🗑️" label="Excluir" danger />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function MenuItem({ onClick, icon, label, danger }: { onClick: () => void; icon: string; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13.5px] font-medium transition ${
        danger ? "text-red-600 hover:bg-red-50" : "text-[#2d3a4a] hover:bg-[#f5f7f4]"
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[16px] border-2 border-dashed border-[#cfd8d2] bg-gradient-to-br from-white to-[#fafaf7] p-8 sm:p-10 text-center">
      <div className="w-16 h-16 rounded-full bg-[#eaf6ec] border border-[#cfe8d2] flex items-center justify-center text-3xl mx-auto">🚀</div>
      <h3 className="mt-5 text-[20px] font-bold tracking-tight text-[#0d3320]">Organize sua rotina</h3>
      <p className="mt-2 text-[14px] leading-5 text-[#4a5a52] max-w-[440px] mx-auto">
        Crie seu primeiro checklist e acompanhe suas atividades diariamente. Você poderá definir tarefas diárias, semanais, mensais e anuais.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-[12px] bg-[#1d5c3a] hover:bg-[#164a2e] active:bg-[#103d28] text-white text-[14px] font-semibold px-5 py-3 shadow-[0_6px_18px_rgba(29,92,58,0.22)] transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Criar primeira tarefa
      </button>
    </div>
  );
}

// ==================== MODAL DE CRIAÇÃO/EDIÇÃO ====================

function TaskFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ChecklistTask | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency || "daily");
  const [category, setCategory] = useState<Category>(initial?.category || "other");
  const [priority, setPriority] = useState<Priority>(initial?.priority || "medium");
  const [timeOfDay, setTimeOfDay] = useState(initial?.time_of_day || "");
  const [dayOfWeek, setDayOfWeek] = useState<string>(initial?.day_of_week != null ? String(initial.day_of_week) : "");
  const [dayOfMonth, setDayOfMonth] = useState<string>(initial?.day_of_month != null ? String(initial.day_of_month) : "");
  const [specificDate, setSpecificDate] = useState(initial?.specific_date || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        frequency,
        category,
        priority,
        time_of_day: timeOfDay || null,
        day_of_week: dayOfWeek === "" ? null : Number(dayOfWeek),
        day_of_month: dayOfMonth === "" ? null : Number(dayOfMonth),
        specific_date: specificDate || null,
      };
      const res = await fetch("/api/checklist/tasks", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initial ? { id: initial.id, ...body } : body),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Erro ao salvar.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full sm:max-w-[560px] sm:w-full bg-white sm:rounded-[20px] rounded-t-[20px] shadow-[0_24px_60px_rgba(0,0,0,0.25)] max-h-[92vh] overflow-y-auto">
        <form onSubmit={submit} className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#0d3320] leading-7">
              {initial ? "Editar tarefa" : "Nova tarefa"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Fechar"
              className="w-9 h-9 rounded-full text-[#6b7a72] hover:bg-[#f2f4f1] flex items-center justify-center transition shrink-0 disabled:opacity-50"
            >
              ✕
            </button>
          </div>
          <p className="text-[13.5px] text-[#6b7a72]">Defina como a tarefa se repete na sua rotina.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Nome da tarefa</label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Responder clientes"
                className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-4 py-3 text-[14.5px] text-[#0d3320] placeholder:text-[#9aa5a0] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a] transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Periodicidade</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["daily", "weekly", "monthly", "yearly"] as Frequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold border transition ${
                      frequency === f
                        ? "border-[#1d5c3a] bg-[#eaf6ec] text-[#103d28]"
                        : "border-[#e2e8e0] bg-white text-[#2d3a4a] hover:border-[#cdd5cd]"
                    }`}
                  >
                    {FREQUENCY_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {frequency === "weekly" && (
                <div>
                  <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Dia da semana</label>
                  <select
                    required
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                  >
                    <option value="">Selecione</option>
                    {WEEKDAY_LONG.map((w, i) => (
                      <option key={i} value={i}>{w}</option>
                    ))}
                  </select>
                </div>
              )}
              {frequency === "monthly" && (
                <div>
                  <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Dia do mês</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    placeholder="Ex.: 15"
                    className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                  />
                </div>
              )}
              {frequency === "yearly" && (
                <div>
                  <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Data específica</label>
                  <input
                    type="date"
                    required
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Horário <span className="opacity-60 font-normal">(opcional)</span></label>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                >
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Prioridade</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                >
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Observação <span className="opacity-60 font-normal">(opcional)</span></label>
              <textarea
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes, contexto ou lembretes..."
                className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a] resize-y"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-[12px] bg-red-50 border border-red-100 px-4 py-3 text-[13.5px] text-red-700">{error}</div>
          )}

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto rounded-[12px] border border-[#dde2dc] bg-white px-5 py-3 text-[14px] font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#1d5c3a] hover:bg-[#164a2e] active:bg-[#103d28] text-white text-[14px] font-semibold px-5 py-3 shadow-[0_6px_18px_rgba(29,92,58,0.22)] hover:shadow-[0_8px_22px_rgba(29,92,58,0.28)] transition disabled:opacity-60"
            >
              {saving ? "Salvando..." : (initial ? "Salvar alterações" : "Criar tarefa")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
