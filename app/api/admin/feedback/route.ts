import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_STATUS = new Set(["pending", "read", "in_progress", "resolved", "archived"]);
const VALID_TYPES = new Set(["suggestion", "question", "criticism", "problem", "praise", "other"]);

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { actor };
}

/**
 * GET /api/admin/feedback
 * Lista paginada com filtros: status, type, search (nome, e-mail, conteúdo).
 * Retorna também counts agregados (totais por status) para o dashboard.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";
  const search = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));

  const admin = createAdminClient();
  let query = admin
    .from("user_feedback")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status && VALID_STATUS.has(status)) query = query.eq("status", status);
  if (type && VALID_TYPES.has(type)) query = query.eq("type", type);
  if (search) {
    // Busca em nome, e-mail e conteúdo. Para e-mail+texto, usamos `or` com `ilike`.
    const safe = search.replace(/[%_,]/g, (m) => `\\${m}`);
    query = query.or(
      `user_name.ilike.%${safe}%,user_email.ilike.%${safe}%,message.ilike.%${safe}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin/feedback] list error:", error.message);
    return NextResponse.json({ error: "Erro ao buscar mensagens." }, { status: 500 });
  }

  // Counts agregados (rápido e barato — uma única query paralela)
  const { data: statusRows } = await admin
    .from("user_feedback")
    .select("status", { count: "exact", head: false });

  const counts = { all: 0, pending: 0, read: 0, in_progress: 0, resolved: 0, archived: 0 };
  if (Array.isArray(statusRows)) {
    for (const r of statusRows as Array<{ status: string }>) {
      counts.all += 1;
      if (r.status && counts[r.status as keyof typeof counts] !== undefined) {
        (counts as Record<string, number>)[r.status] += 1;
      }
    }
  }

  return NextResponse.json({
    items: data || [],
    total: count || 0,
    page,
    pageSize,
    counts,
  });
}

/**
 * PATCH /api/admin/feedback
 * Atualiza status, admin_notes de uma mensagem específica.
 * id obrigatório; status opcional (validado), admin_notes opcional.
 */
export async function PATCH(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    admin_notes?: string | null;
  };
  if (!body.id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.status) {
    if (!VALID_STATUS.has(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "read" || body.status === "in_progress") {
      updates.read_at = new Date().toISOString();
    }
    if (body.status === "resolved") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = guard.actor!.id;
    }
  }
  if (body.admin_notes !== undefined) {
    updates.admin_notes = body.admin_notes ? String(body.admin_notes).slice(0, 4000) : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_feedback")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) {
    console.error("[admin/feedback] update error:", error.message);
    return NextResponse.json({ error: "Erro ao atualizar mensagem." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data });
}
