import { CrmUsageStats } from "@/components/admin/CrmUsageStats";

export const dynamic = "force-dynamic";

export default function AdminCrmPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>CRM — visão geral</h1>
        <p className="text-sm text-gray-500">
          Acompanhe a adoção do CRM pelos consultores. Este painel mostra apenas métricas agregadas — os dados de
          clientes e vendas de cada consultor são isolados e nunca são exibidos aqui.
        </p>
      </div>
      <CrmUsageStats />
    </div>
  );
}