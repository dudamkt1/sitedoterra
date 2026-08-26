import { getPainelContext } from "@/lib/demo/painel-context";
import { SectionTitle } from "@/components/dashboard/ui";
import ContaForm from "@/components/painel/ContaForm";

export default async function ContaPage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;

  const p = ctx.profile;
  if (!p) return null;

  return (
    <div>
      <SectionTitle sub="Edite seus dados e visualize informações gerais da conta.">Minha Conta</SectionTitle>
      <ContaForm
        profile={{
          user_id: (p as any).user_id || (p as any).id || "",
          name: (p as any).name || null,
          email: (p as any).email || "",
          phone: (p as any).phone || null,
          status: (p as any).status || "active",
          created_at: (p as any).created_at || new Date().toISOString(),
          activated_at: (p as any).activated_at || null,
          cancelled_at: (p as any).cancelled_at || null,
          suspended_at: (p as any).suspended_at || null,
          blocked_at: (p as any).blocked_at || null,
        }}
        isDemo={isDemo}
      />
    </div>
  );
}
