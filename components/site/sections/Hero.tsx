interface Stat {
  value?: string;
  label?: string;
}

export interface HeroContent {
  eyebrow?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  description?: string;
  image?: string | null;
  imageAlt?: string;
  badgeTitle?: string;
  badgeSubtitle?: string;
  primaryBtn?: { text?: string; url?: string };
  secondaryBtn?: { text?: string; url?: string };
  stats?: Stat[];
  _contactWhatsapp?: string;
}

interface HeroProps {
  content: HeroContent;
  slug?: string;
  affiliateUserId?: string;
}

function addRefParam(url: string, affiliateUserId?: string): string {
  if (!affiliateUserId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ref=${affiliateUserId}`;
}

export function Hero({ content, slug, affiliateUserId }: HeroProps) {
  const firstName = content.firstName || "Ana";
  const lastName = content.lastName || "Beatriz";
  const badgeTitle = content.badgeTitle || "Certified Wellness";
  const badgeSubtitle = content.badgeSubtitle || "Expert em bem-estar";
  const stats = content.stats?.length ? content.stats : [];
  const primary = content.primaryBtn || {};
  const secondary = content.secondaryBtn || {};

  const primaryUrl = primary.url || (slug ? `/${slug}/checkout` : "/checkout");
  const secondaryUrl = secondary.url || "#products";

  return (
    <section id="hero">
      <div className="hero-bg-elements">
        <div className="hero-circle-1"></div>
        <div className="hero-circle-2"></div>
        <div className="hero-line"></div>
        <div className="hero-dots">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div className="hero-content">
        {content.eyebrow && (
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line"></span>
            <span>{content.eyebrow}</span>
          </div>
        )}
        <h1 className="hero-name">
          {firstName} <em>{lastName}</em>
        </h1>
        {content.role && <p className="hero-cargo">{content.role}</p>}
        {content.description && <p className="hero-desc">{content.description}</p>}
        {(primary.text || secondary.text) && (
          <div className="hero-btns">
            {primary.text && (
              <a href={addRefParam(primaryUrl, affiliateUserId)} className="btn-primary">
                {primary.text}
              </a>
            )}
            {secondary.text && (
              <a href={addRefParam(secondaryUrl, affiliateUserId)} className="btn-secondary">
                {secondary.text} →
              </a>
            )}
          </div>
        )}
        {stats.length > 0 && (
          <div className="hero-stats">
            {stats.map((s, i) => (
              <div key={i}>
                <span className="hero-stat-num">{s.value}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="hero-image-wrap">
        <div className="hero-img-deco"></div>
        <div className="hero-img-frame">
          {content.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="hero-img-real" src={content.image} alt={content.imageAlt || "Foto"} />
          ) : (
            <div className="hero-img-placeholder">
              <svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="28" r="14" stroke="white" strokeWidth="1.5" /><path d="M10 70c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <p>{content.imageAlt || "Foto do profissional"}</p>
            </div>
          )}
        </div>
        <div className="hero-badge">
          <div className="hero-badge-icon">🌿</div>
          <div className="hero-badge-text">
            <strong>{badgeTitle}</strong>
            <span>{badgeSubtitle}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
