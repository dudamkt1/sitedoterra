interface Testimonial {
  text?: string;
  name?: string;
  location?: string;
  initials?: string;
}

export interface TestimonialsContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  items?: Testimonial[];
}

export function Testimonials({ content }: { content: TestimonialsContent }) {
  const items = content.items || [];
  if (items.length === 0) return null;
  return (
    <section id="depoimentos">
      <div className="depoimentos-header">
        <div className="reveal">
          <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "O que dizem por aí"}</span></div>
          <h2 className="section-title">{content.title || "Histórias que me inspiram todo dia"}</h2>
        </div>
        {content.subtitle && (
          <p className="section-sub reveal" style={{ transitionDelay: "0.15s" }}>{content.subtitle}</p>
        )}
      </div>
      <div className="depoimentos-grid">
        {items.map((t, i) => (
          <div key={i} className={"dep-card reveal" + (i === 1 ? " featured" : "")} style={{ transitionDelay: `${i * 0.15}s` }}>
            <div className="dep-quote">&quot;</div>
            <p className="dep-text">{t.text}</p>
            <div className="dep-stars">★★★★★</div>
            <div className="dep-author">
              <div className="dep-avatar">{t.initials || (t.name || "??").slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="dep-author-name">{t.name}</div>
                <div className="dep-author-loc">{t.location}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
