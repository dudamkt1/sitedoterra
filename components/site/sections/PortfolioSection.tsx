import type { PortfolioModelCard } from "@/lib/portfolio";

export interface PortfolioContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  maxModels?: number | string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
}

/**
 * Vitrine de MODELOS DE SITE na HOME da plataforma.
 *
 * Só renderiza quando o chamador informa `models` — ou seja, no domínio
 * principal. Em `/[slug]` (site do consultor) a seção existe mas não
 * recebe a lista, então não aparece nem entra no menu: o site do usuário
 * nunca divulga modelos de outros sites.
 *
 * É a ponte entre "site pronto para consultor" e "portfólio de modelos":
 * o visitante vê os modelos, abre a demonstração e escolhe um para a
 * própria ativação (`/checkout?model=<key>`).
 */
export function PortfolioSection({
  content,
  models,
}: {
  content: PortfolioContent;
  models?: PortfolioModelCard[] | null;
}) {
  const raw = models || [];
  if (raw.length === 0) return null;

  const limit = Number(content.maxModels);
  const items = Number.isFinite(limit) && limit > 0 ? raw.slice(0, limit) : raw;

  const heading = content.title || "Escolha seu modelo de site";
  const primaryCta = content.primaryButtonText || "Quero este modelo";
  const secondaryCta = content.secondaryButtonText || "Ver modelo";

  return (
    <section id="modelos">
      <div className="reveal pf-head">
        <div className="section-eyebrow">
          <span className="eyebrow-line"></span>
          <span className="eyebrow-text">{content.eyebrow || "Modelos de site"}</span>
        </div>
        <h2 className="section-title">{heading}</h2>
        {content.subtitle && <p className="section-sub">{content.subtitle}</p>}
      </div>

      <div className="pf-grid">
        {items.map((m, i) => {
          const thumb = m.cover_url || m.thumbnail_url;
          const href = `/portfolio/${encodeURIComponent(m.key)}`;
          return (
            <article key={m.key} className="pf-card reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
              <a className="pf-media" href={href} aria-label={`Ver modelo ${m.name}`}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pf-thumb" src={thumb} alt={m.name} loading="lazy" />
                ) : (
                  <span className="pf-placeholder">🧩</span>
                )}
                {m.is_default && <span className="pf-badge">Padrão da plataforma</span>}
              </a>
              <div className="pf-body">
                <div className="pf-meta">
                  {m.company && <span className="pf-company">{m.company}</span>}
                  {m.category && <span className="pf-category">{m.category}</span>}
                </div>
                <h3 className="pf-name">{m.name}</h3>
                {m.description && <p className="pf-desc">{m.description}</p>}
                <div className="pf-actions">
                  <a className="pf-btn" href={`/checkout?model=${encodeURIComponent(m.key)}`}>
                    {primaryCta}
                  </a>
                  <a className="pf-link" href={href}>
                    {secondaryCta} →
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {content.buttonText && (
        <div className="pf-foot reveal">
          <a className="btn-primary pf-cta" href={content.buttonUrl || "/portfolio"}>
            {content.buttonText} →
          </a>
        </div>
      )}
    </section>
  );
}
