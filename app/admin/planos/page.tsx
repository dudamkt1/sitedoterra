import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPlans } from "@/components/admin/AdminPlans";

export const dynamic = "force-dynamic";

export default async function AdminPlanosPage() {
  const admin = createAdminClient();
  const [{ data: plans }, { data: history }] = await Promise.all([
    admin.from("plans").select("*").order("sort_order", { ascending: true }).order("created_at"),
    admin.from("price_history").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Planos e Preços</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configuração comercial centralizada. Preços, mensalidade, benefícios, textos e Price IDs do Stripe definidos aqui
        são a fonte de verdade para a HOME, o painel e o checkout.
      </p>
      <AdminPlans
        plans={(plans || []) as any[]}
        history={(history || []) as any[]}
      />
    </div>
  );
}
