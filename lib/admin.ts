import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Garante que e-mails na variável SUPER_ADMIN_EMAILS tenham papel superadmin.
 * Executa apenas no servidor (service role).
 */
export async function ensureSuperAdminRole(): Promise<void> {
  const emails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return;

  const admin = createAdminClient();
  for (const email of emails) {
    await admin
      .from("profiles")
      .update({ role: "superadmin" })
      .eq("email", email);
  }
}
