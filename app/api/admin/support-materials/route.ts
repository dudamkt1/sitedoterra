import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("support_materials")
    .select("*, tenants(slug, site_name)")
    .order("order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ materials: data });
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const body = await req.json();

  const { title, description, image_url, link_url, order, tenant_id } = body;

  if (!title || !link_url) {
    return NextResponse.json({ error: "Título e link são obrigatórios" }, { status: 400 });
  }

  const { data: { user } } = await admin.auth.getUser();

  const { data, error } = await admin
    .from("support_materials")
    .insert({
      title,
      description,
      image_url,
      link_url,
      order: order || 0,
      tenant_id: tenant_id || null,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ material: data }, { status: 201 });
}