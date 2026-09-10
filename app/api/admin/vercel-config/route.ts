import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getVercelConfigStatus, invalidateVercelCredsCache } from "@/lib/vercel";

export const runtime = "nodejs";

/**
 * Credenciais da API Vercel p/ domínios próprios (Super Admin → /admin/dominios).
 * Alternativa ao ENV (VERCEL_PROJECT_ID / VERCEL_API_TOKEN / VERCEL_TEAM_ID):
 * o que estiver salvo aqui vale quando o ENV está vazio.
 *
 * GET → status (sem segredos) · PUT { projectId?, apiToken?, teamId? } salva.
 */

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { actor };
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;
  return NextResponse.json(await getVercelConfigStatus());
}

export async function PUT(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    apiToken?: string;
    teamId?: string;
  };

  const entries: [string, string][] = [];
  if (body.projectId !== undefined) entries.push(["vercel_project_id", String(body.projectId || "").trim()]);
  // Token vazio = não altera (nunca exibimos o valor salvo).
  if (body.apiToken !== undefined && String(body.apiToken || "").trim()) {
    entries.push(["vercel_api_token", String(body.apiToken).trim()]);
  }
  if (body.teamId !== undefined) entries.push(["vercel_team_id", String(body.teamId || "").trim()]);

  if (entries.length === 0) {
    return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });
  }

  const admin = createAdminClient();
  for (const [key, value] of entries) {
    // value é jsonb: serializa a string como JSON válido.
    const { error } = await admin
      .from("platform_config")
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
    }
  }

  invalidateVercelCredsCache();
  return NextResponse.json({ success: true, ...(await getVercelConfigStatus()) });
}
