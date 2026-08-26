"use client";

import { useMemo, useState } from "react";
import { WEEKDAY_LABELS, buildSchedulePatch, isoForDay } from "@/lib/schedule";

type Props = {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

function getSchedule(value: Record<string, unknown>) {
  const raw = (value.schedule as Record<string, unknown>) || (value as Record<string, unknown>);
  // se value já é schedule direto
  if (raw && (raw as any).slots) return raw as any;
  return (value.schedule as any) || {};
}

export function BookingAgendaEditor({ value, onChange }: Props) {
  const schedule = getSchedule(value) as any;
  const initialWeekdays: number[] = Array.isArray(schedule.weekdays) ? schedule.weekdays : [1, 2, 3, 4, 5];
  const initialSlots: string[] = Array.isArray(schedule.slots) ? schedule.slots : ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00", "15:30"];
  const initialBlocked: string[] = Array.isArray(schedule.blockedDates) ? schedule.blockedDates : [];
  const initialTaken: Record<string, string[]> = schedule.taken && typeof schedule.taken === "object" ? schedule.taken : {};
  const eyebrow = (value.eyebrow as string) || schedule.eyebrow || "Agenda da consultora";
  const title = (value.title as string) || "Agende sua consulta gratuita";
  const subtitle = (value.subtitle as string) || "Escolha o melhor dia e horário. Após a seleção, você será direcionada ao WhatsApp para confirmar.";
  const whatsappText = (value.whatsappText as string) || schedule.whatsappText || "";

  const [weekdays, setWeekdays] = useState<number[]>(initialWeekdays);
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [blockedDates, setBlockedDates] = useState<string[]>(initialBlocked);
  const [taken, setTaken] = useState<Record<string, string[]>>(initialTaken);
  const [newSlot, setNewSlot] = useState("");
  const [blockedInput, setBlockedInput] = useState("");

  // preview month
  const previewDate = useMemo(() => new Date(), []);
  const year = previewDate.getFullYear();
  const month = previewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const todayDay = previewDate.getDate();

  function sync(overrides: Partial<{ weekdays: number[]; slots: string[]; blockedDates: string[]; taken: Record<string, string[]> }>) {
    const w = overrides.weekdays ?? weekdays;
    const s = overrides.slots ?? slots;
    const b = overrides.blockedDates ?? blockedDates;
    const t = overrides.taken ?? taken;
    const patch = buildSchedulePatch({ weekdays: w, slots: s, blockedDates: b, taken: t, monthDate: previewDate });
    const nextSchedule = { ...schedule, ...patch, blockedDates: b, weekdays: w, slots: s, taken: t };
    const nextValue: Record<string, unknown> = { ...value };
    // mantém campos de topo
    nextValue.schedule = nextSchedule;
    // também espelha/whatsapp fields no topo para compatibilidade com lib/home legacy
    onChange(nextValue);
  }

  function toggleWeekday(wd: number) {
    const next = weekdays.includes(wd) ? weekdays.filter((x) => x !== wd) : [...weekdays, wd].sort((a, b) => a - b);
    setWeekdays(next);
    sync({ weekdays: next });
  }

  function addSlot() {
    const v = newSlot.trim();
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    if (slots.includes(v)) return;
    const next = [...slots, v].sort();
    setSlots(next);
    sync({ slots: next });
    setNewSlot("");
  }

  function removeSlot(v: string) {
    const next = slots.filter((s) => s !== v);
    setSlots(next);
    // remove taken entries for that slot
    const nextTaken: Record<string, string[]> = {};
    for (const [k, arr] of Object.entries(taken)) nextTaken[k] = arr.filter((x) => x !== v);
    setTaken(nextTaken);
    sync({ slots: next, taken: nextTaken });
  }

  function addBlocked() {
    const v = blockedInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    if (blockedDates.includes(v)) return;
    const next = [...blockedDates, v].sort();
    setBlockedDates(next);
    sync({ blockedDates: next });
    setBlockedInput("");
  }

  function removeBlocked(v: string) {
    const next = blockedDates.filter((x) => x !== v);
    setBlockedDates(next);
    sync({ blockedDates: next });
  }

  function toggleTaken(day: number, time: string) {
    const key = String(day);
    const arr = taken[key] || [];
    const nextArr = arr.includes(time) ? arr.filter((x) => x !== time) : [...arr, time].sort();
    const nextTaken = { ...taken };
    if (nextArr.length === 0) delete nextTaken[key];
    else nextTaken[key] = nextArr;
    setTaken(nextTaken);
    sync({ taken: nextTaken });
  }

  function toggleBlockedDay(day: number) {
    const iso = isoForDay(year, month, day);
    const next = blockedDates.includes(iso) ? blockedDates.filter((x) => x !== iso) : [...blockedDates, iso].sort();
    setBlockedDates(next);
    sync({ blockedDates: next });
  }

  const blockedSet = new Set(blockedDates);
  const computedTakenSet = taken;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="label">Selo superior</label>
          <input className="input" value={eyebrow} onChange={(e) => onChange({ ...value, eyebrow: e.target.value, schedule: { ...schedule, eyebrow: e.target.value } })} />
        </div>
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Subtítulo</label>
          <textarea className="input min-h-16" value={subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value })} />
        </div>
        <div>
          <label className="label">Mensagem do WhatsApp (use {"{nome}"}, {"{dia}"}, {"{mes}"}, {"{hora}"})</label>
          <textarea className="input min-h-16" value={whatsappText} placeholder="Olá {nome}! Gostaria de agendar para dia {dia} de {mes} às {hora}." onChange={(e) => onChange({ ...value, whatsappText: e.target.value, schedule: { ...schedule, whatsappText: e.target.value } })} />
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Dias da semana */}
      <div>
        <p className="label">Dias da semana livres</p>
        <p className="text-xs text-gray-400 mb-2">Marque os dias em que você atende. O calendário público mostrará apenas esses dias como disponíveis.</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, idx) => {
            const active = weekdays.includes(idx);
            return (
              <button key={idx} type="button" onClick={() => toggleWeekday(idx)} className={`px-3 py-2 rounded-full text-xs font-semibold border transition ${active ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horários */}
      <div>
        <p className="label">Horários disponíveis</p>
        <p className="text-xs text-gray-400 mb-2">Defina os intervalos que aparecerão para o cliente. Use o formato 09:00. Sugestão: 09:00 – 17:30 em blocos de 30min.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {slots.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#e5f4ea] text-[#1d5c3a] text-xs font-medium">
              {s} <button type="button" onClick={() => removeSlot(s)} className="ml-1 text-[#1d5c3a]/60 hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="time" className="input max-w-[150px]" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
          <button type="button" className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={addSlot}>+ Adicionar</button>
          <button type="button" className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={() => { setSlots(["09:00","09:30","10:00","10:30","14:00","14:30","15:00","15:30"]); sync({ slots: ["09:00","09:30","10:00","10:30","14:00","14:30","15:00","15:30"] }); }}>Usar padrão</button>
        </div>
      </div>

      {/* Dias de compromisso / bloqueados */}
      <div>
        <p className="label">Dias de compromisso (bloqueados)</p>
        <p className="text-xs text-gray-400 mb-2">Datas em que você não atende — aparecerão como <b>Ocupado</b> no site e não poderão ser selecionadas.</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {blockedDates.length === 0 && <span className="text-xs text-gray-400">Nenhum dia bloqueado.</span>}
          {blockedDates.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 text-xs">
              {d} <button type="button" onClick={() => removeBlocked(d)} className="ml-1">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="date" className="input max-w-[180px]" value={blockedInput} onChange={(e) => setBlockedInput(e.target.value)} />
          <button type="button" className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={addBlocked}>Bloquear data</button>
        </div>
      </div>

      {/* Preview interativo do mês atual */}
      <div>
        <p className="label">Prévia e compromissos deste mês</p>
        <p className="text-xs text-gray-400 mb-2">Clique em um dia para <b>bloquear/liberar</b>. Depois, marque horários já confirmados (ficarão indisponíveis para o cliente).</p>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-[#1d5c3a] text-white px-4 py-3 flex items-center justify-between">
            <span className="font-medium text-sm">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(previewDate)}</span>
            <span className="text-xs opacity-80">Hoje: {todayDay}</span>
          </div>
          <div className="p-3 bg-white">
            <div className="grid grid-cols-7 gap-1 text-[0.65rem] text-gray-400 text-center mb-1">
              {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const iso = isoForDay(year, month, day);
                const isBlocked = blockedSet.has(iso);
                const wd = new Date(year, month, day).getDay();
                const isWeekdayFree = weekdays.includes(wd);
                const isToday = day === todayDay;
                const takenArr = computedTakenSet[String(day)] || [];
                const allTaken = takenArr.length >= slots.length;
                let cls = "aspect-square flex items-center justify-center rounded-full text-xs cursor-pointer border ";
                let title = "";
                if (isBlocked || allTaken) {
                  cls += "bg-red-50 text-red-700 border-red-200 line-through";
                  title = isBlocked ? "Dia bloqueado" : "Todos horários ocupados";
                } else if (isWeekdayFree) {
                  cls += "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-semibold";
                  title = "Disponível";
                } else {
                  cls += "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed";
                  title = "Fora do expediente";
                }
                if (isToday) cls += " ring-2 ring-amber-400 ring-offset-1";
                return <button key={day} type="button" title={title} onClick={() => toggleBlockedDay(day)} className={cls}>{day}</button>;
              })}
            </div>
            <div className="flex gap-3 mt-3 text-[0.7rem] text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-200 inline-block" /> Disponível</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-50 border border-red-200 inline-block" /> Ocupado / Bloqueado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-amber-400 inline-block" /> Hoje</span>
            </div>
          </div>
        </div>
      </div>

      {/* Marcar horários ocupados por dia */}
      <div>
        <p className="label">Horários já confirmados (ocupados)</p>
        <p className="text-xs text-gray-400 mb-2">Selecione o dia e marque os horários que já foram confirmados via WhatsApp. Eles ficarão visíveis como indisponíveis no site.</p>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <DayTakenEditor slots={slots} taken={taken} onToggle={toggleTaken} />
        </div>
      </div>
    </div>
  );
}

function DayTakenEditor({ slots, taken, onToggle }: { slots: string[]; taken: Record<string, string[]>; onToggle: (day: number, time: string) => void }) {
  const [activeDay, setActiveDay] = useState<string>("");
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        {days.map((d) => {
          const key = String(d);
          const count = (taken[key] || []).length;
          const isActive = activeDay === key;
          return (
            <button key={d} type="button" onClick={() => setActiveDay(isActive ? "" : key)} className={`w-8 h-8 rounded-full text-xs font-medium border ${isActive ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : count > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-white text-gray-600 border-gray-200"}`}>{d}</button>
          );
        })}
      </div>
      {activeDay ? (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Dia {activeDay} — marque os horários ocupados:</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((t) => {
              const occupied = (taken[activeDay] || []).includes(t);
              return (
                <button key={t} type="button" onClick={() => onToggle(Number(activeDay), t)} className={`py-2 rounded-lg text-xs font-medium border ${occupied ? "bg-red-50 text-red-700 border-red-200 line-through" : "bg-white text-[#1d5c3a] border-[#1d5c3a]/20 hover:bg-[#e5f4ea]"}`}>{t}</button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Escolha um dia acima para gerenciar os horários.</p>
      )}
    </div>
  );
}
