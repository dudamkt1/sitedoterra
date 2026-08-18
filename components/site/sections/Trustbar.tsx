export interface TrustbarContent {
  badge?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export function Trustbar({ content }: { content: TrustbarContent }) {
  if (!content.title && !content.buttonText) return null;
  return (
    <div className="vitrine-cta-banner">
      <div className="vitrine-cta-text">
        <span className="star">{content.badge || "✨"}</span>
        <div>
          <p>{content.title}</p>
          {content.subtitle && <span>{content.subtitle}</span>}
        </div>
      </div>
      {content.buttonText && (
        <a href={content.buttonUrl || "#planos"} className="btn-vitrine">
          {content.buttonText} →
        </a>
      )}
    </div>
  );
}
