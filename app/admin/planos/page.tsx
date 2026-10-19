import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveGateway } from "@/lib/gateway-config";
import { AdminPlans } from "@/components/admin/AdminPlans";

export const dynamic = "force-dynamic";

export default async function AdminPlanosPage() {
  const admin = createAdminClient();
  const [gateway, { data: plans }, { data: history }] = await Promise.all([
    getActiveGateway(),
    admin.from("plans").select("*").order("sort_order", { ascending: true }).order("created_at"),
    admin.from("price_history").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Planos e Preços</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configuração comercial centralizada. Preços, mensalidade, benefícios e textos definidos aqui
        são a fonte de verdade para a HOME, o painel e o checkout. O gateway de pagamento ativo é
        aplicado automaticamente.
      </p>
      <AdminPlans
        plans={(plans || []) as any[]}
        history={(history || []) as any[]}
        gateway={gateway}
      />
    </div>
  );
}
