interface Product {
  name?: string;
  category?: string;
  description?: string;
  price?: string;
  emoji?: string;
  badge?: string;
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
  const storeUrl = content.storeUrl || wppLink;
  const firstName = (content.eyebrow || "Favoritos").replace("Favoritos da ", "") || "Favoritos";

  return (
    <section id="produtos">
      <div className="produtos-header">
        <div className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || `Favoritos da ${firstName}`}</span></div>
          <h2 className="section-title">{content.title || "Produtos em destaque"}</h2>
        </div>
        <a href={storeUrl} target="_blank" className="insta-link reveal">Ver loja completa ↗</a>
      </div>
      <div className="produtos-grid">
        {items.map((p, i) => (
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
  );
}
