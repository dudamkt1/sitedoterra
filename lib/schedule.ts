export interface ScheduleData {
  monthLabel?: string;
  year?: number;
  firstWeekday?: number;
  daysInMonth?: number;
  available?: number[];
  occupied?: number[];
  today?: number;
  slots?: string[];
  taken?: Record<string, string[]>;
  // new modern fields
  weekdays?: number[]; // 0 dom .. 6 sab
  blockedDates?: string[]; // YYYY-MM-DD
  bookings?: { date: string; time: string; status?: string }[];
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function normalizeSchedule(raw: Record<string, unknown> | undefined): ScheduleData & { computed: { available: number[]; occupied: number[]; firstWeekday: number; daysInMonth: number; monthLabel: string; year: number; today: number; slots: string[]; taken: Record<string, string[]>; blockedDates: string[]; weekdays: number[] } } {
  const s = (raw || {}) as ScheduleData;
  const now = new Date();
  const year = s.year || now.getFullYear();
  const month = s.monthLabel ? monthLabelToIndex(s.monthLabel) : now.getMonth(); // 0-11
  const daysInMonth = s.daysInMonth || new Date(year, month + 1, 0).getDate();
  const firstWeekday = s.firstWeekday ?? new Date(year, month, 1).getDay();
  const today = s.today ?? (now.getMonth() === month && now.getFullYear() === year ? now.getDate() : -1);
  const slots = s.slots && s.slots.length ? s.slots : ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00", "15:30", "16:00"];
  const weekdays = s.weekdays && s.weekdays.length ? s.weekdays : [1, 2, 3, 4, 5]; // seg-sex por padrão
  const blockedDates: string[] = Array.isArray(s.blockedDates) ? s.blockedDates : [];
  const taken: Record<string, string[]> = s.taken ? { ...s.taken } : {};
  // também converte bookings -> taken
  if (Array.isArray((s as any).bookings)) {
    for (const b of (s as any).bookings as { date: string; time: string }[]) {
      const d = new Date(b.date + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const arr = taken[String(day)] || [];
        if (!arr.includes(b.time)) arr.push(b.time);
        taken[String(day)] = arr;
      }
    }
  }
  const blockedDays = new Set<number>();
  for (const bd of blockedDates) {
    const d = new Date(bd + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) blockedDays.add(d.getDate());
  }

  // se já houver available/occupied explícitos, usa-os mas ainda aplica blockedDays e taken para occupied
  let available: number[] = [];
  let occupied: number[] = [];
  if (Array.isArray(s.available) && Array.isArray(s.occupied)) {
    available = [...s.available];
    occupied = [...s.occupied];
    // aplica bloqueios
    for (const bd of Array.from(blockedDays)) {
      if (!occupied.includes(bd)) occupied.push(bd);
      available = available.filter((d) => d !== bd);
    }
    // dias com todos slots ocupados -> occupied visual
    for (let day = 1; day <= daysInMonth; day++) {
      const t = taken[String(day)] || [];
      if (t.length >= slots.length && !occupied.includes(day) && !blockedDays.has(day)) {
        // marca como ocupado se todos horários preenchidos
        // manter available? remover
        available = available.filter((d) => d !== day);
        occupied.push(day);
      }
    }
  } else {
    // calcula a partir de weekdays
    for (let day = 1; day <= daysInMonth; day++) {
      const wd = new Date(year, month, day).getDay();
      if (blockedDays.has(day)) {
        occupied.push(day);
      } else if (weekdays.includes(wd)) {
        const t = taken[String(day)] || [];
        if (t.length >= slots.length) occupied.push(day);
        else available.push(day);
      } else {
        // fora dos weekdays -> nem disponível nem ocupado (cinza claro) mas vamos deixar como não disponível
        // não adiciona em nenhum para ficar visualmente desativado; porém para simplificar marca como não disponível
      }
    }
  }

  const monthLabel = s.monthLabel || `${monthIndexToLabel(month)} ${year}`;

  return {
    ...s,
    weekdays,
    blockedDates,
    slots,
    taken,
    computed: { available: available.sort((a, b) => a - b), occupied: occupied.sort((a, b) => a - b), firstWeekday, daysInMonth, monthLabel, year, today, slots, taken, blockedDates, weekdays },
  };
}

function monthLabelToIndex(label: string): number {
  const m = label.toLowerCase();
  const map: Record<string, number> = { janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k];
  return new Date().getMonth();
}
function monthIndexToLabel(idx: number): string {
  return ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][idx];
}

export function buildSchedulePatch(opts: { weekdays: number[]; slots: string[]; blockedDates: string[]; taken: Record<string, string[]>; monthDate?: Date }): Partial<ScheduleData> {
  const d = opts.monthDate || new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthLabel = `${monthIndexToLabel(month)} ${year}`;
  const today = d.getDate();

  const blockedSet = new Set<number>();
  for (const bd of opts.blockedDates) {
    const dt = new Date(bd + "T12:00:00");
    if (dt.getFullYear() === year && dt.getMonth() === month) blockedSet.add(dt.getDate());
  }

  const available: number[] = [];
  const occupied: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    if (blockedSet.has(day)) { occupied.push(day); continue; }
    const t = opts.taken[String(day)] || [];
    if (t.length >= opts.slots.length) { occupied.push(day); continue; }
    const wd = new Date(year, month, day).getDay();
    if (opts.weekdays.includes(wd)) available.push(day);
  }

  return {
    monthLabel,
    year,
    firstWeekday,
    daysInMonth,
    weekdays: opts.weekdays,
    blockedDates: opts.blockedDates,
    available,
    occupied,
    today,
    slots: opts.slots,
    taken: opts.taken,
  };
}

export function isoForDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
