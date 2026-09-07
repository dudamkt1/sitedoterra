import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { currentPeriod } from "@/lib/crm-metas";

export const runtime = "nodejs";

/** POST /api/crm/metas/checks — marca ação do checklist (done/pending/skipped). */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const action_key = String(body.action_key || "").trim().slice(0, 60);
  const title = String(body.title || "").trim().slice(0, 200);
  const status = String(body.status || "done");
  if (!action_key) return NextResponse.json({ error: "action_key é obrigatório." }, { status: 400 });
  if (!["pending", "done", "skipped"].includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    let metaId = typeof body.meta_id === "string" && body.meta_id ? body.meta_id : null;
    const cp = currentPeriod();

    // Sem meta mensal ainda → garante uma (target 0) para vincular o checklist.
    if (!metaId) {
      const { data: all } = await admin
        .from("crm_metas")
        .select("id")
        .eq("tenant_id", tenant!.id)
        .eq("type", "monthly")
        .eq("year", cp.year)
        .eq("month", cp.month as never);
      const found = ((all as any[]) || [])[0];
      if (found) {
        metaId = found.id;
      } else {
        const { data: created, error: cErr } = await admin
          .from("crm_metas")
          .insert({
            tenant_id: tenant!.id,
            user_id: user!.id,
            type: "monthly",
            year: cp.year,
            month: cp.month,
            semester: null,
            target_cents: 0,
            target_sales: 0,
            name: `Meta mensal ${cp.month}/${cp.year}`,
          })
          .select("id")
          .single();
        if (cErr) return NextResponse.json({ error: "Erro ao preparar meta do mês." }, { status: 500 });
        metaId = (created as any).id;
      }
    } else {
      const { data: owner } = await admin.from("crm_metas").select("id").eq("id", metaId).eq("tenant_id", tenant!.id).maybeSingle();
      if (!owner) return NextResponse.json({ error: "Meta não encontrada." }, { status: 404 });
    }

    const period_key = `${cp.year}-${String(cp.month).padStart(2, "0")}`;
    const { data: existing } = await admin
      .from("crm_meta_checks")
      .select("id")
      .eq("meta_id", metaId)
      .eq("action_key", action_key)
      .maybeSingle();

    if (existing) {
      const { error: err } = await admin
        .from("crm_meta_checks")
        .update({
          status,
          title: title || undefined,
          done_at: status === "done" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existing as any).id);
      if (err) return NextResponse.json({ error: "Erro ao atualizar ação." }, { status: 500 });
    } else {
      const { error: err } = await admin.from("crm_meta_checks").insert({
        tenant_id: tenant!.id,
        meta_id: metaId,
        action_key,
        title: title || action_key,
        status,
        priority: Math.min(3, Math.max(1, Number(body.priority || 2))),
        period_key,
        done_at: status === "done" ? new Date().toISOString() : null,
      });
      if (err) return NextResponse.json({ error: "Erro ao salvar ação." }, { status: 500 });
    }

    return NextResponse.json({ success: true, meta_id: metaId });
  } catch (e: any) {
    if (String(e?.message || e).includes("crm_meta") || String(e?.code) === "42P01") {
      return NextResponse.json({ error: "Migration 0042 pendente. Rode a migration no Supabase." }, { status: 501 });
    }
    return NextResponse.json({ error: "Erro ao salvar ação." }, { status: 500 });
  }
}
