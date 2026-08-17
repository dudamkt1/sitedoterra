import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { attachClientMetrics, computeClientMetrics } from "@/lib/crm";
import type { CrmClient } from "@/types";

export const runtime = "nodejs";

const MAX = 2000;

/** GET /api/crm/clients — lista com busca, filtros, ordenação e paginação. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const category = url.searchParams.get("category") || "";
  const city = url.searchParams.get("city") || "";
  const state = url.searchParams.get("state") || "";
  const vip = url.searchParams.get("vip") === "1";
  const onlyVip = url.searchParams.get("onlyVip") === "1";
  const inactiveOnly = url.searchParams.get("inactive") === "1";
  const noContactOnly = url.searchParams.get("noContact") === "1";
  const periodFrom = url.searchParams.get("from") || "";
  const periodTo = url.searchParams.get("to") || "";
  const minSpent = Math.round(Number(url.searchParams.get("minSpent") || 0));
  const minPurchases = Math.round(Number(url.searchParams.get("minPurchases") || 0));
  const sort = url.searchParams.get("sort") || "name";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(5, Number(url.searchParams.get("perPage") || 25)));

  let query = admin.from("crm_clients").select("*").eq("tenant_id", tenant!.id);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (city) query = query.eq("city", city);
  if (state) query = query.eq("state", state);
  if (onlyVip) query = query.eq("is_vip", true);
  if (inactiveOnly) query = query.in("category", ["Cliente inativo", "Cliente perdido"]);
  if (periodFrom) query = query.gte("created_at", periodFrom);
  if (periodTo) query = query.lte("created_at", periodTo);
  query = query.order(sort === "recent" ? "created_at" : sort === "name" ? "name" : "created_at", { ascending: true }).limit(MAX);

  const { data, error: err } = await query;
  if (err) return NextResponse.json({ error: "Erro ao buscar clientes." }, { status: 500 });
  let clients = (data as CrmClient[]) || [];

  if (vip) clients = clients.filter((c) => c.is_vip);

  const metrics = await attachClientMetrics(admin, tenant!.id, clients);
  const map = computeClientMetrics(clients, [], []);

  let filtered = metrics;
  if (minSpent > 0) filtered = filtered.filter((c) => (c.total_spent_cents || 0) >= minSpent);
  if (minPurchases > 0) filtered = filtered.filter((c) => (c.purchase_count || 0) >= minPurchases);
  if (noContactOnly) {
    filtered = filtered.filter((c) => {
      const refs = [c.last_contact_at, c.last_purchase_at].filter(Boolean);
      if (!refs.length) return true;
      const latest = new Date(Math.max(...refs.map((r) => new Date(r as string).getTime())));
      return (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24) > 30;
    });
  }

  const total = filtered.length;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "recent":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "revenue":
        return (b.total_spent_cents || 0) - (a.total_spent_cents || 0);
      case "purchases":
        return (b.purchase_count || 0) - (a.purchase_count || 0);
      case "last_purchase":
        return (b.last_purchase_at || "").localeCompare(a.last_purchase_at || "");
      case "no_contact":
        return a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0 - (b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0);
      default:
        return a.name.localeCompare(b.name, "pt-BR");
    }
  });
  const rows = sorted.slice((page - 1) * perPage, page * perPage);
  const cities = Array.from(new Set((data as CrmClient[]).map((c) => c.city).filter(Boolean))) as string[];

  return NextResponse.json({ clients: rows, total, page, perPage, totalPages: Math.ceil(total / perPage), cities });
}

/** POST /api/crm/clients — cria cliente. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_clients")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      name,
      cpf: body.cpf || null,
      birth_date: body.birth_date || null,
      email: body.email || null,
      phone: body.phone || null,
      whatsapp: body.whatsapp || null,
      city: body.city || null,
      state: body.state || null,
      notes: body.notes || null,
      category: body.category || "Novo cliente",
      is_vip: Boolean(body.is_vip),
      first_contact_at: body.first_contact_at || null,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao criar cliente." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_client_create",
    entity_type: "crm_clients",
    entity_id: data.id,
    metadata: { name },
  });

  return NextResponse.json({ success: true, client: data });
}
