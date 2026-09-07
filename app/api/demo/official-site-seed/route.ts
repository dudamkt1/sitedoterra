import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveHomeSections } from "@/lib/home";
import type { PublicTenant } from "@/types";

export const runtime = "nodejs";

/**
 * Retorna dados públicos do site oficial da plataforma.
 *
 * Usado exclusivamente pela página /demonstracao para popular o seed
 * inicial (localStorage). NÃO grava nada — é leitura-only.
 *
 * Visitante com localStorage existente IGNORA esta resposta (suas
 * personalizações locais têm prioridade). Visitante sem localStorage usa
 * a versão retornada aqui como ponto de partida — mas suas alterações
 * continuam 100% locais (localStorage), nunca chegam ao banco.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: tenant } = await admin.rpc("resolve_official_home_tenant" as never);
    if (!tenant || !(tenant as { id?: string }).id) {
      return NextResponse.json({ ok: false, reason: "no_official_tenant" }, { status: 404 });
    }

    const t = tenant as unknown as PublicTenant;
    const sections = await resolveHomeSections({ tenant: t, tenantDataOverridesGlobal: true });
    return NextResponse.json({
      ok: true,
      site_data: t.site_data || {},
      tenant: {
        slug: t.slug,
        site_name: t.site_name,
        profile_name: t.profile_name,
        user_id: t.user_id,
      },
      sections_count: sections.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: "error", error: String(err) },
      { status: 500 }
    );
  }
}