import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildResolvedSectionsFromModel,
  getPortfolioModelByKey,
  type PortfolioModel,
} from "@/lib/portfolio";
import { buildPricingContent, getActiveOffer } from "@/lib/commercial";
import { resolveGateways } from "@/lib/gateway-config";
import { SiteHome } from "@/components/site/SiteHome";
import type { ResolvedHomeSection } from "@/types";
import type { SiteThemeConfig } from "@/lib/site-theme";
import "@/app/(site)/site.css";

// ISR 60s — modelo público, cacheado em memória no leitor.
export const revalidate = 60;

interface PageProps {
  params: { key: string };
}

async function resolveModel(param: string): Promise<PortfolioModel | null> {
  try {
    const key = decodeURIComponent(param || "").trim().toLowerCase();
    if (!key) return null;
    const model = await getPortfolioModelByKey(key);
    if (!model || model.status !== "active") return null;
    return model;
  } catch {
    return null;
  }
}

/**
 * Oferta viva + condições de pagamento da seção "Planos" — mesma aritmética
 * usada em `resolveHomeSections`, para o preço do modelo bater com o da HOME.
 */
async function pricingOverlay(): Promise<Record<string, unknown>> {
  const overlay: Record<string, unknown> = {};
  try {
    const offer = await getActiveOffer();
    if (offer) Object.assign(overlay, buildPricingContent(offer as never));
  } catch {
    // sem oferta → o conteúdo do modelo mantém o valor embutido.
  }
  try {
    const gateways = await resolveGateways();
    const pixDiscount = Math.min(50, Math.max(0, Number(gateways.mercadopago.pixDiscountPercent) || 0));
    const installments = Math.min(12, Math.max(0, Math.round(Number(gateways.mercadopago.installments) || 0)));
    const withoutInterest = gateways.mercadopago.installmentsWithoutInterest !== false;
    const offerView = overlay.offer as { activationPriceCents?: number } | undefined;
    const activationCents = offerView?.activationPriceCents || 0;
    const pixCents =
      pixDiscount > 0 && activationCents
        ? Math.round((activationCents * (100 - pixDiscount)) / 100)
        : activationCents;
    if (activationCents) {
      overlay.paymentConditions = {
        gateway: gateways.gateway,
        pixDiscountPercent: pixDiscount,
        installments,
        installmentsWithoutInterest: withoutInterest,
        pixCents,
      };
    }
  } catch {
    // condições são opcionais
  }
  return overlay;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const model = await resolveModel(params.key);
  if (!model) return { title: "Modelo não encontrado | TopConsultores" };
  return {
    title: `${model.name} — modelo de site | TopConsultores`,
    description:
      model.description ||
      `Veja como fica um site com o modelo ${model.name} e escolha na sua ativação.`,
    robots: { index: false },
  };
}

/**
 * DEMONSTRAÇÃO DE UM MODELO DO PORTFÓLIO (`/portfolio/[key]`).
 *
 * Monta as seções DIRETO do `portfolio_models.sections` (nada de tenant),
 * reaproveitando o mesmo SiteHome dos sites reais — o visitante vê o site
 * como ele nasceria. Aqui nada é gravado: é só visualização. A cópia
 * independente acontece exclusivamente na ativação do site do usuário.
 */
export default async function ModelDemoPage({ params }: PageProps) {
  const model = await resolveModel(params.key);
  if (!model) notFound();

  const hasPricing = model.sections.some((s) => s.type === "pricing");
  const pricingContent = hasPricing ? await pricingOverlay() : undefined;

  const sections: ResolvedHomeSection[] = buildResolvedSectionsFromModel(model, {
    pricingContent,
    siteData: model.site_data || null,
  });

  const theme = ((model.site_data || {}) as { theme?: SiteThemeConfig }).theme || null;
  const cta = `/checkout?model=${encodeURIComponent(model.key)}`;

  return (
    <>
      <div className="pf-demo-bar">
        <span>
          Demonstração do modelo <strong>{model.name}</strong>
          {model.company ? ` · ${model.company}` : ""} — é assim que seu site começa.
        </span>
        <span className="pf-demo-actions">
          <a className="pf-demo-back" href="/portfolio">
            ← Todos os modelos
          </a>
          <a className="pf-btn" href={cta}>
            Quero este modelo
          </a>
        </span>
      </div>

      <SiteHome
        slug={`modelo-${model.key}`}
        sections={sections}
        theme={theme}
        tenantSite
        portfolioModels={null}
        extraNav={[
          { label: "Modelos", href: "/portfolio" },
          { label: "Quero este modelo", href: cta },
        ]}
      />
    </>
  );
}
