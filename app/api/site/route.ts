import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * Salva o conteúdo/configurações do site do tenant (site_settings.data).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "name", "surname", "fullName", "role", "eyebrow", "description",
    "whatsapp", "email", "instagram", "instagramHandle",
    "logoMode", "logoUrl", "logoText",
    "stats", "testimonials", "history", "products", "faq", "schedule",
    "video", "social", "site_title",
  ];

  // Sanitiza: mantém apenas chaves permitidas
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: existing } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const merged = { ...(existing?.data as Record<string, unknown>), ...data };

  const { error } = await admin
    .from("site_settings")
    .upsert({ tenant_id: tenant.id, data: merged }, { onConflict: "tenant_id" });

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar as configurações." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
