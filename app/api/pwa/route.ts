import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultPwaSettings,
  type PwaSettings,
} from "@/lib/pwa/config";

export const runtime = "nodejs";

/**
 * GET  /api/pwa  → configurações PWA do usuário logado + URLs disponíveis
 * PUT  /api/pwa  → salva (upsert) SOMENTE as configurações do próprio usuário
 *
 * Isolamento: a linha é localizada por tenant do usuário autenticado —
 * nunca é aceito tenant_id/user_id do corpo da requisição.
 */

async function getTenantForUser(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, slug, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; slug: string; user_id: string } | null) || null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const tenant = await getTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ settings: defaultPwaSettings(), slug: null, customDomains: [] });

  const { data: row } = await admin
    .from("pwa_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const settings: PwaSettings = row
    ? { ...defaultPwaSettings(tenant.id, user.id), ...row }
    : defaultPwaSettings(tenant.id, user.id);

  const { data: domains } = await admin
    .from("domains")
    .select("domain, status, verified_at, removed_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const customDomains = ((domains as any[]) || [])
    .filter((d) => !d.removed_at && d.status === "active")
    .map((d) => String(d.domain).toLowerCase().replace(/^www\./, ""));

  return NextResponse.json({ settings, slug: tenant.slug, customDomains });
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tenant = await getTenantForUser(user.id);
  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant não encontrado para este usuário." },
      { status: 404 }
    );
  }

  // ---- validação/sanitização ----
  const str = (v: unknown, max: number): string =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  const app_name = str(body.app_name, 60);
  const short_name = str(body.short_name, 20) || app_name.slice(0, 12);
  const description = str(body.description, 160);
  const theme_color = HEX.test(String(body.theme_color || "")) ? String(body.theme_color) : "#1d5c3a";
  const background_color = HEX.test(String(body.background_color || ""))
    ? String(body.background_color)
    : "#faf8f2";

  const safeUrl = (v: unknown): string | null => {
    const s = str(v, 500);
    if (!s) return null;
    return /^(https?:\/\/|\/)/i.test(s) ? s : null;
  };

  const canonical = body.canonical === "custom" && Boolean(tenant.slug) ? "custom" : "platform";

  const row = {
    tenant_id: tenant.id,
    user_id: user.id,
    enabled: Boolean(body.enabled),
    app_name,
    short_name,
    description,
    logo_url: safeUrl(body.logo_url),
    icon_192_url: safeUrl(body.icon_192_url),
    icon_512_url: safeUrl(body.icon_512_url),
    icon_180_url: safeUrl(body.icon_180_url),
    icon_maskable_512_url: safeUrl(body.icon_maskable_512_url),
    theme_color,
    background_color,
    canonical,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("pwa_settings")
    .upsert(row, { onConflict: "tenant_id" });

  if (error) {
    console.error("[api/pwa] upsert:", error.message);
    return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: row });
}
