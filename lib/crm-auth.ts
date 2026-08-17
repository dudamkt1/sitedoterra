import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Autentica o usuário e resolve o tenant dele (nunca confia no tenant_id enviado).
 * Retorna o NextResponse de erro pronto ou { error: null, admin, tenant, user }.
 */
export async function requireTenant() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), admin: null, tenant: null, user: null };
  }
  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) {
    return { error: NextResponse.json({ error: "Tenant não encontrado" }, { status: 500 }), admin: null, tenant: null, user: null };
  }
  return { error: null, admin, tenant, user };
}