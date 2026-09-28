import type { Metadata } from "next";
import { listPortfolioModels, toModelCard } from "@/lib/portfolio";
import { PortfolioSection } from "@/components/site/sections/PortfolioSection";
import "@/app/(site)/site.css";

// ISR 60s — casa com o cache de modelos em memória (mesma cadência da HOME).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Modelos de site para consultores | TopConsultores",
  description:
    "Portfólio de modelos de site para consultores de venda direta: doTERRA, AMAKHA, Tupperware, iGREEN e outras empresas. Escolha o modelo e ative o seu site com estrutura pronta.",
};

/**
 * PORTFÓLIO DE MODELOS — vitrine pública de tudo que a plataforma oferece.
 *
 * É o elo entre "plataforma para consultores de venda direta" e "site com
 * estrutura pronta": o visitante vê os modelos, abre a demonstração e escolhe
 * um na ativação. Cada escolha vira uma CÓPIA INDEPENDENTE no site dele —
 * editar um modelo aqui nunca altera sites já criados.
 */
export default async function PortfolioPage() {
  const models = (await listPortfolioModels()).map(toModelCard);

  return (
    <main className="pf-page">
      <div className="pf-page-top">
        <a className="pf-page-brand" href="/">
          TopConsultores
        </a>
        <a className="pf-back" href="/">
          ← Voltar para o site
        </a>
      </div>

      {models.length > 0 ? (
        <PortfolioSection
          content={{
            eyebrow: "Portfólio de modelos",
            title: "Escolha o modelo do seu site",
            subtitle:
              "Cada modelo já nasce com seções, textos, cores e layout prontos. Você escolhe na ativação, personaliza tudo no seu painel e o site fica só seu — nenhuma alteração futura num modelo atinge sites já criados.",
            buttonText: "Criar meu site agora",
            buttonUrl: "/cadastro",
            primaryButtonText: "Quero este modelo",
            secondaryButtonText: "Ver modelo",
          }}
          models={models}
        />
      ) : (
        <div className="pf-empty">
          Os modelos de site estão sendo preparados. Enquanto isso, ative o
          Modelo Padrão — Óleos e personalize tudo pelo painel.
          <div style={{ marginTop: "1.4rem" }}>
            <a className="pf-btn" href="/cadastro">
              Criar meu site
            </a>
          </div>
        </div>
      )}

      <div className="pf-page-foot">
        <p>
          Depois de ativo, seu site é independente: você edita textos, imagens,
          cores e seções no painel sem afetar os modelos nem os sites de outros
          consultores.
        </p>
        <a className="pf-back" href="/">
          ← Voltar para o site
        </a>
      </div>
    </main>
  );
}
