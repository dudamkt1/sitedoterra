"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const TYPES = [
  { value: "suggestion", label: "Sugestão" },
  { value: "question", label: "Dúvida" },
  { value: "criticism", label: "Crítica" },
  { value: "problem", label: "Problema / Erro" },
  { value: "praise", label: "Elogio" },
  { value: "other", label: "Outro" },
] as const;

type TypeValue = (typeof TYPES)[number]["value"];

const MAX_MESSAGE = 4000;

export default function FeedbackBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TypeValue>("suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSent(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sending]);

  function closeModal() {
    if (sending) return;
    setOpen(false);
    setMessage("");
    setType("suggestion");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 1) {
      setError("Escreva sua mensagem antes de enviar.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE) {
      setError(`Mensagem muito longa (máx. ${MAX_MESSAGE} caracteres).`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: trimmed,
          source_page: pathname || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Não foi possível enviar agora. Tente novamente.");
        return;
      }
      setSent(true);
      setMessage("");
      setType("suggestion");
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="relative overflow-hidden rounded-[16px] border border-[#1d5c3a]/15 bg-gradient-to-br from-[#f0f8f3] via-white to-[#faf6ee] shadow-[0_6px_22px_rgba(29,92,58,0.06)]">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#1d5c3a]/5 hidden sm:block" aria-hidden />
          <div className="absolute -right-20 -bottom-16 w-48 h-48 rounded-full bg-[#c4963a]/5 hidden sm:block" aria-hidden />
          <div className="relative flex flex-col gap-4 p-4 sm:p-5 sm:flex-row sm:items-center sm:gap-5 sm:pl-6">
            <span className="hidden sm:flex w-11 h-11 rounded-[12px] bg-white border border-[#1d5c3a]/15 items-center justify-center shrink-0 text-[#1d5c3a] text-lg shadow-[0_2px_8px_rgba(29,92,58,0.08)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                <path d="M8 10h8" />
                <path d="M8 13h5" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-base font-bold text-[#0d3320] leading-6">Sua opinião importa!</p>
              <p className="text-[13px] leading-5 text-[#4a5a52] mt-0.5 sm:mt-1">
                Estamos construindo o Site junto com a comunidade doTERRA. Dicas, sugestões, críticas e relatos de problemas nos ajudam a melhorar a plataforma para todos.
              </p>
            </div>
            <button
              ref={firstFieldRef}
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#1d5c3a] hover:bg-[#164a2e] active:bg-[#103d28] text-white text-[14px] font-semibold px-5 py-3 shadow-[0_6px_18px_rgba(29,92,58,0.22)] hover:shadow-[0_8px_22px_rgba(29,92,58,0.28)] transition-all whitespace-nowrap w-full sm:w-auto"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4z" />
              </svg>
              Enviar Mensagem
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sending) closeModal();
          }}
        >
          <div className="w-full sm:max-w-[520px] sm:w-full bg-white sm:rounded-[20px] rounded-t-[20px] shadow-[0_24px_60px_rgba(0,0,0,0.25)] max-h-[92vh] overflow-y-auto">
            {!sent ? (
              <form onSubmit={handleSubmit} className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 id="feedback-modal-title" className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#0d3320] leading-7">Sua opinião importa!</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={sending}
                    aria-label="Fechar"
                    className="w-9 h-9 rounded-full text-[#6b7a72] hover:bg-[#f2f4f1] flex items-center justify-center transition shrink-0 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[13.5px] leading-5 text-[#6b7a72]">Conte para nós o que você gostaria de melhorar, uma sugestão, crítica ou problema que encontrou.</p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-2">Tipo de mensagem</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TYPES.map((t) => {
                        const active = type === t.value;
                        return (
                          <button
                            type="button"
                            key={t.value}
                            onClick={() => setType(t.value)}
                            className={`text-[13px] font-medium rounded-[10px] px-3 py-2.5 border transition text-left ${
                              active
                                ? "border-[#1d5c3a] bg-[#eaf6ec] text-[#103d28] shadow-[0_2px_6px_rgba(29,92,58,0.08)]"
                                : "border-[#e2e8e0] bg-white text-[#2d3a4a] hover:border-[#cdd5cd] hover:bg-[#fafaf8]"
                            }`}
                          >
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${active ? "bg-[#1d5c3a]" : "bg-[#cfd5cf]"}`} />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="feedback-msg" className="block text-[12px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-2">Mensagem</label>
                    <textarea
                      id="feedback-msg"
                      required
                      rows={6}
                      maxLength={MAX_MESSAGE}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="w-full rounded-[12px] border border-[#dde2dc] bg-white px-4 py-3.5 text-[14.5px] text-[#0d3320] placeholder:text-[#9aa5a0] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a] transition resize-y min-h-[140px]"
                    />
                    <p className="mt-1.5 text-[11.5px] text-[#8a9a8e] flex justify-between">
                      <span>Use este espaço para sugestões, dúvidas ou problemas.</span>
                      <span>{message.length}/{MAX_MESSAGE}</span>
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-[12px] bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-[13.5px] text-[#991b1b] leading-5">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={sending}
                    className="w-full sm:w-auto rounded-[12px] border border-[#dde2dc] bg-white px-5 py-3 text-[14px] font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sending || message.trim().length === 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#1d5c3a] hover:bg-[#164a2e] active:bg-[#103d28] text-white text-[14px] font-semibold px-5 py-3 shadow-[0_6px_18px_rgba(29,92,58,0.22)] hover:shadow-[0_8px_22px_rgba(29,92,58,0.28)] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M22 2L11 13" />
                          <path d="M22 2l-7 20-4-9-9-4z" />
                        </svg>
                        Enviar mensagem
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-7 sm:p-9 text-center">
                <div className="w-16 h-16 rounded-full bg-[#eaf6ec] border border-[#cfe8d2] flex items-center justify-center mx-auto text-3xl">❤️</div>
                <h2 id="feedback-modal-title" className="mt-5 text-[22px] font-bold tracking-tight text-[#0d3320]">Mensagem enviada!</h2>
                <p className="mt-2 text-[14px] leading-5 text-[#4a5a52]">Obrigado por ajudar a melhorar a plataforma.</p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-6 w-full sm:w-auto rounded-[12px] bg-[#1d5c3a] hover:bg-[#164a2e] text-white text-[14px] font-semibold px-6 py-3 shadow-[0_6px_18px_rgba(29,92,58,0.22)] transition"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
