import type { DashboardContext } from "@/lib/auth";

/**
 * Verifica se o site do usuário está ativado (site_status === "active").
 * Um site ativo permite acesso total ao painel.
 * Sites em "pending" ou "suspended" têm acesso restrito.
 */
export function isSiteActivated(ctx: DashboardContext): boolean {
  return ctx.tenant?.site_status === "active";
}

/**
 * Retorna true se o usuário pode acessar o painel completo.
 * Exceções: demo, super admin, ou site ativado.
 */
export function canAccessFullPainel(ctx: DashboardContext, isDemo: boolean): boolean {
  if (isDemo) return true;
  if (ctx.profile?.role === "superadmin") return true;
  return isSiteActivated(ctx);
}