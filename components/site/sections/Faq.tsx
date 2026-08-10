"use client";

import { useState } from "react";

interface FaqItem {
  q?: string;
  a?: string;
}

export interface FaqContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  items?: FaqItem[];
}

export function Faq({ content }: { content: FaqContent }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = content.items || [];
  if (items.length === 0) return null;

  return (
    <section id="faq">
      <div className="reveal">
        <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "Tiro suas dúvidas"}</span></div>
        <h2 className="section-title">{content.title || "Perguntas frequentes"}</h2>
        {content.subtitle && <p className="section-sub" style={{ marginTop: "1rem" }}>{content.subtitle}</p>}
        <a href="#about" className="btn-primary" style={{ display: "inline-flex", marginTop: "2rem", background: "var(--verde)" }}>Perguntar à IA →</a>
      </div>
      <div className="faq-list reveal" style={{ transitionDelay: "0.2s" }} id="faqList">
        {items.map((f, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className={"faq-item" + (isOpen ? " open" : "")} onClick={() => setOpenIndex(isOpen ? null : i)}>
              <div className="faq-q"><span className="faq-q-text">{f.q}</span><span className="faq-icon">+</span></div>
              <div className="faq-a">{f.a}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
