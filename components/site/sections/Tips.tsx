interface TipItem {
  emoji?: string;
  gradient?: string;
}

export interface TipsContent {
  eyebrow?: string;
  title?: string;
  instagramHandle?: string;
  instagramUrl?: string;
  items?: TipItem[];
}

export function Tips({ content }: { content: TipsContent }) {
  const items = content.items || [];
  if (items.length === 0) return null;
  const instaUrl = content.instagramUrl || "https://instagram.com";
  return (
    <section id="dicas">
      <div className="insta-header">
        <div className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "Acompanhe no Instagram"}</span></div>
          <h2 className="section-title">{content.title || "Dicas, rotinas e momentos reais"}</h2>
        </div>
        <a href={instaUrl} target="_blank" className="insta-link reveal">{content.instagramHandle || "@seu.instagram"} ↗</a>
      </div>
      <div className="insta-grid">
        {items.map((item, i) => (
          <div key={i} className="insta-item reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
            <div className="insta-item-inner" style={{ background: item.gradient }}>{item.emoji}</div>
            <div className="insta-overlay">
              <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" /></svg>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
