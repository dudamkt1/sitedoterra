import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Aplica a migration 0042 (Minhas Metas do CRM) via RPC idempotente.
 * Idempotente: pode ser chamada várias vezes sem efeito colateral.
 */
export async function POST() {
  const profile = await getProfile();
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso restrito ao super admin." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("exec_migration_0042" as never);
  if (error) {
    if (/function.*exec_migration_0042.*does not exist/i.test(String(error))) {
      return NextResponse.json(
        {
          error:
            "A migration 0042 ainda não foi aplicada. Rode o conteúdo de supabase/migrations/0042_crm_metas.sql no SQL Editor do Supabase e chame esta rota novamente.",
        },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, result: data });
}
