interface PricingPlan {
  name?: string;
  price?: string;
  period?: string;
  popular?: boolean;
  badge?: string;
  economy?: string;
  features?: string[];
  buttonText?: string;
  buttonUrl?: string;
}

export interface PricingContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  plans?: PricingPlan[];
}

export function Pricing({ content }: { content: PricingContent }) {
  const plans = content.plans || [];
  if (plans.length === 0) return null;
  return (
    <section id="planos">
      <div className="planos-inner">
        <div className="planos-eyebrow">
          <span className="eyebrow-line"></span>
          <span className="eyebrow-text">{content.eyebrow || "Chamada final"}</span>
          <span className="eyebrow-line"></span>
        </div>
        <h2 className="planos-title">{content.title || "Planos"}</h2>
        {content.subtitle && <p className="planos-sub">{content.subtitle}</p>}
        <div className="planos-cards">
          {plans.map((plan, i) => (
            <div key={i} className={"plano-card" + (plan.popular ? " destaque" : "")}>
              {plan.badge && <div className="plano-badge">{plan.badge}</div>}
              <div className="plano-tipo">{plan.name}</div>
              <div className="plano-preco"><sup>R$</sup>{plan.price}</div>
              {plan.period && <div className="plano-period">{plan.period}</div>}
              {plan.economy && <div className="plano-economia">{plan.economy}</div>}
              <hr className="plano-divider" />
              <ul className="plano-features">
                {(plan.features || []).map((f, j) => <li key={j}>{f}</li>)}
              </ul>
              <a href={plan.buttonUrl || "#pricing"} className="btn-plano">{plan.buttonText || "Começar agora"}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
