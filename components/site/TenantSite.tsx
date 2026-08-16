"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicTenant } from "@/types";
import { DEFAULT_SITE_DATA, type SiteData } from "@/lib/site-data";

export { DEFAULT_SITE_DATA, type SiteData };


const CHAT_RESPONSES = {
  default: { text: "Entendi! Baseado no que você descreveu, recomendo:", oils: ["Lavender", "Balance", "Serenity"] },
  ansiedade: { text: "Para ansiedade e sono, os óleos mais indicados são:", oils: ["Lavender", "Serenity", "Balance", "Vetiver"] },
  dor: { text: "Para alívio de dores de cabeça, recomendo:", oils: ["Peppermint", "Deep Blue", "PastTense"] },
  imunidade: { text: "Para fortalecer a imunidade naturalmente:", oils: ["On Guard", "Oregano", "Frankincense"] },
  energia: { text: "Para mais energia e clareza mental:", oils: ["Peppermint", "Wild Orange", "Motivate", "InTune"] },
};

function getResponse(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("ansiedad") || m.includes("sono") || m.includes("dormir")) return CHAT_RESPONSES.ansiedade;
  if (m.includes("dor") || m.includes("cabe")) return CHAT_RESPONSES.dor;
  if (m.includes("imunid") || m.includes("grippe") || m.includes("resfriado")) return CHAT_RESPONSES.imunidade;
  if (m.includes("energia") || m.includes("cansad") || m.includes("disposiç")) return CHAT_RESPONSES.energia;
  return CHAT_RESPONSES.default;
}

interface ExtraNavItem {
  label: string;
  href: string;
  className?: string;
}

