import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { getDemoDashboardContext, type DemoDashboardContext } from "@/lib/demo/context";
import { redirect } from "next/navigation";

export type PainelContext =
  | { isDemo: false; ctx: DashboardContext }
  | { isDemo: true; ctx: DemoDashboardContext };

/**
 * Resolve o contexto do /painel.
 *
 * Prioridade (ordem importa!):
 *   1) Usuário REAL logado → sempre o site verdadeiro. Sem isso, quem um dia
 *      entrou na demonstração (cookie demo dura 30 dias) continuava editando
 *      o sandbox mesmo logado — o salvamento "funcionava" (localStorage) mas
 *      o site real nunca mudava.
 *   2) Cookie DEMO válido (visitante sem login) → contexto de demonstração.
 *   3) Nenhum dos dois → redireciona para /login.
 */
export async function getPainelContext(): Promise<PainelContext> {
  const realUser = await getCurrentUser().catch(() => null);
  if (realUser) {
    const real = await getDashboardContext();
    if (real?.profile) {
      return { isDemo: false, ctx: real };
    }
  }
  const demo = await getDemoDashboardContext();
  if (demo) {
    return { isDemo: true, ctx: demo };
  }
  redirect("/login");
}
