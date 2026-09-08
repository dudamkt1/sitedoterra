import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Versão atual dos Termos e compromisso da ativação. */
const SITE_TERMS_VERSION = "1.0";

/**
 * POST /api/subscription/terms — registra o aceite dos Termos e compromisso
 * da ativação (usuário, data/hora, versão) no audit_logs.
 * Body: { version?: string }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const version = typeof body.version === "string" && body.version ? body.version.slice(0, 20) : SITE_TERMS_VERSION;

  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "subscription.terms_accepted",
    entity_type: "subscription",
    entity_id: user.id,
    metadata: { version, accepted_at: new Date().toISOString() },
  });
  if (error) return NextResponse.json({ error: "Não foi possível registrar o aceite." }, { status: 500 });

  return NextResponse.json({ success: true, version });
}
