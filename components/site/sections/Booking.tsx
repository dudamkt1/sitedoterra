"use client";

import { useState, useMemo } from "react";

interface Schedule {
  monthLabel?: string;
  year?: number;
  firstWeekday?: number;
  daysInMonth?: number;
  available?: number[];
  occupied?: number[];
  today?: number;
  slots?: string[];
  taken?: Record<string, string[]>;
  weekdays?: number[];
  blockedDates?: string[];
}

export interface BookingContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  schedule?: Schedule;
  _contactWhatsapp?: string;
  whatsappText?: string;
}

function normalizePublicSchedule(s: Schedule) {
  // se já tem available/occupied, usa direto; caso tenha weekdays, já vem computado pelo editor
  return s;
}

export function Booking({ content, contactWhatsapp, profileName }: { content: BookingContent; contactWhatsapp?: string; profileName?: string }) {
  const rawSchedule = content.schedule || {};
  const schedule = useMemo(() => normalizePublicSchedule(rawSchedule as Schedule), [rawSchedule]);
  const daysInMonth = schedule.daysInMonth || 30;
  const firstWeekday = schedule.firstWeekday ?? 0;
  const available = schedule.available || [];
  const occupied = schedule.occupied || [];
  const today = schedule.today;
  const slots = schedule.slots || [];
  const taken = schedule.taken || {};
  const monthLabel = schedule.monthLabel || "Mês";
  const monthName = monthLabel.split(" ")[0];

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmHref, setConfirmHref] = useState("#");

  const whatsapp = contactWhatsapp || content._contactWhatsapp || "5511999999999";
  const wppLink = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
  const name = profileName || "consultora";

  function clearSelection() {
    setSelectedDay(null);
    setShowSlots(false);
    setSelectedSlot(null);
    setConfirmHref("#");
  }

  function selectDay(day: number) {
    if (occupied.includes(day) || !available.includes(day)) return;
    setSelectedDay(day);
    setShowSlots(true);
    setSelectedSlot(null);
    setConfirmHref("#");
  }

  function selectSlot(time: string) {
    if (!selectedDay) return;
    setSelectedSlot(time);
    const text = content.whatsappText
      ? content.whatsappText
          .replace(/{nome}/g, name)
          .replace(/{dia}/g, String(selectedDay))
          .replace(/{mes}/g, monthName)
          .replace(/{hora}/g, time)
      : `Olá ${name}! Gostaria de agendar uma consulta para o dia ${selectedDay} de ${monthName} às ${time}. Pode confirmar por favor?`;
    setConfirmHref(`${wppLink}?text=${encodeURIComponent(text)}`);
  }

  const days: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    days.push(<div key={`e${i}`} className="cal-day empty"></div>);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === today;
    const isAvailable = available.includes(day);
    const isOccupied = occupied.includes(day);
    // today tem destaque próprio; se for ocupado, mantém ocupado visual
    const cls =
      "cal-day" +
      (isToday ? " today" : "") +
      (isAvailable ? " available" : "") +
      (isOccupied ? " occupied" : "") +
      (selectedDay === day ? " selected" : "") +
      (!isAvailable && !isOccupied ? " disabled" : "");
    days.push(
      <div
        key={day}
        className={cls}
        onClick={() => selectDay(day)}
        title={isOccupied ? "Ocupado / Bloqueado" : isAvailable ? "Disponível — clique para ver horários" : "Indisponível"}
        role="button"
        aria-disabled={isOccupied || !isAvailable}
      >
        {day}
      </div>
    );
  }

  const dayTaken = selectedDay ? taken[String(selectedDay)] || [] : [];

  return (
    <section id="agendamento">
      <div style={{ marginBottom: "3rem" }} className="reveal">
        <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "Agenda da consultora"}</span></div>
        <h2 className="section-title">{content.title || "Agende sua consulta gratuita"}</h2>
        {content.subtitle && <p className="section-sub">{content.subtitle}</p>}
      </div>
      <div className="agendamento-inner">
        <div className="calendar-widget reveal">
          <div className="cal-header">
            <span className="cal-month">{monthLabel}</span>
            <div className="cal-nav"><button className="cal-nav-btn" aria-label="Mês anterior">‹</button><button className="cal-nav-btn" aria-label="Próximo mês">›</button></div>
          </div>
          <div className="cal-body">
            <div className="cal-weekdays">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((w) => (
                <span className="cal-weekday" key={w}>{w}</span>
              ))}
            </div>
            <div className="cal-days">{days}</div>
          </div>
          <div className="cal-legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: "#dcfce7", border: "1.5px solid #22c55e" }}></div><b>Disponível</b></div>
            <div className="legend-item"><div className="legend-dot" style={{ background: "#fee2e2", border: "1px solid #fecaca" }}></div><b>Ocupado</b></div>
            {today !== undefined && <div className="legend-item"><div className="legend-dot" style={{ background: "#fffbeb", border: "2.5px solid #f59e0b" }}></div><b>Hoje</b></div>}
          </div>
        </div>
        <div className="reveal" style={{ transitionDelay: "0.2s" }}>
          {!showSlots && (
            <div id="selectPrompt" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, flexDirection: "column", gap: 12, border: "2px dashed rgba(22,101,52,0.18)", borderRadius: 12, background: "#f0fdf4" }}>
              <span style={{ display: "inline-flex", color: "#166534" }} aria-hidden>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  <path d="M8 14h3M12 18h0.01" opacity="0.0" />
                </svg>
              </span>
              <p style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600, textAlign: "center" }}>Selecione um dia <span style={{ background: "#dcfce7", padding: "1px 6px", borderRadius: 999, border: "1px solid #22c55e" }}>Disponível</span> no calendário</p>
              <p style={{ fontSize: "0.72rem", color: "#6b7280" }}>Dias em verde estão livres para agendamento</p>
            </div>
          )}
          {showSlots && (
            <div className="time-slots">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="time-slots-title !mb-0" id="selectedDate">
                  Horários — {selectedDay} de {monthName}
                </p>
                <button type="button" onClick={clearSelection} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  Limpar
                </button>
              </div>
              <div className="slots-grid" id="slotsGrid">
                {slots.map((t) => {
                  const isTaken = dayTaken.includes(t);
                  return (
                    <div
                      key={t}
                      className={"slot" + (isTaken ? " taken" : "") + (selectedSlot === t ? " selected" : "")}
                      onClick={() => !isTaken && selectSlot(t)}
                      title={isTaken ? "Horário já ocupado" : "Clique para selecionar"}
                    >
                      {t}
                    </div>
                  );
                })}
              </div>
              <p className="text-[0.7rem] text-gray-500 mt-2 flex gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#dcfce7] border border-[#22c55e]" /> livre</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fee2e2] border border-[#fecaca]" /> ocupado</span>
              </p>
            </div>
          )}
          {confirmHref && confirmHref !== "#" && (
            <div id="wppConfirm" style={{ marginTop: "1.5rem", padding: "1.5rem", background: "#f0fdf4", borderRadius: 12, border: "1.5px solid #bbf7d0" }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600, marginBottom: "0.4rem" }}>✓ Horário selecionado: {selectedDay} de {monthName} às {selectedSlot}</p>
                <button type="button" onClick={clearSelection} className="text-xs font-semibold text-gray-500 hover:text-red-600 underline shrink-0">Limpar seleção</button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "1rem" }}>Você será direcionada ao WhatsApp da consultora. Ela confirma e o horário ficará marcado como <b style={{ color: "#991b1b", background: "#fee2e2", padding: "0 6px", borderRadius: 999 }}>Ocupado</b> para os próximos clientes.</p>
              <div className="flex flex-wrap gap-2">
                <a href={confirmHref} target="_blank" rel="noopener noreferrer" className="ia-wpp-btn" style={{ fontSize: "0.82rem", padding: "0.85rem 1.5rem", background: "#25D366", fontWeight: 700, borderRadius: 999, boxShadow: "0 6px 18px rgba(37,211,102,0.28)" }}>
                  Confirmar no WhatsApp →
                </a>
                <button type="button" onClick={clearSelection} className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Trocar horário
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
