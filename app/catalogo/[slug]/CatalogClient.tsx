"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  unit: string;
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CatalogClient({
  slug,
  profileName,
  siteName,
  products,
  whatsappLink,
  initialMessage,
}: {
  slug: string;
  profileName: string;
  siteName: string | null;
  products: PublicProduct[];
  whatsappLink: string | null;
  initialMessage: string | null;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [message, setMessage] = useState(initialMessage || "");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(Array.from(set)).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (s && ![p.name, p.category || ""].join(" ").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [products, q, cat]);

  return (
    <div className="min-h-screen bg-[#fcf9f5]">
      <header className="bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Catálogo</p>
          <h1 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {profileName}
          </h1>
          {siteName && siteName !== profileName && (
            <p className="text-[14px] text-white/80 mt-1">{siteName}</p>
          )}
          <p className="text-[14px] text-white/80 mt-2 max-w-xl">
            Conheça nossos produtos e entre em contato para mais informações ou fazer seu pedido.
          </p>
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 rounded-full bg-white text-[#1d5c3a] hover:bg-white/90 text-[14px] font-semibold px-5 py-2.5 transition shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
            >
              💬 Falar pelo WhatsApp
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {products.length === 0 ? (
          <div className="rounded-[16px] border-2 border-dashed border-[#cfd8d2] bg-white p-10 text-center">
            <p className="text-[18px] font-bold text-[#0d3320]">Nenhum produto disponível no momento</p>
            <p className="text-[14px] text-[#4a5a52] mt-1">Volte em breve para conferir novidades.</p>
          </div>
        ) : (
          <>
            <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa5a0]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar produto..."
                    className="w-full rounded-[10px] border border-[#dde2dc] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                  />
                </div>
                <div className="sm:col-span-5">
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] text-[#6b7a72]">
                {filtered.length} produto{filtered.length === 1 ? "" : "s"} disponíve{filtered.length === 1 ? "l" : "is"}.
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-8 text-center text-[14px] text-[#6b7a72]">
                Nenhum produto encontrado com esses filtros.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-[16px] border border-[#e2e8e0] bg-white overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition flex flex-col"
                  >
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-[#eaf6ec] to-[#f5f7f4] overflow-hidden">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-5xl text-[#1d5c3a]/30 select-none">📦</div>
                      )}
                      {p.category && (
                        <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-white/95 border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 leading-none shadow-sm">
                          {p.category}
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-[15px] font-bold text-[#0d3320] leading-snug">{p.name}</h3>
                      {p.description && (
                        <p className="text-[13px] text-[#4a5a52] leading-5 mt-1.5 line-clamp-3">{p.description}</p>
                      )}
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="text-[18px] font-extrabold text-[#0d3320] tracking-tight">{formatBRL(p.price_cents)}</p>
                        <span className="text-[11px] text-[#6b7a72]">/ {p.unit || "un"}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Link
                          href={`/catalogo/${slug}/${p.id}`}
                          className="flex-1 inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50 text-[#2d3a4a] text-[13px] font-semibold px-3 py-2 transition"
                        >
                          Ver detalhes
                        </Link>
                        {whatsappLink && (
                          <a
                            href={`${whatsappLink.split("?")[0]}?text=${encodeURIComponent(`Olá! Tenho interesse no produto "${p.name}" (${formatBRL(p.price_cents)}).`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 rounded-[10px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[13px] font-semibold px-3 py-2 transition"
                          >
                            💬
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {whatsappLink && (
              <div className="mt-8 rounded-[16px] border border-[#e2e8e0] bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <p className="text-[15px] font-bold text-[#0d3320]">Não encontrou o que procurava?</p>
                <p className="text-[13.5px] text-[#4a5a52] mt-1">Envie uma mensagem e {profileName.split(" ")[0]} te ajuda a encontrar.</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Estou procurando por..."
                  className="mt-3 w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a] resize-y"
                />
                <a
                  href={`https://wa.me/${whatsappLink.split("wa.me/")[1]?.split("?")[0] || ""}?text=${encodeURIComponent(message || "Olá! Gostaria de saber mais sobre os produtos do catálogo.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[14px] font-semibold px-4 py-2.5 transition"
                >
                  💬 Enviar pelo WhatsApp
                </a>
              </div>
            )}
          </>
        )}

        <footer className="mt-10 text-center text-[12px] text-[#8a9a8e]">
          Catálogo compartilhado por <b className="text-[#0d3320]">{profileName}</b>.{" "}
          <Link href={`/${slug}`} className="text-[#1d5c3a] hover:underline">Conhecer o site</Link>
        </footer>
      </main>
    </div>
  );
}
