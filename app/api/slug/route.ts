import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { slugify, isValidSlug } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Define o nome de usuário (slug) do tenant.
 * A URL pública passa a ser: {dominio}/{slug}
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { slug: rawSlug } = await request.json();
  const slug = slugify(String(rawSlug || ""));

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: "Nome de usuário inválido. Use 2-40 caracteres (letras, números e hífen), sem espaços ou caracteres especiais." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  // Verifica disponibilidade (excluindo o próprio usuário)
  const { data: available } = await admin.rpc("is_slug_available", {
    p_slug: slug,
    p_exclude_user_id: user.id,
  });

  if (!available) {
    return NextResponse.json({ error: "Este nome de usuário já está em uso. Escolha outro." }, { status: 409 });
  }

  // Só libera o site quando houver assinatura ativa
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const siteStatus = sub?.status === "active" ? "active" : "pending";

  const { error } = await admin
    .from("tenants")
    .update({ slug, site_status: siteStatus, activated_at: sub?.status === "active" ? new Date().toISOString() : undefined })
    .eq("id", tenant.id);

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o nome de usuário." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "tenant.slug_updated",
    entity_type: "tenant",
    entity_id: tenant.id,
    metadata: { slug },
  });

  return NextResponse.json({ success: true, slug });
}
