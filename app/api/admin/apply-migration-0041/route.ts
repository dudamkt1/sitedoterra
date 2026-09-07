import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Aplica a migration 0041 (sincronização do super admin) via RPC idempotente.
 *
 * A função SQL `exec_migration_0041()` faz TODO o trabalho de forma segura
 * (re-executa IF NOT EXISTS / DROP IF EXISTS). Esta rota apenas valida que
 * o chamador é super admin e invoca a RPC via service_role.
 *
 * Idempotente: pode ser chamada várias vezes sem efeito colateral.
 */
export async function POST() {
  const profile = await getProfile();
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso restrito ao super admin." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("exec_migration_0041" as never);
  if (error) {
    if (/function.*exec_migration_0041.*does not exist/i.test(String(error))) {
      return NextResponse.json(
        {
          error:
            "A migration 0041 ainda não foi aplicada. Rode o conteúdo de supabase/migrations/0041_platform_official_home.sql no SQL Editor do Supabase e chame esta rota novamente.",
        },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, result: data });
}