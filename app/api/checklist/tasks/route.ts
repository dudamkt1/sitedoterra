import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_FREQUENCY = new Set(["daily", "weekly", "monthly", "yearly"]);
const VALID_CATEGORY = new Set(["clients", "sales", "marketing", "content", "organization", "studies", "personal", "other"]);
const VALID_PRIORITY = new Set(["low", "medium", "high"]);

function validateTask(body: Record<string, unknown>) {
  const title = (body.title || "").toString().trim();
  if (title.length < 1 || title.length > 200) return { error: "Título inválido (1 a 200 caracteres)." };
  const frequency = (body.frequency || "").toString();
  if (!VALID_FREQUENCY.has(frequency)) return { error: "Periodicidade inválida." };
  const category = (body.category || "other").toString();
  if (!VALID_CATEGORY.has(category)) return { error: "Categoria inválida." };
  const priority = (body.priority || "medium").toString();
  if (!VALID_PRIORITY.has(priority)) return { error: "Prioridade inválida." };
  const description = body.description != null ? String(body.description).slice(0, 2000) : null;
  let timeOfDay: string | null = null;
  if (body.time_of_day) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time_of_day))) return { error: "Horário inválido (HH:MM)." };
    timeOfDay = String(body.time_of_day);
  }
  let dayOfWeek: number | null = null;
  if (body.day_of_week !== null && body.day_of_week !== undefined && body.day_of_week !== "") {
    const n = Number(body.day_of_week);
    if (!Number.isInteger(n) || n < 0 || n > 6) return { error: "Dia da semana inválido (0=Dom..6=Sáb)." };
    dayOfWeek = n;
  }
  let dayOfMonth: number | null = null;
  if (body.day_of_month !== null && body.day_of_month !== undefined && body.day_of_month !== "") {
    const n = Number(body.day_of_month);
    if (!Number.isInteger(n) || n < 1 || n > 31) return { error: "Dia do mês inválido (1..31)." };
    dayOfMonth = n;
  }
  let specificDate: string | null = null;
  if (body.specific_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.specific_date))) return { error: "Data específica inválida (YYYY-MM-DD)." };
    specificDate = String(body.specific_date);
  }
  // Regras por periodicidade
  if (frequency === "weekly" && dayOfWeek == null) return { error: "Tarefa semanal exige dia da semana." };
  if (frequency === "monthly" && dayOfMonth == null) return { error: "Tarefa mensal exige dia do mês." };
  if (frequency === "yearly" && !specificDate) return { error: "Tarefa anual exige data específica." };

  return {
    data: {
      title,
      description,
      frequency,
      category,
      priority,
      time_of_day: timeOfDay,
      day_of_week: dayOfWeek,
      day_of_month: dayOfMonth,
      specific_date: specificDate,
    },
  };
}

/**
 * GET /api/checklist/tasks
 * Lista todas as tarefas do usuário autenticado.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_checklist_tasks")
    .select("*")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("is_paused", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[checklist/tasks][GET]", error.message);
    return NextResponse.json({ error: "Erro ao listar tarefas." }, { status: 500 });
  }
  return NextResponse.json({ items: data || [] });
}

/**
 * POST /api/checklist/tasks
 * Cria nova tarefa do usuário.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const v = validateTask(body as Record<string, unknown>);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_checklist_tasks")
    .insert({ user_id: user.id, ...v.data })
    .select("*")
    .single();

  if (error) {
    console.error("[checklist/tasks][POST]", error.message);
    return NextResponse.json({ error: "Erro ao criar tarefa." }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}

/**
 * PATCH /api/checklist/tasks
 * Edita tarefa do usuário. { id, ...campos editáveis }
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string } & Record<string, unknown>;
  if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

  // Reaplica validação com o estado final (mantém campos existentes)
  const v = validateTask(body as Record<string, unknown>);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_checklist_tasks")
    .update(v.data)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[checklist/tasks][PATCH]", error.message);
    return NextResponse.json({ error: "Erro ao atualizar tarefa." }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}

/**
 * PUT /api/checklist/tasks — alias para "pausar/retomar" (ação simples)
 * body: { id, action: "pause" | "resume" | "toggle" }
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string; is_paused?: boolean };
  if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

  let nextPaused: boolean;
  if (body.action === "pause") nextPaused = true;
  else if (body.action === "resume") nextPaused = false;
  else if (body.action === "toggle") nextPaused = !body.is_paused;
  else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_checklist_tasks")
    .update({ is_paused: nextPaused })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[checklist/tasks][PUT]", error.message);
    return NextResponse.json({ error: "Erro ao atualizar tarefa." }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}

/**
 * DELETE /api/checklist/tasks
 * Soft delete: a task ganha `archived_at` e sai das listas ativas.
 * As conclusões (task_id) e o histórico permanecem preservados.
 * Use PAUSE (/api/checklist/tasks PUT action=pause) se quiser apenas
 * interromper novas ocorrências sem remover do histórico.
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_checklist_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error) {
    console.error("[checklist/tasks][DELETE]", error.message);
    return NextResponse.json({ error: "Erro ao arquivar tarefa." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
