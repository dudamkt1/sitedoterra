export interface StoryContent {
  eyebrow?: string;
  title?: string;
  paragraphs?: string[];
  signature?: string;
  image?: string | null;
  imageAlt?: string;
  badgeValue?: string;
  badgeLabel?: string;
}

export function Story({ content }: { content: StoryContent }) {
  const paragraphs = content.paragraphs || [];
  if (paragraphs.length === 0) return null;
  return (
    <section id="historia">
      <div className="historia-img-wrap reveal">
        <div className="historia-img-main">
          {content.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="historia-img-real" src={content.image} alt={content.imageAlt || "Foto"} />
          ) : (
            <div className="historia-img-placeholder">
              <svg width="60" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="28" r="14" stroke="white" strokeWidth="1.5" /><path d="M10 70c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <p>{content.imageAlt || "Foto do profissional"}</p>
            </div>
          )}
        </div>
        <div className="historia-img-deco"></div>
        {(content.badgeValue || content.badgeLabel) && (
          <div className="historia-badge">
            <span className="historia-badge-num">{content.badgeValue}</span>
            <span className="historia-badge-label">{content.badgeLabel || "transformando vidas"}</span>
          </div>
        )}
      </div>
      <div className="historia-text reveal" style={{ transitionDelay: "0.2s" }}>
        <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "Minha jornada"}</span></div>
        <h2 className="section-title">{content.title || "Uma história de cura e propósito"}</h2>
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        {content.signature && <p className="historia-assinatura">{content.signature}</p>}
      </div>
    </section>
  );
}
