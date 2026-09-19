import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = createAdminClient();
  const { id } = await params;
  const body = await req.json();

  const { title, description, image_url, link_url, order, tenant_id } = body;

  if (!title || !link_url) {
    return NextResponse.json({ error: "Título e link são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("support_materials")
    .update({
      title,
      description,
      image_url,
      link_url,
      order: order || 0,
      tenant_id: tenant_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ material: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = createAdminClient();
  const { id } = await params;

  const { error } = await admin.from("support_materials").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}