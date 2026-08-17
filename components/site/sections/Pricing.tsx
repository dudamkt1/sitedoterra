import { INCLUDED_CATALOG } from "@/lib/platform-includes";

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

export interface OfferView {
  name?: string;
  description?: string | null;
  activationRegularCents?: number;
  activationPriceCents?: number;
  monthlyPriceCents?: number;
  savingsCents?: number;
  promoText?: string;
  ctaText?: string;
  transparencyText?: string;
  cancelText?: string;
  allowCancel?: boolean;
  trialDays?: number;
  trialMonths?: number;
  billingInterval?: string;
  benefits?: string[];
  ctaUrl?: string;
}

export interface PricingContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  offer?: OfferView;
  plans?: PricingPlan[];
}

function brl(cents: number | undefined): string {
  return ((cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Destaca a última palavra do título em itálico (padrão visual da HOME). */
function titleParts(title: string): { main: string; emphasis?: string } {
  const words = title.trim().split(" ");
  if (words.length < 2) return { main: title };
  const emphasis = words.pop();
  return { main: words.join(" "), emphasis };
}

export function Pricing({ content }: { content: PricingContent }) {
  const offer = content.offer;

  // Fallback: estrutura antiga (listas manuais) quando não há oferta comercial.
  if (!offer) {
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
                <a href={plan.buttonUrl || "/cadastro"} className="btn-plano">{plan.buttonText || "Começar agora"}</a>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const regular = offer.activationRegularCents || 0;
  const promo = offer.activationPriceCents || 0;
  const monthly = offer.monthlyPriceCents || 0;
  const savings = offer.savingsCents ?? (regular > promo ? regular - promo : 0);
  const hasRegular = regular > 0 && regular > promo;
  const tp = titleParts(content.title || "Tenha um site assim hoje mesmo");
  const benefits = offer.benefits || [];
  const firstChargeText =
    offer.trialMonths && offer.trialMonths > 0
      ? `Após ${offer.trialMonths} ${offer.trialMonths === 1 ? "mês" : "meses"}`
      : offer.trialDays && offer.trialDays > 0
        ? `Após ${offer.trialDays === 30 ? "o primeiro mês" : `${offer.trialDays} dias`}`
        : "Mensal";

  return (
    <section id="planos">
      <div className="planos-inner">
        <div className="planos-eyebrow">
          <span className="eyebrow-line"></span>
          <span className="eyebrow-text">{content.eyebrow || "Oferta"}</span>
          <span className="eyebrow-line"></span>
        </div>
        <h2 className="planos-title">
          {tp.main}
          {tp.emphasis && <><br /><em>{tp.emphasis}</em></>}
        </h2>
        {content.subtitle && <p className="planos-sub">{content.subtitle}</p>}

        <div className="oferta-card">
          {offer.promoText && (
            <div className="oferta-badge">
              <span className="oferta-badge-dot"></span>
              {offer.promoText}
            </div>
          )}

          {offer.name && <div className="oferta-tipo">{offer.name}</div>}

          <div className="oferta-precos">
            <div className="oferta-preco-antigo">
              {hasRegular && <span>De {brl(regular)}</span>}
              {hasRegular && <span className="oferta-setinha">↓</span>}
              <span className="oferta-preco-principal">{brl(promo)}</span>
            </div>
            {savings > 0 && <div className="oferta-economia">Economize {brl(savings)}</div>}
          </div>

          <div className="oferta-ativa">Ativação do site · pagamento único</div>

          {benefits.length > 0 && (
            <ul className="oferta-beneficios">
              {benefits.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}

          <hr className="oferta-divider" />

          <div className="oferta-mensal">
            <div className="oferta-mensal-label">{firstChargeText}</div>
            <div className="oferta-mensal-preco">{brl(monthly)}<span>/mês</span></div>
            <div className="oferta-mensal-cancel">{offer.cancelText}</div>
          </div>

          {offer.ctaText && (
            <a href={offer.ctaUrl || "/cadastro"} className="oferta-cta">
              {offer.ctaText}
              <span className="oferta-cta-arrow">→</span>
            </a>
          )}

          {offer.transparencyText && (
            <p className="oferta-transparencia">{offer.transparencyText}</p>
          )}
        </div>

        <div className="oferta-incluidos">
          <h3 className="oferta-incluidos-title">✨ Tudo o que você recebe ao ativar</h3>
          <p className="oferta-incluidos-sub">
            Site completo, Central de IA e CRM — o pacote inteiro que este site usa, sem taxas escondidas.
          </p>
          <div className="oferta-incluidos-grid">
            {INCLUDED_CATALOG.map((g) => (
              <div key={g.title} className="oferta-grupo">
                <div className="oferta-grupo-head">
                  <span className="oferta-grupo-icon">{g.icon}</span>
                  <span className="oferta-grupo-titulo">{g.title}</span>
                </div>
                <ul className="oferta-grupo-lista">
                  {g.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="oferta-incluidos-nota">
            Tudo o que está nesta página e mais — pronto para você usar no seu painel.
          </p>
        </div>
      </div>
    </section>
  );
}
