import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/affiliate/materials — materiais ATIVOS para o afiliado baixar e usar.
 * Qualquer usuário autenticado (a visibilidade é por "ativo", não por vínculo).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_materials")
    .select("id, title, description, kind, format, file_url, thumbnail_url, file_size_bytes, width, height, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    if (/affiliate_materials/i.test(error.message || "")) {
      return NextResponse.json({ success: true, materials: [] });
    }
    return NextResponse.json({ error: "Erro ao listar materiais." }, { status: 500 });
  }
  return NextResponse.json({ success: true, materials: data || [] });
}
