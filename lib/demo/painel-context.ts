import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { getDemoDashboardContext, type DemoDashboardContext } from "@/lib/demo/context";
import { redirect } from "next/navigation";

export type PainelContext =
  | { isDemo: false; ctx: DashboardContext }
  | { isDemo: true; ctx: DemoDashboardContext };

/**
 * Resolve o contexto do /painel: se houver cookie DEMO válido, usa o contexto
 * de demonstração (sem tocar Supabase). Caso contrário, usa o contexto real.
 * Se não houver nenhum dos dois, redireciona para /login.
 */
export async function getPainelContext(): Promise<PainelContext> {
  const demo = await getDemoDashboardContext();
  if (demo) {
    return { isDemo: true, ctx: demo };
  }
  const real = await getDashboardContext();
  if (!real?.profile) {
    redirect("/login");
  }
  return { isDemo: false, ctx: real };
}
