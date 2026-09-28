import { listPortfolioModels } from "@/lib/portfolio";
import { PortfolioModelsAdmin } from "@/components/admin/PortfolioModelsAdmin";

export const dynamic = "force-dynamic";

/**
 * PORTFÓLIO DE MODELOS (Super Admin).
 *
 * Aqui o Super Admin cria/edita/duplica os modelos que o novo consultor
 * escolhe na ativação. O modelo é apenas o PONTO DE PARTIDA do site:
 * depois da primeira cópia, ele e o site do usuário nunca mais se relacionam
 * — alterar um modelo aqui NÃO altera sites já criados (e o inverso também).
 */
export default async function AdminPortfolioModelsPage() {
  const models = await listPortfolioModels({ activeOnly: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Modelos de site
        </h1>
        <p className="text-sm text-gray-500">
          Portfólio de estruturas oferecidas ao consultor na ativação. Cada modelo é uma cópia
          independente da estrutura: editá-lo afeta apenas quem ainda não ativou. Sites já criados
          nunca são alterados por aqui.
        </p>
      </div>
      <PortfolioModelsAdmin initialModels={models} />
    </div>
  );
}