export function TenantSite({
  tenant,
  extraNav = [],
}: {
  tenant: PublicTenant;
  extraNav?: ExtraNavItem[];
}) {
  const rawData = (tenant.site_data || {}) as SiteData;
  const data: SiteData = { ...DEFAULT_SITE_DATA, ...rawData };
  const fullName = data.fullName || `${data.name || "Ana"} ${data.surname || "Beatriz"}`.trim();
  const firstName = data.name || fullName.split(" ")[0] || "Ana";
  const whatsapp = data.whatsapp || "5511999999999";
  const wppLink = `https://wa.me/${whatsapp}`;

  const navRef = useRef<HTMLElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const calDaysRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>("Horários disponíveis");
  const [showSlots, setShowSlots] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmHref, setConfirmHref] = useState("#");

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll("#tenant-site .reveal").forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!calDaysRef.current) return;
    const s = data.schedule!;
    const grid = calDaysRef.current;
    grid.innerHTML = "";
    for (let i = 0; i < s.firstWeekday; i++) {
      const d = document.createElement("div");
      d.className = "cal-day empty";
      grid.appendChild(d);
    }
    for (let day = 1; day <= s.daysInMonth; day++) {
      const el = document.createElement("div");
      el.className = "cal-day";
      el.textContent = String(day);
      if (day === s.today) el.classList.add("today");
      if (s.available.includes(day)) el.classList.add("available");
      if (s.occupied.includes(day)) el.classList.add("occupied");
      if (!s.occupied.includes(day) && s.available.includes(day)) {
        el.addEventListener("click", () => selectDay(day, el));
      }
      grid.appendChild(el);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectDay(day: number, el: HTMLDivElement) {
    document.querySelectorAll("#tenant-site .cal-day").forEach((d) => d.classList.remove("selected"));
    el.classList.add("selected");
    setSelectedDate(`Horários — ${day} de ${data.schedule?.monthLabel.split(" ")[0]}`);
    const s = data.schedule!;
    const grid = document.getElementById("slotsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const taken = s.taken?.[String(day)] || [];
    s.slots.forEach((t) => {
      const slot = document.createElement("div");
      slot.className = "slot" + (taken.includes(t) ? " taken" : "");
      slot.textContent = t;
      if (!taken.includes(t)) {
        slot.addEventListener("click", () => selectSlot(t, day));
      }
      grid.appendChild(slot);
    });
    setShowSlots(true);
    setShowConfirm(false);
  }

  function selectSlot(time: string, day: number) {
    document.querySelectorAll<HTMLElement>("#tenant-site .slot").forEach((s) => (s.style.background = ""));
    setConfirmHref(`${wppLink}?text=Olá ${firstName}! Gostaria de agendar uma consulta para o dia ${day} de ${data.schedule?.monthLabel.split(" ")[0]} às ${time}.`);
    setShowConfirm(true);
  }

  function sendChat() {
    const input = chatInputRef.current;
    const msgs = chatMessagesRef.current;
    if (!input || !msgs) return;
    const msg = input.value.trim();
    if (!msg) return;
    const userMsg = document.createElement("div");
    userMsg.className = "msg user";
    userMsg.innerHTML = `<div class="msg-bubble">${escapeHtml(msg)}</div><span class="msg-time">agora</span>`;
    msgs.appendChild(userMsg);
    input.value = "";
    msgs.scrollTop = msgs.scrollHeight;

    const typing = document.createElement("div");
    typing.className = "msg bot";
    typing.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    setTimeout(() => {
      typing.remove();
      const resp = getResponse(msg);
      const botMsg = document.createElement("div");
      botMsg.className = "msg bot";
      botMsg.innerHTML = `
        <div class="ia-oil-suggestion">
          <div class="oil-title">✨ ${resp.text}</div>
          <div class="ia-oil-chips">${resp.oils.map((o) => `<span class="oil-chip">${o}</span>`).join("")}</div>
          <a href="${wppLink}" target="_blank" class="ia-wpp-btn" style="color:#fff;font-weight:600;background:#1D5C3A;padding:0.6rem 1.2rem;border-radius:8px;font-size:0.82rem;display:inline-flex;gap:8px;align-items:center;text-decoration:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.133.558 4.135 1.535 5.875L0 24l6.29-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
            Conversar com ${firstName}
          </a>
        </div>
        <span class="msg-time">agora</span>
      `;
      msgs.appendChild(botMsg);
      msgs.scrollTop = msgs.scrollHeight;
    }, 1600);
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function toggleFaq(item: HTMLDivElement) {
    const wasOpen = item.classList.contains("open");
    document.querySelectorAll("#tenant-site .faq-item").forEach((i) => i.classList.remove("open"));
    if (!wasOpen) item.classList.add("open");
  }

  function toggleMobileMenu() {
    const links = document.querySelector("#tenant-site .nav-links") as HTMLElement | null;
    if (links) links.style.display = links.style.display === "flex" ? "none" : "flex";
  }

  const navItems = [
    ["#ia", "Especialista IA"],
    ["#depoimentos", "Depoimentos"],
    ["#historia", "História"],
    ["#agendamento", "Agendar"],
    ["#produtos", "Produtos"],
    ["#faq", "Dúvidas"],
  ];

  return (
    <div id="tenant-site" data-slug={tenant.slug}>
      {/* NAV */}
      <nav ref={navRef}>
        <a href="#" className="nav-logo">{fullName}</a>
        <ul className="nav-links">
          {navItems.map(([href, label]) => (
            <li key={href}><a href={href}>{label}</a></li>
          ))}
          {extraNav.map((item) => (
            <li key={item.href}>
              <a href={item.href} className={item.className || "nav-extra-link"}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <button className="hamburger" onClick={toggleMobileMenu} aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* HERO */}
      <section id="hero">
        <div className="hero-bg-elements">
          <div className="hero-circle-1"></div>
          <div className="hero-circle-2"></div>
          <div className="hero-line"></div>
          <div className="hero-dots">
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line"></span>
            <span>{data.eyebrow}</span>
          </div>
          <h1 className="hero-name">{firstName} <em>{data.surname}</em></h1>
          <p className="hero-cargo">{data.role}</p>
          <p className="hero-desc">{data.description}</p>
          <div className="hero-btns">
            <a href="#ia" className="btn-primary">Falar com a IA</a>
            <a href="#produtos" className="btn-secondary">Ver Produtos →</a>
          </div>
          <div className="hero-stats">
            <div><span className="hero-stat-num">{data.stats?.years}</span><span className="hero-stat-label">{data.stats?.labelYears}</span></div>
            <div><span className="hero-stat-num">{data.stats?.clients}</span><span className="hero-stat-label">{data.stats?.labelClients}</span></div>
            <div><span className="hero-stat-num">{data.stats?.satisfaction}</span><span className="hero-stat-label">{data.stats?.labelSatisfaction}</span></div>
          </div>
        </div>
        <div className="hero-image-wrap">
          <div className="hero-img-deco"></div>
          <div className="hero-img-frame">
            <div className="hero-img-placeholder">
              <svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="28" r="14" stroke="white" strokeWidth="1.5"/><path d="M10 70c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <p>Foto da Consultora</p>
            </div>
          </div>
          <div className="hero-badge">
            <div className="hero-badge-icon">🌿</div>
            <div className="hero-badge-text">
              <strong>{data.badgeTitle || "Certified Wellness"}</strong>
              <span>{data.badgeSubtitle || "doTERRA Diamond Rank"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* VITRINE CTA */}
      <div className="vitrine-cta-banner">
        <div className="vitrine-cta-text">
          <span className="star">✨</span>
          <div>
            <p>Você é consultora doTERRA? Tenha um site profissional como este!</p>
            <span>Ferramenta completa com IA, agendamento, CRM e muito mais</span>
          </div>
        </div>
        <a href="#planos" className="btn-vitrine">Quero um site assim →</a>
      </div>

      {/* IA */}
      <section id="ia">
        <div className="reveal">
          <div className="section-eyebrow">
            <span className="eyebrow-line"></span>
            <span className="eyebrow-text">Tecnologia + Natureza</span>
          </div>
          <h2 className="section-title">Especialista <em>IA</em><br />doTERRA</h2>
          <p className="section-sub">Descreva como você está se sentindo — física ou emocionalmente — e nossa inteligência artificial vai indicar os melhores óleos essenciais para o seu momento.</p>
          <div style={{ marginTop: "2.5rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {["😴 Ansiedade e sono", "🤕 Dor de cabeça", "🛡️ Imunidade"].map((chip) => (
                <span
                  key={chip}
                  onClick={() => {
                    const input = chatInputRef.current;
                    if (input) {
                      input.value = chip.split(" ").slice(1).join(" ");
                      sendChat();
                    }
                  }}
                  style={{ cursor: "pointer", background: "rgba(29,92,58,0.07)", border: "1px solid rgba(29,92,58,0.15)", borderRadius: 20, padding: "0.4rem 1rem", fontSize: "0.78rem", color: "var(--verde)" }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="ia-chat-window reveal" style={{ transitionDelay: "0.2s" }}>
          <div className="ia-chat-header">
            <div className="ia-chat-avatar">🤖</div>
            <div>
              <div className="ia-chat-name">Especialista IA doTERRA</div>
              <div className="ia-chat-status">Online agora</div>
            </div>
          </div>
          <div className="ia-messages" id="chatMessages" ref={chatMessagesRef}>
            <div className="msg bot">
              <div className="msg-bubble">Olá! Sou a assistente especialista em óleos essenciais doTERRA 🌿 Me conte como você está se sentindo hoje — fisicamente ou emocionalmente — e vou indicar os melhores óleos para o seu momento!</div>
              <span className="msg-time">agora</span>
            </div>
          </div>
          <div className="ia-input-row">
            <input className="ia-input" ref={chatInputRef} type="text" placeholder="Como você está se sentindo?" onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <button className="ia-send-btn" onClick={sendChat} aria-label="Enviar">
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos">
        <div className="depoimentos-header">
          <div className="reveal">
            <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">O que dizem por aí</span></div>
            <h2 className="section-title">Histórias que me<br /><em>inspiram todo dia</em></h2>
          </div>
          <p className="section-sub reveal" style={{ transitionDelay: "0.15s" }}>Cada depoimento é uma vida transformada pela natureza.</p>
        </div>
        <div className="depoimentos-grid">
          {data.testimonials?.map((t, i) => (
            <div key={i} className={"dep-card reveal" + (i === 1 ? " featured" : "")} style={{ transitionDelay: `${i * 0.15}s` }}>
              <div className="dep-quote">&quot;</div>
              <p className="dep-text">{t.text}</p>
              <div className="dep-stars">★★★★★</div>
              <div className="dep-author">
                <div className="dep-avatar">{t.initials}</div>
                <div><div className="dep-author-name">{t.name}</div><div className="dep-author-loc">{t.location}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HISTÓRIA */}
      <section id="historia">
        <div className="historia-img-wrap reveal">
          <div className="historia-img-main">
            <div className="historia-img-placeholder">
              <svg width="60" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="28" r="14" stroke="white" strokeWidth="1.5"/><path d="M10 70c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <p>Foto da Consultora</p>
            </div>
          </div>
          <div className="historia-img-deco"></div>
          <div className="historia-badge"><span className="historia-badge-num">{data.stats?.years}</span><span className="historia-badge-label">transformando vidas</span></div>
        </div>
        <div className="historia-text reveal" style={{ transitionDelay: "0.2s" }}>
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Minha jornada</span></div>
          <h2 className="section-title">Uma história de<br /><em>cura e propósito</em></h2>
          {data.history?.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <p className="historia-assinatura">{data.history?.signature}</p>
        </div>
      </section>

      {/* VÍDEO */}
      <section id="video">
        <div className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Assista agora</span></div>
          <h2 className="section-title">O que são óleos<br /><em>essenciais puros?</em></h2>
          <p className="section-sub">Neste vídeo explico de forma simples como os óleos funcionam, por que a pureza faz toda a diferença e como começar sua jornada com segurança.</p>
        </div>
        <div className="video-frame reveal" style={{ transitionDelay: "0.2s" }}>
          <div className="video-thumb">
            <div className="video-play-btn"><div className="video-play-icon"></div></div>
            <span className="video-label">{data.video?.label}</span>
          </div>
        </div>
      </section>

      {/* AGENDAMENTO */}
      <section id="agendamento">
        <div style={{ marginBottom: "3rem" }} className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Agenda da consultora</span></div>
          <h2 className="section-title">Agende sua<br /><em>consulta gratuita</em></h2>
          <p className="section-sub">Escolha o melhor dia e horário. Após a seleção, você será direcionada ao WhatsApp para confirmar.</p>
        </div>
        <div className="agendamento-inner">
          <div className="calendar-widget reveal">
            <div className="cal-header">
              <span className="cal-month">{data.schedule?.monthLabel}</span>
              <div className="cal-nav"><button className="cal-nav-btn">‹</button><button className="cal-nav-btn">›</button></div>
            </div>
            <div className="cal-body">
              <div className="cal-weekdays">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((w) => <span className="cal-weekday" key={w}>{w}</span>)}
              </div>
              <div className="cal-days" id="calDays" ref={calDaysRef}></div>
            </div>
            <div className="cal-legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(45,122,79,0.1)", border: "1px solid rgba(45,122,79,0.3)" }}></div>Disponível</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(0,0,0,0.08)" }}></div>Ocupado</div>
              <div className="legend-item"><div className="legend-dot" style={{ border: "2px solid var(--ouro)" }}></div>Hoje</div>
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
                <p className="time-slots-title" id="selectedDate">{selectedDate}</p>
                <div className="slots-grid" id="slotsGrid"></div>
              </div>
            )}
            {showConfirm && (
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

      {/* INSTAGRAM */}
      <section id="instagram">
        <div className="insta-header">
          <div className="reveal">
            <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Acompanhe no Instagram</span></div>
            <h2 className="section-title">Dicas, rotinas e<br /><em>momentos reais</em></h2>
          </div>
          <a href={data.instagram ? `https://instagram.com/${data.instagram}` : "https://instagram.com"} target="_blank" className="insta-link reveal">{data.instagramHandle || "@seu.instagram"} ↗</a>
        </div>
        <div className="insta-grid">
          {[["🌿", "linear-gradient(135deg, #d4e8d4 0%, #a8d5b5 100%)"], ["🍋", "linear-gradient(135deg, #f5e6d0 0%, #e8c87a 100%)"], ["🌸", "linear-gradient(135deg, #c8e6d4 0%, #1D5C3A 100%)"], ["🧴", "linear-gradient(135deg, #fbe8d0 0%, #C4963A 100%)"], ["🌱", "linear-gradient(135deg, #e0f2e8 0%, #4A9E6B 100%)"]].map(([e, g], i) => (
            <div key={i} className="insta-item reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="insta-item-inner" style={{ background: g }}>{e}</div>
              <div className="insta-overlay"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/></svg></div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUTOS */}
      <section id="produtos">
        <div className="produtos-header">
          <div className="reveal">
            <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Favoritos da {firstName}</span></div>
            <h2 className="section-title">Produtos <em>em destaque</em></h2>
          </div>
          <a href={wppLink} target="_blank" className="insta-link reveal">Ver loja completa ↗</a>
        </div>
        <div className="produtos-grid">
          {data.products?.map((p, i) => (
            <div key={i} className="produto-card reveal" style={{ transitionDelay: `${i * 0.15}s` }}>
              <div className="produto-img" style={{ background: p.gradient }}>
                <span>{p.emoji}</span>
                {p.badge && <span className="produto-badge-tag">{p.badge}</span>}
              </div>
              <div className="produto-body">
                <div className="produto-cat">{p.category}</div>
                <div className="produto-name">{p.name}</div>
                <p className="produto-desc">{p.description}</p>
                <div className="produto-footer">
                  <span className="produto-price">{p.price}</span>
                  <a href={wppLink} target="_blank" className="produto-btn">Comprar</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Tiro suas dúvidas</span></div>
          <h2 className="section-title">Perguntas<br /><em>frequentes</em></h2>
          <p className="section-sub" style={{ marginTop: "1rem" }}>Não encontrou sua dúvida? Fale diretamente com a IA ou pelo WhatsApp.</p>
          <a href="#ia" className="btn-primary" style={{ display: "inline-flex", marginTop: "2rem", background: "var(--verde)" }}>Perguntar à IA →</a>
        </div>
        <div className="faq-list reveal" style={{ transitionDelay: "0.2s" }} id="faqList">
          {data.faq?.map((f, i) => (
            <div key={i} className="faq-item" onClick={(e) => toggleFaq(e.currentTarget)}>
              <div className="faq-q"><span className="faq-q-text">{f.q}</span><span className="faq-icon">+</span></div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS CTA */}
      <section id="planos">
        <div className="planos-inner">
          <div className="planos-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">Seja uma TopConsultora</span><span className="eyebrow-line"></span></div>
          <h2 className="planos-title">Tenha um site assim<br /><em>hoje mesmo</em></h2>
          <p className="planos-sub">Sem precisar de programador. Pronto em minutos. Com IA, agendamento, CRM e muito mais.</p>
          <div className="planos-cards">
            <div className="plano-card">
              <div className="plano-tipo">Plano Mensal</div>
              <div className="plano-preco"><sup>R$</sup>97</div>
              <div className="plano-period">por mês</div>
              <hr className="plano-divider" />
              <ul className="plano-features">
                <li>Site profissional personalizado</li>
                <li>Chat IA especialista doTERRA</li>
                <li>Agendamento integrado</li>
                <li>CRM de clientes</li>
                <li>Todas as ferramentas</li>
                <li>Suporte por WhatsApp</li>
              </ul>
              <a href="#planos" className="btn-plano">Começar agora</a>
            </div>
            <div className="plano-card destaque">
              <div className="plano-badge">⭐ Mais popular</div>
              <div className="plano-tipo">Plano Anual</div>
              <div className="plano-preco"><sup>R$</sup>299</div>
              <div className="plano-period">pagamento único · 12 meses</div>
              <div className="plano-economia">= R$ 24,75/mês — Economize 75%!</div>
              <hr className="plano-divider" />
              <ul className="plano-features">
                <li>Tudo do plano mensal</li>
                <li>Domínio próprio incluso</li>
                <li>Base de conhecimento IA</li>
                <li>Relatórios avançados</li>
                <li>Prioridade no suporte</li>
                <li>Novidades em primeira mão</li>
              </ul>
              <a href="#planos" className="btn-plano">Quero o anual!</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-top">
          <div className="footer-brand">
            <span className="footer-logo">{fullName}</span>
            <p>Consultora doTERRA Diamond ajudando famílias a descobrirem o poder dos óleos essenciais puros.</p>
            <div className="footer-socials">
              {data.social?.whatsapp !== false && (
                <a href={wppLink} target="_blank" rel="noopener noreferrer" className="footer-social" title="WhatsApp">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.133.558 4.135 1.535 5.875L0 24l6.29-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
                </a>
              )}
              {(() => {
                const insta = data.social?.instagram;
                const url = insta && typeof insta === "object" && insta.url
                  ? insta.url
                  : data.instagram
                    ? `https://instagram.com/${data.instagram}`
                    : "";
                const enabled = insta === undefined ? !!url : typeof insta === "object" ? insta.enabled !== false && !!url : insta !== false;
                if (!enabled) return null;
                return (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="footer-social" title="Instagram">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/></svg>
                  </a>
                );
              })()}
              {(() => {
                const fb = data.social?.facebook;
                if (!fb) return null;
                const url = typeof fb === "object" ? fb.url || "" : "";
                if (!url) return null;
                return (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="footer-social" title="Facebook">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                );
              })()}
              {(() => {
                const yt = data.social?.youtube;
                if (!yt) return null;
                const url = typeof yt === "object" ? yt.url || "" : "";
                if (!url) return null;
                return (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="footer-social" title="YouTube">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                  </a>
                );
              })()}
            </div>
          </div>
          <div className="footer-links">
            <h4>Navegação</h4>
            <ul>
              {navItems.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}
            </ul>
          </div>
          <div className="footer-links">
            <h4>Contato</h4>
            <ul>
              <li><a href={wppLink} target="_blank">WhatsApp</a></li>
              <li><a href={`mailto:${data.email || "contato@email.com"}`}>E-mail</a></li>
              <li><a href="#">Loja doTERRA</a></li>
              <li><a href="#">Instagram</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Política de Privacidade</a></li>
              <li><a href="#">Termos de Uso</a></li>
              <li><a href="#">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-copy">© {new Date().getFullYear()} {fullName} | Feito com ♥ pela <a href="#">TopConsultores</a></p>
          <p className="footer-copy">Consultora Independente doTERRA — as opiniões expressas são pessoais e não representam a doTERRA International.</p>
        </div>
      </footer>
    </div>
  );
}
