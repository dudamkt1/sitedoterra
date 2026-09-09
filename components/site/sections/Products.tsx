import { normalizeUrl } from "@/lib/section-fields";

interface Product {
  name?: string;
  category?: string;
  description?: string;
  price?: string;
  image?: string | null;
  /** Legado: emoji exibido quando não há imagem. */
  emoji?: string;
  badge?: string;
  bgColor?: string | null;
  /** Legado: gradiente CSS usado quando não há cor de fundo. */
  gradient?: string;
}

export interface ProductsContent {
  eyebrow?: string;
  title?: string;
  storeUrl?: string | null;
  items?: Product[];
  _contactWhatsapp?: string;
}

export function Products({ content, contactWhatsapp }: { content: ProductsContent; contactWhatsapp?: string }) {
  const items = content.items || [];
  if (items.length === 0) return null;
  const whatsapp = contactWhatsapp || content._contactWhatsapp || "5511999999999";
  const wppLink = `https://wa.me/${whatsapp}`;
  // Normaliza o link da loja (completa https:// quando ausente): sem isso,
  // um endereço como "sualoja.com.br" virava caminho relativo do próprio
  // site e "não direcionava para o site desejado".
  const storeUrl = normalizeUrl(content.storeUrl) || wppLink;
  const firstName = (content.eyebrow || "Favoritos").replace("Favoritos da ", "") || "Favoritos";

  return (
    <section id="produtos">
      <div className="produtos-header">
        <div className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || `Favoritos da ${firstName}`}</span></div>
          <h2 className="section-title">{content.title || "Produtos em destaque"}</h2>
        </div>
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="insta-link reveal">Ver loja completa ↗</a>
      </div>
      <div className="produtos-grid">
        {items.map((p, i) => (
          <div key={i} className="produto-card reveal" style={{ transitionDelay: `${i * 0.15}s` }}>
            <div className="produto-img" style={{ background: p.bgColor || p.gradient }}>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="produto-foto" src={p.image} alt={p.name || "Produto"} loading="lazy" />
              ) : (
                <span>{p.emoji}</span>
              )}
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
  );
}
