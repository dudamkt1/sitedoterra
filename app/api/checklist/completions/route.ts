import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/checklist/completions
 * Query: from=YYYY-MM-DD&to=YYYY-MM-DD (opcional; sem limites retorna os últimos 90 dias)
 * Retorna todas as conclusões do usuário no intervalo para montar histórico/estatísticas.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (from && !ISO_DATE.test(from)) return NextResponse.json({ error: "from inválido." }, { status: 400 });
  if (to && !ISO_DATE.test(to)) return NextResponse.json({ error: "to inválido." }, { status: 400 });

  const admin = createAdminClient();
  let q = admin
    .from("user_checklist_completions")
    .select("id, task_id, user_id, task_title_snapshot, frequency_snapshot, occurrence_date, completed_at, created_at")
    .eq("user_id", user.id)
    .order("occurrence_date", { ascending: false });
  if (from) q = q.gte("occurrence_date", from);
  if (to) q = q.lte("occurrence_date", to);
  if (!from && !to) {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    q = q.gte("occurrence_date", d.toISOString().slice(0, 10));
  }
  const { data, error } = await q;
  if (error) {
    console.error("[checklist/completions][GET]", error.message);
    return NextResponse.json({ error: "Erro ao listar conclusões." }, { status: 500 });
  }
  return NextResponse.json({ items: data || [] });
}

/**
 * POST /api/checklist/completions
 * Body: { task_id, occurrence_date, action: "toggle" | "complete" | "uncomplete" }
 * Aplica a ação e retorna o estado final.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    task_id?: string;
    occurrence_date?: string;
    action?: "toggle" | "complete" | "uncomplete";
  };
  if (!body.task_id) return NextResponse.json({ error: "task_id obrigatório." }, { status: 400 });
  if (!body.occurrence_date || !ISO_DATE.test(body.occurrence_date)) {
    return NextResponse.json({ error: "occurrence_date inválido (YYYY-MM-DD)." }, { status: 400 });
  }
  const action = body.action || "toggle";

  const admin = createAdminClient();
  // Garante que a task pertence ao usuário; também captura snapshot para o histórico.
  const { data: task } = await admin
    .from("user_checklist_tasks")
    .select("id, title, frequency, user_id, archived_at, is_paused")
    .eq("id", body.task_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  if (task.archived_at) return NextResponse.json({ error: "Tarefa arquivada." }, { status: 400 });
  if (task.is_paused) return NextResponse.json({ error: "Tarefa pausada." }, { status: 400 });

  // Verifica se já existe
  const { data: existing } = await admin
    .from("user_checklist_completions")
    .select("id")
    .eq("task_id", body.task_id)
    .eq("occurrence_date", body.occurrence_date)
    .maybeSingle();

  let completed: boolean;
  if (action === "toggle") completed = !existing;
  else if (action === "complete") completed = true;
  else if (action === "uncomplete") completed = false;
  else return NextResponse.json({ error: "action inválida." }, { status: 400 });

  if (completed && !existing) {
    const { error } = await admin.from("user_checklist_completions").insert({
      task_id: task.id,
      user_id: user.id,
      task_title_snapshot: task.title,
      frequency_snapshot: task.frequency,
      occurrence_date: body.occurrence_date,
    });
    if (error) {
      console.error("[checklist/completions][POST insert]", error.message);
      return NextResponse.json({ error: "Erro ao registrar conclusão." }, { status: 500 });
    }
  } else if (!completed && existing) {
    const { error } = await admin
      .from("user_checklist_completions")
      .delete()
      .eq("id", existing.id);
    if (error) {
      console.error("[checklist/completions][POST delete]", error.message);
      return NextResponse.json({ error: "Erro ao remover conclusão." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, task_id: body.task_id, occurrence_date: body.occurrence_date, completed });
}
