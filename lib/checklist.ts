// ============================ CHECKLIST — TIPOS & HELPERS ============================
// Fonte única de verdade de tipos e cálculos de recorrência. Server e client
// compartilham estes helpers para que a definição de "ocorre hoje/semana/mês/ano"
// seja idêntica.

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";
export type Category = "clients" | "sales" | "marketing" | "content" | "organization" | "studies" | "personal" | "other";
export type Priority = "low" | "medium" | "high";

export type ChecklistTask = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: Frequency;
  category: Category;
  priority: Priority;
  time_of_day: string | null;        // "HH:MM" ou null
  day_of_week: number | null;        // 0=Dom..6=Sáb
  day_of_month: number | null;       // 1..31
  specific_date: string | null;      // "YYYY-MM-DD"
  is_paused: boolean;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Completion = {
  id: string;
  task_id: string | null;
  user_id: string;
  task_title_snapshot: string | null;
  frequency_snapshot: Frequency | null;
  occurrence_date: string;            // "YYYY-MM-DD"
  completed_at: string;
  created_at: string;
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  clients: "Clientes",
  sales: "Vendas",
  marketing: "Marketing",
  content: "Conteúdo",
  organization: "Organização",
  studies: "Estudos",
  personal: "Pessoal",
  other: "Outra",
};

export const CATEGORY_ACCENT: Record<Category, string> = {
  clients: "bg-blue-50 text-blue-800 border-blue-200",
  sales: "bg-emerald-50 text-emerald-800 border-emerald-200",
  marketing: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  content: "bg-amber-50 text-amber-800 border-amber-200",
  organization: "bg-slate-50 text-slate-700 border-slate-200",
  studies: "bg-indigo-50 text-indigo-800 border-indigo-200",
  personal: "bg-rose-50 text-rose-800 border-rose-200",
  other: "bg-stone-50 text-stone-700 border-stone-200",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// ============================ DATA / TZ ============================

/** YYYY-MM-DD em horário local. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Dom
  const diff = -day; // volta para domingo
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const r = new Date(s);
  r.setDate(s.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(d.getMonth() + n);
  return r;
}

export function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(d.getFullYear() + n);
  return r;
}

// ============================ OCORRÊNCIA ============================

/**
 * A tarefa ocorre em `date`?
 * - daily: sempre (a partir de created_at)
 * - weekly: se date.getDay() === day_of_week E date >= created_at
 * - monthly: se date.getDate() === day_of_month (clamp) E date >= created_at
 * - yearly: se mesma data (mês/dia) de specific_date (repetindo todo ano)
 */
export function occursOn(task: ChecklistTask, date: Date, now: Date = new Date()): boolean {
  if (task.is_paused) return false;
  const created = new Date(task.created_at);
  if (date < new Date(created.getFullYear(), created.getMonth(), created.getDate())) return false;
  if (date > now) return false; // não exibir ocorrências no futuro

  switch (task.frequency) {
    case "daily":
      return true;
    case "weekly":
      if (task.day_of_week == null) return false;
      return date.getDay() === task.day_of_week;
    case "monthly": {
      if (task.day_of_month == null) return false;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const target = Math.min(task.day_of_month, lastDay);
      return date.getDate() === target;
    }
    case "yearly": {
      if (!task.specific_date) return false;
      const [y, m, d] = task.specific_date.split("-").map(Number);
      return date.getMonth() === (m - 1) && date.getDate() === d;
    }
    default:
      return false;
  }
}

/** Próxima ocorrência (≥ hoje). null se não houver no futuro. */
export function nextOccurrence(task: ChecklistTask, from: Date = new Date()): Date | null {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 366; i++) {
    const d = addDays(start, i);
    if (occursOn(task, d, new Date(2099, 11, 31))) return d;
  }
  return null;
}

/** Lista de datas em que a task ocorre no intervalo [from, to] (inclusivo). */
export function occurrencesBetween(task: ChecklistTask, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (occursOn(task, d, new Date(2099, 11, 31))) out.push(new Date(d));
  }
  return out;
}

// ============================ STREAK ============================

