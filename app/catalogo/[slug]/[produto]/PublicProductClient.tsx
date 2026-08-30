"use client";

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

export default function PublicProductClient({
  slug,
  profileName,
  product,
  whatsappLink,
}: {
  slug: string;
  profileName: string;
  product: PublicProduct;
  whatsappLink: string | null;
}) {
  return (
    <div className="min-h-screen bg-[#fcf9f5]">
      <header className="bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-3">
          <Link href={`/catalogo/${slug}`} className="inline-flex items-center gap-1.5 text-[13.5px] text-white/90 hover:text-white">
            ← Voltar ao catálogo
          </Link>
          <Link href={`/${slug}`} className="text-[13px] text-white/70 hover:text-white">
            Ver site
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <article className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-[18px] border border-[#e2e8e0] shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="relative aspect-[4/3] bg-gradient-to-br from-[#eaf6ec] to-[#f5f7f4]">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-7xl text-[#1d5c3a]/25 select-none">📦</div>
            )}
          </div>
          <div className="p-6 flex flex-col">
            {product.category && (
              <span className="self-start inline-flex items-center rounded-full bg-[#eaf6ec] border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-800 leading-none">
                {product.category}
              </span>
            )}
            <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-[#0d3320] mt-2 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {product.name}
            </h1>
            {product.description && (
              <p className="text-[15px] leading-6 text-[#4a5a52] mt-3 whitespace-pre-line">{product.description}</p>
            )}
            <div className="mt-auto pt-5 flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#6b7a72]">Preço</p>
                <p className="text-[28px] font-extrabold text-[#0d3320] tracking-tight">{formatBRL(product.price_cents)}</p>
                <p className="text-[11.5px] text-[#6b7a72] mt-0.5">por {product.unit || "un"}</p>
              </div>
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[12px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[15px] font-semibold px-5 py-3 shadow-[0_6px_18px_rgba(37,211,102,0.32)] transition"
                >
                  💬 Quero comprar
                </a>
              ) : (
                <span className="text-[12px] text-[#6b7a72] italic">Entre em contato com {profileName.split(" ")[0]} para comprar.</span>
              )}
            </div>
          </div>
        </article>

        <div className="mt-6 text-center text-[12px] text-[#8a9a8e]">
          Catálogo de <b className="text-[#0d3320]">{profileName}</b> ·{" "}
          <Link href={`/catalogo/${slug}`} className="text-[#1d5c3a] hover:underline">Ver mais produtos</Link>
        </div>
      </main>
    </div>
  );
}
