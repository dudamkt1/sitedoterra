"use client";

import { useState } from "react";
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
  /**
   * Condições de pagamento configuradas pelo Super Admin em /admin/pagamentos
   * (PIX com desconto e parcelamento sem juros no Mercado Pago). São
   * resolvidas no servidor a partir de `payment_config` e mescladas no
   * conteúdo da seção pricing por `lib/home.ts`. Permitem sincronizar a
   * comunicação visual da HOME com o que o checkout realmente cobra.
   */
  paymentConditions?: {
    gateway?: "stripe" | "mercadopago";
    pixDiscountPercent?: number;
    installments?: number;
    installmentsWithoutInterest?: boolean;
    pixCents?: number;
  };
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

const INTENT_KEY = "checkout_intent_v1";

export function Pricing({ content }: { content: PricingContent }) {
  const [demoLoading, setDemoLoading] = useState(false);
  const offer = content.offer;

  function handleOpen() {
    try {
      if (offer) localStorage.setItem(INTENT_KEY, JSON.stringify({ offer, ts: Date.now() }));
    } catch {}
    // Nova página de checkout transparente — não usa mais modal
    window.location.href = "/checkout";
  }

  async function handleDemo() {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo/start", { method: "POST" });
      if (res.ok) {
        window.location.href = "/painel";
        return;
      }
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    } finally {
      setTimeout(() => setDemoLoading(false), 2000);
    }
  }

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
                <button type="button" onClick={handleOpen} className="btn-plano">{plan.buttonText || "Começar agora"}</button>
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

          {(() => {
            const cond = content.paymentConditions;
            if (!cond) return null;
            const pixPercent = Math.max(0, Math.min(50, Number(cond.pixDiscountPercent) || 0));
            const installments = Math.max(0, Math.min(12, Math.round(Number(cond.installments) || 0)));
            const noInterest = cond.installmentsWithoutInterest !== false;
            const showPix = pixPercent > 0 && promo > 0;
            const showInstallments = installments > 0;
            if (!showPix && !showInstallments) return null;
            const pixCents = showPix ? Number(cond.pixCents) || Math.round(promo * (100 - pixPercent) / 100) : promo;
            return (
              <div className="oferta-condicoes" aria-label="Condições de pagamento">
                <span className="oferta-condicoes-ou">ou</span>
                <div className="oferta-condicoes-grid">
                  {showInstallments && (
                    <div className="oferta-condicoes-item oferta-condicoes-item--cartao">
                      <span className="oferta-condicoes-icone" aria-hidden>💳</span>
                      <span className="oferta-condicoes-texto">
                        Até <strong>{installments}x {noInterest ? "sem juros" : "com juros"}</strong> no cartão
                      </span>
                    </div>
                  )}
                  {showPix && (
                    <div className="oferta-condicoes-item oferta-condicoes-item--pix">
                      <span className="oferta-condicoes-icone" aria-hidden>⚡</span>
                      <span className="oferta-condicoes-texto">
                        <strong>{pixPercent}% OFF</strong> no PIX
                      </span>
                      <span className="oferta-condicoes-pix-valor">{brl(pixCents)} no PIX</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
            <button type="button" onClick={handleOpen} className="oferta-cta">
              {offer.ctaText}
              <span className="oferta-cta-arrow">→</span>
            </button>
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

          <div className="oferta-demo-callout" role="region" aria-label="Demonstração do painel">
            <div className="oferta-demo-callout-text">
              <strong>Quer testar antes de decidir?</strong>
              <span>
                Acesse nosso painel de demonstração e explore todas as ferramentas — Central de IA, CRM,
                agendamento — sem compromisso.
              </span>
            </div>
            <button
              type="button"
              onClick={handleDemo}
              disabled={demoLoading}
              className="oferta-demo-callout-btn"
            >
              {demoLoading ? "Preparando..." : "Explorar o painel agora →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
