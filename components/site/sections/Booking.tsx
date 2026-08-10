"use client";

import { useState } from "react";

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
}

export interface BookingContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  schedule?: Schedule;
  _contactWhatsapp?: string;
  whatsappText?: string;
}

export function Booking({ content, contactWhatsapp, profileName }: { content: BookingContent; contactWhatsapp?: string; profileName?: string }) {
  const schedule = content.schedule || {};
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
  const wppLink = `https://wa.me/${whatsapp}`;
  const name = profileName || "profissional";

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
      : `Olá ${name}! Gostaria de agendar uma consulta para o dia ${selectedDay} de ${monthName} às ${time}.`;
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
    days.push(
      <div
        key={day}
        className={
          "cal-day" +
          (isToday ? " today" : "") +
          (isAvailable ? " available" : "") +
          (isOccupied ? " occupied" : "") +
          (selectedDay === day ? " selected" : "")
        }
        onClick={() => selectDay(day)}
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
            <div className="cal-nav"><button className="cal-nav-btn">‹</button><button className="cal-nav-btn">›</button></div>
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
            <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(45,122,79,0.1)", border: "1px solid rgba(45,122,79,0.3)" }}></div>Disponível</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(0,0,0,0.08)" }}></div>Ocupado</div>
            {today !== undefined && <div className="legend-item"><div className="legend-dot" style={{ border: "2px solid var(--ouro)" }}></div>Hoje</div>}
          </div>
        </div>
        <div className="reveal" style={{ transitionDelay: "0.2s" }}>
          {!showSlots && (
            <div id="selectPrompt" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, flexDirection: "column", gap: 12, border: "2px dashed rgba(29,92,58,0.15)", borderRadius: 12 }}>
              <span style={{ fontSize: "2rem" }}>📅</span>
              <p style={{ fontSize: "0.85rem", color: "var(--cinza-claro)", textAlign: "center" }}>Selecione um dia disponível<br />no calendário</p>
            </div>
          )}
          {showSlots && (
            <div className="time-slots">
              <p className="time-slots-title" id="selectedDate">
                Horários — {selectedDay} de {monthName}
              </p>
              <div className="slots-grid" id="slotsGrid">
                {slots.map((t) => (
                  <div
                    key={t}
                    className={"slot" + (dayTaken.includes(t) ? " taken" : "") + (selectedSlot === t ? " selected" : "")}
                    onClick={() => !dayTaken.includes(t) && selectSlot(t)}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
          {confirmHref && confirmHref !== "#" && (
            <div id="wppConfirm" style={{ marginTop: "1.5rem", padding: "1.5rem", background: "var(--creme)", borderRadius: 12, border: "1px solid rgba(29,92,58,0.1)" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--cinza)", marginBottom: "1rem" }}>Ótimo! Clique abaixo para confirmar pelo WhatsApp:</p>
              <a href={confirmHref} target="_blank" className="ia-wpp-btn" style={{ fontSize: "0.82rem", padding: "0.8rem 1.5rem" }}>
                Confirmar pelo WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
