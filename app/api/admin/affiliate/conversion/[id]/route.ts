import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED = ["pendente", "aprovado", "estornado"] as const;

/**
 * PATCH /api/admin/affiliate/conversion/[id]
 * Super Admin altera MANUALMENTE o status de uma conversão
 * (pendente → aprovado/estornado, ou reversão para pendente).
 * A aprovação automática de 7 dias continua valendo para o restante.
 *
 * Body: { status: "pendente" | "aprovado" | "estornado" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!(ALLOWED as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Status inválido (use pendente, aprovado ou estornado)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: conversion } = await admin
    .from("affiliate_conversions")
    .select("id, affiliate_user_id, commission_amount, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!conversion) {
    return NextResponse.json({ error: "Conversão não encontrada" }, { status: 404 });
  }

  const { error } = await admin
    .from("affiliate_conversions")
    .update({ status })
    .eq("id", params.id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: "affiliate.conversion_status",
    entity_type: "affiliate_conversion",
    entity_id: params.id,
    metadata: {
      affiliate_user_id: (conversion as { affiliate_user_id: string }).affiliate_user_id,
      from: (conversion as { status: string }).status,
      to: status,
    },
  });

  return NextResponse.json({ success: true, status });
}
