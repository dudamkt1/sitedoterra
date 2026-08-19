"use client";

import { useRef, useState } from "react";
import { findIaResponse, type IaTrainingEntry } from "@/lib/ia-knowledge";

interface Chip {
  emoji?: string;
  label?: string;
}

interface ChatConfig {
  name?: string;
  status?: string;
  welcome?: string;
  placeholder?: string;
}

export interface AboutContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  chips?: Chip[];
  chat?: ChatConfig;
  knowledge?: IaTrainingEntry[];
  _contactWhatsapp?: string;
}

interface ChatMsg {
  id: number;
  kind: "bot" | "user";
  html: string;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildBotHtml(text: string, oils: string[], whatsapp: string, profileName: string, redirectWhatsApp = false): string {
  const oilsHtml =
    oils.length > 0
      ? `<div class="ia-oil-chips">${oils.map((o) => `<span class="oil-chip">${escapeHtml(o)}</span>`).join("")}</div>`
      : "";
  return `
    <div class="ia-oil-suggestion">
      <div class="oil-title">✨ ${escapeHtml(text)}</div>
      ${oilsHtml}
      <a href="${whatsapp}" target="_blank" class="ia-wpp-btn" style="color:#fff;font-weight:600;background:#1D5C3A;padding:0.6rem 1.2rem;border-radius:8px;font-size:0.82rem;display:inline-flex;gap:8px;align-items:center;text-decoration:none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.133.558 4.135 1.535 5.875L0 24l6.29-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
        ${redirectWhatsApp ? "Falar com a consultora" : "Conversar agora"}
      </a>
    </div>
    <span class="msg-time">agora</span>
  `;
}

interface ChatApiResponse {
  text: string;
  oils: string[];
  matched: boolean;
  redirectWhatsApp: boolean;
  whatsapp?: string;
  profileName?: string;
}

export function About({
  content,
  contactWhatsapp,
  profileName,
  slug,
}: {
  content: AboutContent;
  contactWhatsapp?: string;
  profileName?: string;
  slug?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 0, kind: "bot", html: `<div class="msg-bubble">${escapeHtml(content.chat?.welcome || "")}</div><span class="msg-time">agora</span>` },
  ]);
  const [typing, setTyping] = useState(false);

  const chat = content.chat || {};
  const whatsapp = contactWhatsapp || content._contactWhatsapp || "5511999999999";
  const wppLink = `https://wa.me/${whatsapp}`;
  const name = profileName || "profissional";

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }

  function pushMessage(msg: ChatMsg) {
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
  }

  async function sendChat(raw?: string) {
    const input = inputRef.current;
    const value = (raw ?? input?.value ?? "").trim();
    if (!value || typing) return;
    if (input) input.value = "";
    pushMessage({ id: Date.now(), kind: "user", html: `<div class="msg-bubble">${escapeHtml(value)}</div><span class="msg-time">agora</span>` });

    setTyping(true);
    scrollToBottom();

    let resp: ChatApiResponse | null = null;
    if (slug) {
      try {
        const res = await fetch("/api/ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: value, slug }),
        });
        if (res.ok) {
          const json = (await res.json()) as Partial<ChatApiResponse>;
          resp = {
            text: json.text || "Ainda não sei responder isso com segurança!",
            oils: json.oils || [],
            matched: json.matched ?? false,
            redirectWhatsApp: json.redirectWhatsApp ?? false,
            whatsapp: json.whatsapp,
            profileName: json.profileName,
          };
        }
      } catch {
        // falha de rede → usa o match local abaixo
      }
    }

    if (!resp) {
      const local = findIaResponse(value, content.knowledge);
      resp = {
        text: local.text,
        oils: local.oils,
        matched: local.matched,
        redirectWhatsApp: !local.matched,
        whatsapp,
        profileName: name,
      };
    }

    const finalWpp = resp.whatsapp || whatsapp;
    const finalWppLink = `https://wa.me/${finalWpp}`;
    const finalName = resp.profileName || name;

    setTimeout(() => {
      setTyping(false);
      pushMessage({
        id: Date.now(),
        kind: "bot",
        html: buildBotHtml(resp!.text, resp!.oils, finalWppLink, finalName, resp!.redirectWhatsApp),
      });
    }, 900);
  }

  return (
    <section id="about">
      <div className="reveal">
        <div className="section-eyebrow">
          <span className="eyebrow-line"></span>
          <span className="eyebrow-text">{content.eyebrow || "Tecnologia + Natureza"}</span>
        </div>
        <h2 className="section-title">
          {content.title || "Especialista IA"}
        </h2>
        {content.subtitle && <p className="section-sub">{content.subtitle}</p>}
        {content.chips && content.chips.length > 0 && (
          <div style={{ marginTop: "2.5rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {content.chips.map((chip, i) => (
                <span
                  key={i}
                  onClick={() => sendChat(chip.label)}
                  style={{ cursor: "pointer", background: "rgba(29,92,58,0.07)", border: "1px solid rgba(29,92,58,0.15)", borderRadius: 20, padding: "0.4rem 1rem", fontSize: "0.78rem", color: "var(--verde)" }}
                >
                  {chip.emoji} {chip.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="ia-chat-window reveal" style={{ transitionDelay: "0.2s" }}>
        <div className="ia-chat-header">
          <div className="ia-chat-avatar">🤖</div>
          <div>
            <div className="ia-chat-name">{chat.name || "Especialista IA"}</div>
            <div className="ia-chat-status">{chat.status || "Online agora"}</div>
          </div>
        </div>
        <div className="ia-messages" id="chatMessages" ref={listRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`msg ${msg.kind}`}>
              <div dangerouslySetInnerHTML={{ __html: msg.html }} />
            </div>
          ))}
          {typing && (
            <div className="msg bot">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}
        </div>
        <div className="ia-input-row">
          <input className="ia-input" ref={inputRef} type="text" placeholder={chat.placeholder || "Como você está se sentindo?"} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
          <button className="ia-send-btn" onClick={() => sendChat()} aria-label="Enviar">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}
