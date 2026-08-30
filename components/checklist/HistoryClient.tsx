"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ChecklistTask,
  type Completion,
  addDays,
  addMonths,
  addYears,
  calculateStreak,
  endOfMonth,
  parseISODate,
  startOfMonth,
  toISODate,
} from "@/lib/checklist";

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function HistoryClient() {
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, cRes] = await Promise.all([
          fetch("/api/checklist/tasks", { cache: "no-store" }),
          fetch("/api/checklist/completions", { cache: "no-store" }),
        ]);
        const tJson = await tRes.json();
        const cJson = await cRes.json();
        if (tRes.ok) setTasks(tJson.items || []);
        if (cRes.ok) setCompletions(cJson.items || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  // Estatísticas globais
  const total = completions.length;
  const streak = useMemo(() => calculateStreak(tasks, completions, new Date()), [tasks, completions]);

  // Agregação por mês
  const monthly = useMemo(() => {
    const map = new Map<string, { expected: number; completed: number }>();
    // Para cada tarefa, percorremos últimos 6 meses e contamos ocorrências esperadas
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = addMonths(now, -i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const from = startOfMonth(d);
      const to = endOfMonth(d);
      const cap = Math.min(to.getTime(), now.getTime());
      if (cap < from.getTime()) {
        map.set(key, { expected: 0, completed: 0 });
        continue;
      }
      const capEnd = new Date(cap);
      capEnd.setHours(23, 59, 59, 999);
      // Calcula expected via lib (re-import implícito) — usamos occurrencesBetween inline
      const completedSet = new Set(completions.map((c) => `${c.task_id}__${c.occurrence_date}`));
      let expected = 0;
      let done = 0;
      for (const t of tasks) {
        if (t.is_paused) continue;
        const created = new Date(t.created_at);
        const c0 = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        if (capEnd < c0) continue;
        for (let day = new Date(from); day <= capEnd; day = addDays(day, 1)) {
          if (day < c0) continue;
          let hit = false;
          switch (t.frequency) {
            case "daily": hit = true; break;
            case "weekly": hit = t.day_of_week != null && day.getDay() === t.day_of_week; break;
            case "monthly": {
              if (t.day_of_month == null) break;
              const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
              hit = day.getDate() === Math.min(t.day_of_month, lastDay);
              break;
            }
            case "yearly": {
              if (!t.specific_date) break;
              const [y, m, d2] = t.specific_date.split("-").map(Number);
              hit = day.getMonth() === (m - 1) && day.getDate() === d2;
              break;
            }
          }
          if (hit) {
            expected += 1;
            const iso = toISODate(day);
            if (completedSet.has(`${t.id}__${iso}`)) done += 1;
          }
        }
      }
      map.set(key, { expected, completed: done });
    }
    return Array.from(map.entries()).map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        key,
        label: `${MONTHS_PT[m - 1]} ${y}`,
        expected: v.expected,
        completed: v.completed,
        percent: v.expected === 0 ? 0 : Math.round((v.completed / v.expected) * 100),
      };
    });
  }, [tasks, completions]);

  // Conclusões recentes
  const recent = useMemo(() => {
    return [...completions]
      .sort((a, b) => (a.occurrence_date < b.occurrence_date ? 1 : -1))
      .slice(0, 30);
  }, [completions]);

  if (loading) {
    return <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-8 text-center text-[#6b7a72] text-sm">Carregando histórico...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Stats globais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Big label="Concluídas" value={String(total)} sub="no histórico" accent="emerald" />
        <Big label="Sequência atual" value={`🔥 ${streak.current}`} sub={streak.current === 1 ? "dia consecutivo" : "dias consecutivos"} accent="rose" />
        <Big label="Melhor sequência" value={String(streak.best)} sub={streak.best === 1 ? "dia" : "dias"} accent="amber" />
        <Big label="Tarefas ativas" value={String(tasks.filter((t) => !t.is_paused).length)} sub={`${tasks.filter((t) => t.is_paused).length} pausadas`} accent="indigo" />
      </div>

      {/* Mensal */}
      <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <h3 className="text-[15px] font-bold text-[#0d3320] mb-4">Desempenho por mês</h3>
        {monthly.length === 0 ? (
          <p className="text-[13px] text-[#6b7a72]">Sem dados ainda.</p>
        ) : (
          <ul className="space-y-3">
            {monthly.map((m) => (
              <li key={m.key}>
                <div className="flex items-center justify-between gap-3 text-[13.5px] mb-1.5">
                  <span className="font-semibold text-[#0d3320]">{m.label}</span>
                  <span className="text-[#6b7a72]">
                    {m.completed} de {m.expected} • <b className={m.percent >= 80 ? "text-emerald-700" : m.percent >= 50 ? "text-amber-700" : "text-rose-700"}>{m.percent}%</b>
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#eef2ee] overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-500 ${m.percent >= 80 ? "bg-emerald-500" : m.percent >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${m.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Conclusões recentes */}
      <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <h3 className="text-[15px] font-bold text-[#0d3320] mb-4">Conclusões recentes</h3>
        {recent.length === 0 ? (
          <p className="text-[13px] text-[#6b7a72]">Você ainda não concluiu nenhuma tarefa. Comece marcando sua primeira rotina!</p>
        ) : (
          <ul className="divide-y divide-[#eef2ee]">
            {recent.map((c) => {
              const d = parseISODate(c.occurrence_date);
              return (
                <li key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-[13.5px]">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#0d3320] truncate">{c.task_title_snapshot || "Tarefa removida"}</p>
                    <p className="text-[12px] text-[#6b7a72]">{d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-700 text-[12px] font-semibold shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Concluída
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[11.5px] text-[#8a9a8e] text-center">As datas e contagens consideram o fuso horário do seu navegador.</p>
    </div>
  );
}

function Big({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: "emerald" | "amber" | "indigo" | "rose" }) {
  const map: Record<string, string> = {
    emerald: "from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-800",
    amber: "from-amber-50 to-amber-100/40 border-amber-200 text-amber-800",
    indigo: "from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-800",
    rose: "from-rose-50 to-rose-100/40 border-rose-200 text-rose-800",
  };
  return (
    <div className={`rounded-[14px] border bg-gradient-to-br p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] ${map[accent]}`}>
      <p className="text-[11px] font-semibold tracking-wider uppercase opacity-80">{label}</p>
      <p className="mt-2 text-[28px] sm:text-[32px] font-extrabold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] opacity-80">{sub}</p>}
    </div>
  );
}
