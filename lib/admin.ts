import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Helpers de administração centralizados.
 *
 * Toda a lógica de "quem é super admin" passa por aqui, evitando
 * hardcode espalhado pelo código. A única constante de configuração
 * é `process.env.SUPER_ADMIN_EMAILS` (CSV de e-mails).
 */

/**
 * Lista canônica de e-mails com permissão de super admin.
 * Lida apenas com `.trim().toLowerCase()` para garantir normalização.
 */
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Promove todos os e-mails em `SUPER_ADMIN_EMAILS` ao papel superadmin.
 * Chamado por hooks server-side (middleware, layout admin) — não no cliente.
 */
export async function ensureSuperAdminRole(): Promise<void> {
  const emails = getSuperAdminEmails();
  if (emails.length === 0) return;

  const admin = createAdminClient();
  for (const email of emails) {
    await admin
      .from("profiles")
      .update({ role: "superadmin" })
      .eq("email", email);
  }
}

/**
 * Helper server-side: verifica se o e-mail do usuário é super admin
 * (segundo `SUPER_ADMIN_EMAILS`). Usado por APIs que precisam de checagem
 * rápida antes de chamar `requireSuperAdmin`.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return getSuperAdminEmails().includes(lower);
}