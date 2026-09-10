"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

/** Accordion simples em Tailwind (o conteúdo da /afiliados fica fora do #tenant-site). */
export function AffiliatesFaq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  if (items.length === 0) return null;
  return (
    <div className="rounded-[24px] bg-white border border-[#e7ece8] shadow-[0_16px_48px_rgba(16,61,45,0.08)] overflow-hidden divide-y divide-[#eef2ee]">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 text-left px-6 sm:px-8 py-5 hover:bg-[#f8faf8] transition"
            >
              <span className={`text-[14.5px] sm:text-[15px] font-semibold leading-relaxed ${isOpen ? "text-[#1d5c3a]" : "text-[#0f1a2a]"}`}>
                {f.q}
              </span>
              <span
                aria-hidden
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[16px] font-bold transition-all ${
                  isOpen ? "bg-[#1d5c3a] text-white rotate-45" : "bg-[#1d5c3a]/10 text-[#1d5c3a]"
                }`}
              >
                +
              </span>
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <p className="px-6 sm:px-8 pb-6 text-[13.5px] sm:text-[14px] leading-relaxed text-[#5a6b7a]">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
