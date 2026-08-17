import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import type { CrmTask } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/tasks — tarefas com filtros. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const priority = url.searchParams.get("priority") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  let query = admin.from("crm_tasks").select("*").eq("tenant_id", tenant!.id);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);
  query = query.limit(1000);

  const { data, error: err } = await query;
  if (err) return NextResponse.json({ error: "Erro ao buscar tarefas." }, { status: 500 });

  const tasks = (data as CrmTask[]) || [];
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === "Concluída" && b.status !== "Concluída") return 1;
    if (a.status !== "Concluída" && b.status === "Concluída") return -1;
    return (a.due_date || "").localeCompare(b.due_date || "");
  });

  const clientIds = Array.from(new Set(sorted.map((t) => t.client_id).filter(Boolean) as string[]));
  const { data: clients } = clientIds.length ? await admin.from("crm_clients").select("id, name").in("id", clientIds).eq("tenant_id", tenant!.id) : { data: [] };
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  return NextResponse.json({
    tasks: sorted.map((t) => ({ ...t, client_name: t.client_id ? nameById.get(t.client_id) || null : null })),
  });
}

/** POST /api/crm/tasks — cria tarefa. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_tasks")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      client_id: body.client_id || null,
      title,
      due_date: body.due_date || null,
      due_time: body.due_time || null,
      priority: body.priority || "Média",
      category: body.category || null,
      notes: body.notes || null,
      status: body.status || "A fazer",
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao criar tarefa." }, { status: 500 });
  return NextResponse.json({ success: true, task: data });
}