export interface AffiliatesContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
}

/**
 * Faixa/chamada compacta do Programa de Afiliados na HOME.
 * Fica entre Planos e "Escolha a cor do site" — é só um gancho, o peso
 * vai para a página /afiliados.
 */
export function Affiliates({ content }: { content: AffiliatesContent }) {
  if (!content.title && !content.buttonText) return null;
  return (
    <section id="afiliados">
      <div className="afiliados-cta-banner reveal">
        <div className="afiliados-cta-text">
          <div className="section-eyebrow" style={{ marginBottom: "0.6rem" }}>
            <span className="eyebrow-line"></span>
            <span className="eyebrow-text">{content.eyebrow || "Ganhe indicando"}</span>
          </div>
          <p>{content.title}</p>
          {content.subtitle && <span>{content.subtitle}</span>}
        </div>
        {content.buttonText && (
          <a href={content.buttonUrl || "/afiliados"} className="btn-vitrine">
            {content.buttonText} →
          </a>
        )}
      </div>
    </section>
  );
}