/**
 * Calcula a sequência atual: dias consecutivos (até hoje) em que o usuário
 * concluiu TODAS as tarefas (diárias) que deveriam ter sido feitas naquele dia.
 *
 * Estratégia: para cada dia, se houver ≥1 tarefa daily ativa, exige-se que
 * ela esteja concluída. Se houver várias, considera o dia cumprido quando
 * TODAS estiverem concluídas. Se não houver tarefas daily naquele dia, o dia
 * conta como cumprido (vazio não quebra sequência).
 */
export function calculateStreak(
  tasks: ChecklistTask[],
  completions: Completion[],
  today: Date = new Date(),
): { current: number; best: number } {
  // Mapa de conclusões por data
  const completedKeys = new Set(completions.map((c) => `${c.task_id}__${c.occurrence_date}`));
  const tasksDailyActive = tasks.filter((t) => t.frequency === "daily" && !t.is_paused);

  // Para streak: percorremos do dia atual para trás
  // Definimos o dia como "cumprido" se:
  //   - não há nenhuma tarefa daily criada até aquele dia (vazio = ok) — mas a sequência é 0
  //   - há tarefas daily E todas foram concluídas
  //   - há tarefas daily e nenhuma foi concluída = quebra
  // Regra: se o dia tem ≥1 tarefa daily programada, todas precisam estar concluídas
  // (regra estrita; alinha com o espírito do requisito "rotina cumprida").

  // Coletar todas as datas em que havia ao menos 1 tarefa daily criada
  const sortedTasks = [...tasksDailyActive].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  if (sortedTasks.length === 0) return { current: 0, best: 0 };

  // A função runsDailyIn(task, date) considera se a tarefa existia na data
  const isProgrammedOn = (task: ChecklistTask, date: Date) => {
    const created = new Date(task.created_at);
    const c = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    return date >= c;
  };

  const isDayDone = (date: Date) => {
    const iso = toISODate(date);
    const daily = tasksDailyActive.filter((t) => isProgrammedOn(t, date));
    if (daily.length === 0) return true; // sem tarefas -> dia neutro (não conta para streak)
    return daily.every((t) => completedKeys.has(`${t.id}__${iso}`));
  };

  // Best: percorre últimos 365 dias
  let best = 0;
  let run = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(today, -i);
    if (isDayDone(d)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  // Best isolado (pode ter ficado para trás)
  // Para simplicidade, o best já foi capturado no retrocesso.

  // Current: dias consecutivos do dia atual para trás (começando em hoje)
  let current = 0;
  let cursor = new Date(today);
  // Se hoje está vazio (sem tarefas), a streak atual não pode ser contabilizada como ativa.
  // O requisito é "completou sua rotina por X dias consecutivos" — começando de hoje.
  while (true) {
    if (isDayDone(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
    if (current > 365) break; // segurança
  }

  // Se "hoje" tem tarefas mas nenhuma foi concluída, a sequência não é 0
  // apenas — ela é simplesmente "ainda não atualizada hoje". A UI pode interpretar.
  return { current, best };
}

// ============================ STATS ============================

export interface PeriodStats {
  total: number;
  completed: number;
  pending: number;
  percent: number;
}

export function calculatePeriodStats(
  tasks: ChecklistTask[],
  completions: Completion[],
  from: Date,
  to: Date,
): PeriodStats {
  const expected = occurrencesBetweenAll(tasks, from, to);
  const completedKeys = new Set(completions.map((c) => `${c.task_id}__${c.occurrence_date}`));
  const completed = expected.filter((e) => completedKeys.has(`${e.taskId}__${e.dateIso}`)).length;
  const total = expected.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, pending: total - completed, percent };
}

function occurrencesBetweenAll(tasks: ChecklistTask[], from: Date, to: Date): { taskId: string; dateIso: string }[] {
  const out: { taskId: string; dateIso: string }[] = [];
  for (const t of tasks) {
    for (const d of occurrencesBetween(t, from, to)) {
      out.push({ taskId: t.id, dateIso: toISODate(d) });
    }
  }
  return out;
}
