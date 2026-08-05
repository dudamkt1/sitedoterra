import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPlans } from "@/components/admin/AdminPlans";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPlanosPage() {
  const admin = createAdminClient();
  const { data: plans } = await admin.from("plans").select("*").order("created_at");

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Planos</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure valores de ativação e mensalidade, planos e disponibilidade.
      </p>
      <AdminPlans plans={(plans || []).map((p: any) => ({ ...p, priceLabel: formatBRL(p.monthly_price_cents), activationLabel: formatBRL(p.activation_price_cents) }))} />
    </div>
  );
}
