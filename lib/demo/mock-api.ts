// Mock local das APIs do painel para o MODO DEMONSTRAÇÃO (acesso rápido).
// Executa 100% no navegador: intercepta window.fetch e responde com dados
// salvos no localStorage. Nada chega ao servidor — sites reais ficam intactos.

import type {
  DemoCrmData,
  DemoCrmSale,
  DemoCrmProduct,
  DemoCrmCharge,
  DemoCrmTask,
  DemoCrmFinancialEntry,
  DemoMediaFile,
} from "./crm-store";
import { loadDemoCrm, saveDemoCrm } from "./crm-store";
import { loadDemoData, saveDemoData } from "./storage";
import { DEMO_SECTION_TYPES } from "./seed";
import {
  anchorFor,
  DEFAULT_SECTION_CONTENT,
  SECTION_TYPE_LABELS,
} from "@/lib/site-sections";
import type { SectionType } from "@/types";
import { TOOL_SCHEMAS } from "@/lib/ai-tools";
import { DEMO_AI_TOOLS, DEMO_AI_TEMPLATES, DEMO_AI_PROVIDERS } from "./ai-catalog";

export interface DemoApiResult {
  status: number;
  json: unknown;
}

const NAV_TYPES = ["about", "testimonials", "story", "booking", "products", "faq"];
const NAV_LABELS: Partial<Record<SectionType, string>> = {
  about: "Especialista IA",
  testimonials: "Depoimentos",
  story: "História",
  booking: "Agendamento",
  products: "Produtos",
  faq: "Dúvidas",
};

function genId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${rand}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(d: string) {
  return d.slice(0, 7);
}

/** Recalcula agregados (compras, total gasto, pontos) de todos os clientes. */
function recomputeAggregates(db: DemoCrmData) {
  for (const c of db.clients) {
    const sales = db.sales.filter((s) => s.client_id === c.id);
    const valid = sales.filter((s) => s.status !== "Cancelado" && s.status !== "Reembolsado");
    c.purchase_count = valid.length;
    c.total_spent_cents = valid.reduce((acc, s) => acc + s.items.reduce((a, i) => a + i.total_cents, 0), 0);
    if (valid.length > 0) {
      const dates = valid.map((s) => s.sale_date).sort();
      c.last_purchase_at = dates[dates.length - 1];
      c.first_purchase_at = dates[0];
    } else {
      c.last_purchase_at = null;
      c.first_purchase_at = null;
    }
    c.points_balance = db.points.filter((p) => p.client_id === c.id).reduce((a, p) => a + p.amount, 0);
  }
}

function clientName(db: DemoCrmData, id: string | null): string | null {
  if (!id) return null;
  return db.clients.find((c) => c.id === id)?.name || null;
}

// ---------------------------------------------------------------- CRM ----

function handleCrm(pathname: string, sp: URLSearchParams, method: string, body: any): DemoApiResult | null {
  const db = loadDemoCrm();

  // ---------- stats ----------
  if (pathname === "/api/crm/stats" && method === "GET") {
    recomputeAggregates(db);
    const nowM = monthKey(today());
    const vipList = [...db.clients].filter((c) => c.is_vip).sort((a, b) => b.total_spent_cents - a.total_spent_cents);
    const upcomingTasks = db.tasks
      .filter((t) => t.status !== "Concluída")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 8);
    const revenueByMonth: { month: string; total_cents: number; sales: number }[] = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      revenueByMonth.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, total_cents: 0, sales: 0 });
    }
    for (const s of db.sales) {
      if (s.status === "Cancelado" || s.status === "Reembolsado") continue;
      const entry = revenueByMonth.find((m) => m.month === monthKey(s.sale_date));
      if (entry) {
        entry.total_cents += s.items.reduce((a, i) => a + i.total_cents, 0);
        entry.sales += 1;
      }
    }
    return {
      status: 200,
      json: {
        stats: {
          activeClients: db.clients.length,
          vipClients: db.clients.filter((c) => c.is_vip).length,
          monthSales: db.sales.filter((s) => monthKey(s.sale_date) === nowM).length,
          monthRevenueCents: db.sales
            .filter((s) => monthKey(s.sale_date) === nowM && !["Cancelado", "Reembolsado"].includes(s.status))
            .reduce((a, s) => a + s.items.reduce((x, i) => x + i.total_cents, 0), 0),
          receivableCents: db.charges.filter((c) => c.status !== "Pago").reduce((a, c) => a + c.amount_cents, 0),
          pendingCharges: db.charges.filter((c) => c.status === "Pendente").length,
          overdueCharges: db.charges.filter((c) => c.status === "Vencido" || (c.status !== "Pago" && c.due_date < today())).length,
          clientsWithoutRecentContact: db.clients.filter(
            (c) => !c.last_contact_at || Date.now() - new Date(c.last_contact_at).getTime() > 60 * 86400000
          ).length,
          upcomingBirthdays: db.clients
            .filter((c) => c.birth_date)
            .slice(0, 5)
            .map((c) => ({ id: c.id, name: c.name, birth_date: c.birth_date! })),
          upcomingTasks,
          vipClientsList: vipList.slice(0, 5),
          needsAttention: db.clients.slice(0, 5),
          revenueByMonth,
          consultantName: "Carla Oliveira",
          currency: "BRL",
        },
        settings: db.settings,
      },
    };
  }

  // ---------- clients ----------
  if (pathname === "/api/crm/clients") {
    if (method === "GET") {
      recomputeAggregates(db);
      let list = [...db.clients];
      const q = (sp.get("q") || "").toLowerCase();
      if (q) list = list.filter((c) => [c.name, c.email, c.city].some((v) => v && v.toLowerCase().includes(q)));
      const category = sp.get("category");
      if (category) list = list.filter((c) => c.category === category);
      const city = sp.get("city");
      if (city) list = list.filter((c) => c.city === city);
      if (sp.get("onlyVip") === "1") list = list.filter((c) => c.is_vip);
      if (sp.get("inactive") === "1")
        list = list.filter((c) => !c.last_purchase_at || Date.now() - new Date(c.last_purchase_at).getTime() > 90 * 86400000);
      if (sp.get("noContact") === "1")
        list = list.filter((c) => !c.last_contact_at || Date.now() - new Date(c.last_contact_at).getTime() > 60 * 86400000);
      const minSpent = Number(sp.get("minSpent") || 0);
      if (minSpent > 0) list = list.filter((c) => c.total_spent_cents >= minSpent);

      const sort = sp.get("sort") || "name";
      list.sort((a, b) => {
        switch (sort) {
          case "revenue": return b.total_spent_cents - a.total_spent_cents;
          case "purchases": return b.purchase_count - a.purchase_count;
          case "recent": return b.created_at.localeCompare(a.created_at);
          case "last_purchase": return (b.last_purchase_at || "").localeCompare(a.last_purchase_at || "");
          default: return a.name.localeCompare(b.name);
        }
      });

      const perPage = Number(sp.get("perPage") || 25);
      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const page = Math.min(Number(sp.get("page") || 1), totalPages);
      const paged = list.slice((page - 1) * perPage, page * perPage);
      return {
        status: 200,
        json: {
          clients: paged,
          total,
          totalPages,
          cities: Array.from(new Set(db.clients.map((c) => c.city).filter(Boolean) as string[])),
        },
      };
    }
    if (method === "POST") {
      const id = genId("cli");
      db.clients.push({
        id,
        name: String(body.name || "Sem nome"),
        cpf: body.cpf || null,
        birth_date: body.birth_date || null,
        email: body.email || null,
        phone: body.phone || null,
        whatsapp: body.whatsapp ? String(body.whatsapp).replace(/\D/g, "") : body.phone ? `55${String(body.phone).replace(/\D/g, "")}` : null,
        city: body.city || null,
        state: body.state || null,
        notes: body.notes || null,
        category: body.category || "Lead",
        is_vip: false,
        first_contact_at: body.first_contact_at || today(),
        first_purchase_at: null,
        last_purchase_at: null,
        last_contact_at: today(),
        created_at: new Date().toISOString(),
        total_spent_cents: 0,
        purchase_count: 0,
        points_balance: 0,
      });
      db.timeline.push({
        id: genId("tl"), client_id: id, event_type: "manual",
        title: "Cliente cadastrado", description: null, event_at: new Date().toISOString(), created_at: new Date().toISOString(),
      });
      saveDemoCrm(db);
      return { status: 200, json: { id } };
    }
  }

  const clientDetail = pathname.match(/^\/api\/crm\/clients\/([^/]+)$/);
  if (clientDetail) {
    const cid = clientDetail[1];
    const client = db.clients.find((c) => c.id === cid);
    if (!client) return { status: 404, json: { error: "Cliente não encontrado." } };
    if (method === "GET") {
      recomputeAggregates(db);
      const levels = [...db.loyalty.levels].sort((a, b) => a.min_points - b.min_points);
      let level = levels[0]?.name || "Bronze";
      for (const l of levels) if (client.points_balance >= l.min_points) level = l.name;
      return {
        status: 200,
        json: {
          client,
          sales: db.sales.filter((s) => s.client_id === cid),
          timeline: db.timeline.filter((t) => t.client_id === cid).sort((a, b) => b.event_at.localeCompare(a.event_at)),
          notes: db.notes.filter((n) => n.client_id === cid).sort((a, b) => b.created_at.localeCompare(a.created_at)),
          charges: db.charges.filter((c) => c.client_id === cid),
          tasks: db.tasks.filter((t) => t.client_id === cid),
          points: db.points.filter((p) => p.client_id === cid).sort((a, b) => b.created_at.localeCompare(a.created_at)),
          settings: db.settings,
          level,
          levels,
          consultant_name: "Carla Oliveira",
          site_name: "demonstracao",
        },
      };
    }
    if (method === "PUT") {
      Object.assign(client, {
        name: body.name ?? client.name,
        cpf: body.cpf !== undefined ? body.cpf : client.cpf,
        birth_date: body.birth_date !== undefined ? body.birth_date : client.birth_date,
        email: body.email !== undefined ? body.email : client.email,
        phone: body.phone !== undefined ? body.phone : client.phone,
        whatsapp: body.whatsapp !== undefined ? String(body.whatsapp).replace(/\D/g, "") : client.whatsapp,
        city: body.city !== undefined ? body.city : client.city,
        state: body.state !== undefined ? body.state : client.state,
        notes: body.notes !== undefined ? body.notes : client.notes,
        category: body.category ?? client.category,
        is_vip: typeof body.is_vip === "boolean" ? body.is_vip : client.is_vip,
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (method === "DELETE") {
      db.clients = db.clients.filter((c) => c.id !== cid);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const clientTimeline = pathname.match(/^\/api\/crm\/clients\/([^/]+)\/timeline$/);
  if (clientTimeline) {
    const cid = clientTimeline[1];
    if (method === "POST") {
      db.timeline.push({
        id: genId("tl"), client_id: cid, event_type: body.event_type || "manual",
        title: body.title || "Evento", description: body.description || null,
        event_at: body.event_at || new Date().toISOString(), created_at: new Date().toISOString(),
      });
      if (body.event_type === "contato") {
        const c = db.clients.find((x) => x.id === cid);
        if (c) c.last_contact_at = today();
      }
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (method === "DELETE") {
      db.timeline = db.timeline.filter((t) => t.id !== sp.get("eventId"));
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const clientNotes = pathname.match(/^\/api\/crm\/clients\/([^/]+)\/notes$/);
  if (clientNotes) {
    const cid = clientNotes[1];
    if (method === "POST") {
      db.notes.push({ id: genId("note"), client_id: cid, note: body.note || "", created_at: new Date().toISOString() });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (method === "DELETE") {
      db.notes = db.notes.filter((n) => n.id !== sp.get("noteId"));
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  // ---------- sales ----------
  if (pathname === "/api/crm/sales") {
    if (method === "GET") {
      let list = [...db.sales];
      const st = sp.get("status");
      if (st) list = list.filter((s) => s.status === st);
      const cid = sp.get("clientId");
      if (cid) list = list.filter((s) => s.client_id === cid);
      const from = sp.get("from");
      if (from) list = list.filter((s) => s.sale_date >= from);
      const to = sp.get("to");
      if (to) list = list.filter((s) => s.sale_date <= to);
      list.sort((a, b) => b.sale_date.localeCompare(a.sale_date));
      const perPage = Number(sp.get("perPage") || 25);
      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const page = Math.min(Number(sp.get("page") || 1), totalPages);
      return {
        status: 200,
        json: {
          sales: list.slice((page - 1) * perPage, page * perPage).map((s) => ({ ...s, client_name: clientName(db, s.client_id) })),
          total,
          totalPages,
        },
      };
    }
    if (method === "POST") {
      db.sales.push({
        id: genId("sale"), client_id: body.client_id || null, sale_date: body.sale_date || today(),
        status: body.status || "Pendente", payment_method: body.payment_method || null,
        notes: body.notes || null, items: Array.isArray(body.items) ? body.items : [],
        created_at: new Date().toISOString(),
      });
      recomputeAggregates(db);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const saleItem = pathname.match(/^\/api\/crm\/sales\/([^/]+)$/);
  if (saleItem && method === "DELETE") {
    db.sales = db.sales.filter((s) => s.id !== saleItem[1]);
    recomputeAggregates(db);
    saveDemoCrm(db);
    return { status: 200, json: {} };
  }

  // ---------- products ----------
  if (pathname === "/api/crm/products") {
    if (method === "GET") {
      const list = db.products.map((p) => {
        const sold = db.sales.filter((s) => !["Cancelado", "Reembolsado"].includes(s.status)).flatMap((s) => s.items).filter((i) => i.product_id === p.id);
        return { ...p, units_sold: sold.reduce((a, i) => a + i.quantity, 0), sold_cents: sold.reduce((a, i) => a + i.total_cents, 0) };
      });
      return { status: 200, json: { products: list } };
    }
    if (method === "POST") {
      db.products.push({
        id: genId("prod"), name: body.name, description: body.description || null,
        price_cents: Number(body.price_cents || 0), category: body.category || null,
        image_url: body.image_url || null, active: true, created_at: new Date().toISOString(),
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const prodItem = pathname.match(/^\/api\/crm\/products\/([^/]+)$/);
  if (prodItem) {
    const prod = db.products.find((p) => p.id === prodItem[1]);
    if (prod && method === "PUT") {
      Object.assign(prod, {
        name: body.name ?? prod.name,
        price_cents: body.price_cents !== undefined ? Number(body.price_cents) : prod.price_cents,
        category: body.category !== undefined ? body.category : prod.category,
        description: body.description !== undefined ? body.description : prod.description,
        image_url: body.image_url !== undefined ? body.image_url : prod.image_url,
        active: typeof body.active === "boolean" ? body.active : prod.active,
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (prod && method === "DELETE") {
      db.products = db.products.filter((p) => p.id !== prodItem[1]);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  // ---------- charges ----------
  function chargeSummary(data: DemoCrmData) {
    const sum = (f: (c: DemoCrmCharge) => boolean) =>
      data.charges.filter(f).reduce((a, c) => a + c.amount_cents, 0);
    return {
      toReceive: sum((c) => c.status === "Pendente"),
      received: sum((c) => c.status === "Pago"),
      overdue: sum((c) => c.status === "Vencido"),
      upcoming: sum((c) => c.status === "Pendente" && c.due_date >= today() && c.due_date <= daysFromNowIso(7)),
    };
  }

  if (pathname === "/api/crm/charges") {
    if (method === "GET") {
      let list = [...db.charges];
      const st = sp.get("status");
      if (st) list = list.filter((c) => c.status === st);
      const cid = sp.get("clientId");
      if (cid) list = list.filter((c) => c.client_id === cid);
      list.sort((a, b) => b.due_date.localeCompare(a.due_date));
      const perPage = Number(sp.get("perPage") || 25);
      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const page = Math.min(Number(sp.get("page") || 1), totalPages);
      return {
        status: 200,
        json: {
          charges: list.slice((page - 1) * perPage, page * perPage).map((c) => ({ ...c, client_name: clientName(db, c.client_id) })),
          summary: chargeSummary(db),
          total,
          totalPages,
        },
      };
    }
    if (method === "POST") {
      db.charges.push({
        id: genId("chg"), client_id: body.client_id || null, sale_id: body.sale_id || null,
        amount_cents: Number(body.amount_cents || 0), due_date: body.due_date || today(),
        payment_method: body.payment_method || null, notes: body.notes || null,
        status: "Pendente", created_at: new Date().toISOString(),
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const chgItem = pathname.match(/^\/api\/crm\/charges\/([^/]+)$/);
  if (chgItem) {
    const chg = db.charges.find((c) => c.id === chgItem[1]);
    if (chg && method === "PUT") {
      if (body.status) chg.status = body.status;
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (chg && method === "DELETE") {
      db.charges = db.charges.filter((c) => c.id !== chgItem[1]);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  // ---------- tasks ----------
  if (pathname === "/api/crm/tasks") {
    if (method === "GET") {
      let list = [...db.tasks];
      const st = sp.get("status");
      if (st) list = list.filter((t) => t.status === st);
      const cid = sp.get("clientId");
      if (cid) list = list.filter((t) => t.client_id === cid);
      list.sort((a, b) => a.due_date.localeCompare(b.due_date));
      return { status: 200, json: { tasks: list.map((t) => ({ ...t, client_name: clientName(db, t.client_id) })) } };
    }
    if (method === "POST") {
      db.tasks.push({
        id: genId("task"), title: body.title, client_id: body.client_id || null,
        due_date: body.due_date || today(), due_time: body.due_time || null,
        category: body.category || null, notes: body.notes || null,
        priority: body.priority || "Média", status: body.status || "A fazer",
        created_at: new Date().toISOString(),
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const taskItem = pathname.match(/^\/api\/crm\/tasks\/([^/]+)$/);
  if (taskItem) {
    const task = db.tasks.find((t) => t.id === taskItem[1]);
    if (task && method === "PUT") {
      Object.assign(task, {
        title: body.title ?? task.title,
        client_id: body.client_id !== undefined ? body.client_id || null : task.client_id,
        due_date: body.due_date ?? task.due_date,
        due_time: body.due_time !== undefined ? body.due_time : task.due_time,
        priority: body.priority ?? task.priority,
        category: body.category !== undefined ? body.category : task.category,
        notes: body.notes !== undefined ? body.notes : task.notes,
        status: body.status ?? task.status,
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (task && method === "DELETE") {
      db.tasks = db.tasks.filter((t) => t.id !== taskItem[1]);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  // ---------- financial ----------
  function finSummary(data: DemoCrmData) {
    const income = data.financial.filter((f) => f.type === "income").reduce((a, f) => a + f.amount_cents, 0);
    const expense = data.financial.filter((f) => f.type === "expense").reduce((a, f) => a + f.amount_cents, 0);
    return { income, expense, result: income - expense };
  }

  if (pathname === "/api/crm/financial") {
    if (method === "GET") {
      let list = [...db.financial];
      const type = sp.get("type");
      if (type) list = list.filter((f) => f.type === type);
      const from = sp.get("from");
      if (from) list = list.filter((f) => f.entry_date >= from);
      const to = sp.get("to");
      if (to) list = list.filter((f) => f.entry_date <= to);
      list.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      const perPage = Number(sp.get("perPage") || 25);
      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const page = Math.min(Number(sp.get("page") || 1), totalPages);
      return {
        status: 200,
        json: {
          entries: list.slice((page - 1) * perPage, page * perPage).map((f) => ({ ...f, client_name: clientName(db, f.client_id) })),
          summary: finSummary(db),
          total,
          totalPages,
        },
      };
    }
    if (method === "POST") {
      db.financial.push(mkEntry(body));
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const finItem = pathname.match(/^\/api\/crm\/financial\/([^/]+)$/);
  if (finItem) {
    const idx = db.financial.findIndex((f) => f.id === finItem[1]);
    if (idx >= 0 && method === "PUT") {
      db.financial[idx] = { ...db.financial[idx], ...mkEntry(body, db.financial[idx]) };
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (idx >= 0 && method === "DELETE") {
      db.financial.splice(idx, 1);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  // ---------- loyalty ----------
  if (pathname === "/api/crm/loyalty") {
    if (method === "GET") {
      recomputeAggregates(db);
      const levels = [...db.loyalty.levels].sort((a, b) => a.min_points - b.min_points);
      const levelOf = (pts: number) => {
        let name = levels[0]?.name || "Bronze";
        for (const l of levels) if (pts >= l.min_points) name = l.name;
        return name;
      };
      return {
        status: 200,
        json: {
          settings: db.loyalty,
          clients: db.clients.map((c) => ({
            id: c.id, name: c.name, category: c.category, is_vip: c.is_vip,
            points: c.points_balance, level: levelOf(c.points_balance),
          })),
        },
      };
    }
    if (method === "PUT") {
      Object.assign(db.loyalty, {
        program_name: body.program_name ?? db.loyalty.program_name,
        points_per_purchase_cents: Number(body.points_per_purchase_cents ?? db.loyalty.points_per_purchase_cents),
        points_per_referral: Number(body.points_per_referral ?? db.loyalty.points_per_referral),
        points_per_birthday: Number(body.points_per_birthday ?? db.loyalty.points_per_birthday),
        points_per_special: Number(body.points_per_special ?? db.loyalty.points_per_special),
        enabled: typeof body.enabled === "boolean" ? body.enabled : db.loyalty.enabled,
        rules: body.rules ?? db.loyalty.rules,
        benefits: body.benefits ?? db.loyalty.benefits,
        rewards: body.rewards ?? db.loyalty.rewards,
        levels: body.levels ?? db.loyalty.levels,
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  if (pathname === "/api/crm/loyalty/points" && method === "POST") {
    db.points.push({
      id: genId("pt"), client_id: body.client_id, amount: Number(body.amount || 0),
      type: body.type || "ajuste", description: body.description || null,
      created_at: new Date().toISOString(),
    });
    recomputeAggregates(db);
    saveDemoCrm(db);
    return { status: 200, json: {} };
  }

  // ---------- settings / automations / messages / whatsapp ----------
  if (pathname === "/api/crm/settings") {
    if (method === "GET") return { status: 200, json: { settings: db.settings } };
    if (method === "PUT") {
      if (body.modules) db.settings.modules = { ...db.settings.modules, ...body.modules };
      if (body.categories) db.settings.categories = body.categories;
      if (body.financial_categories) db.settings.financial_categories = body.financial_categories;
      if (body.vip_rules) db.settings.vip_rules = { ...db.settings.vip_rules, ...body.vip_rules };
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  if (pathname === "/api/crm/automations") {
    if (method === "GET") return { status: 200, json: { automations: db.automations } };
    if (method === "POST") {
      db.automations.push({
        id: genId("auto"), type: body.type, enabled: Boolean(body.enabled),
        days: Number(body.days || 0), schedule_time: body.schedule_time || null,
        message: body.message || null,
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const autoItem = pathname.match(/^\/api\/crm\/automations\/([^/]+)$/);
  if (autoItem) {
    const auto = db.automations.find((a) => a.id === autoItem[1]);
    if (auto && method === "PUT") {
      Object.assign(auto, {
        type: body.type ?? auto.type,
        enabled: typeof body.enabled === "boolean" ? body.enabled : auto.enabled,
        days: body.days !== undefined ? Number(body.days) : auto.days,
        schedule_time: body.schedule_time !== undefined ? body.schedule_time : auto.schedule_time,
        message: body.message !== undefined ? body.message : auto.message,
      });
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (auto && method === "DELETE") {
      db.automations = db.automations.filter((a) => a.id !== autoItem[1]);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  if (pathname === "/api/crm/messages") {
    if (method === "GET") return { status: 200, json: { messages: db.messages } };
    if (method === "POST") {
      if (body.id) {
        const m = db.messages.find((x) => x.id === body.id);
        if (m) { m.code = body.code; m.label = body.label; m.message = body.message; }
      } else {
        db.messages.push({ id: genId("msg"), code: body.code, label: body.label, message: body.message });
      }
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  const msgItem = pathname.match(/^\/api\/crm\/messages\/([^/]+)$/);
  if (msgItem && method === "DELETE") {
    db.messages = db.messages.filter((m) => m.id !== msgItem[1]);
    saveDemoCrm(db);
    return { status: 200, json: {} };
  }

  if (pathname === "/api/crm/whatsapp") {
    if (method === "GET") return { status: 200, json: { config: db.whatsappConfig } };
    if (method === "PUT") {
      db.whatsappConfig = {
        ...db.whatsappConfig,
        enabled: Boolean(body.enabled),
        provider: body.provider ?? db.whatsappConfig.provider,
        api_url: body.api_url ?? "",
        phone_id: body.phone_id ?? "",
        webhook_url: body.webhook_url ?? "",
        has_token: Boolean(body.access_token),
        key_hint: body.access_token ? "••••" + String(body.access_token).slice(-4) : db.whatsappConfig.key_hint,
        connection_status: body.enabled ? "configurado (demo)" : "desconectado",
      };
      saveDemoCrm(db);
      return { status: 200, json: { config: db.whatsappConfig } };
    }
  }

  if (pathname === "/api/crm/whatsapp/send" && method === "POST") {
    return { status: 200, json: {} };
  }

  // ---------- export ----------
  if (pathname === "/api/crm/export" && method === "POST") {
    recomputeAggregates(db);
    return {
      status: 200,
      json: {
        bundle: {
          exported_at: new Date().toISOString(),
          consultant_name: "Carla Oliveira",
          site_name: "demonstracao",
          currency: "BRL",
          clients: db.clients,
          products: db.products,
          sales: db.sales.map((s) => ({ ...s, client_name: clientName(db, s.client_id) })),
          financial: db.financial.map((f) => ({ ...f, client_name: clientName(db, f.client_id) })),
          charges: db.charges.map((c) => ({ ...c, client_name: clientName(db, c.client_id) })),
          tasks: db.tasks.map((t) => ({ ...t, client_name: clientName(db, t.client_id) })),
          loyaltyPoints: db.points.map((p) => ({ ...p, client_name: clientName(db, p.client_id) })),
        },
      },
    };
  }

  return null;
}

function mkEntry(body: any, prev?: DemoCrmFinancialEntry): DemoCrmFinancialEntry {
  return {
    id: prev?.id || genId("fin"),
    type: body.type ?? prev?.type ?? "income",
    entry_date: body.entry_date ?? prev?.entry_date ?? today(),
    amount_cents: body.amount_cents !== undefined ? Number(body.amount_cents) : prev?.amount_cents ?? 0,
    category: body.category ?? prev?.category ?? "Outros",
    description: body.description ?? prev?.description ?? null,
    client_id: body.client_id !== undefined ? body.client_id || null : prev?.client_id ?? null,
    payment_method: body.payment_method !== undefined ? body.payment_method : prev?.payment_method ?? null,
    notes: body.notes !== undefined ? body.notes : prev?.notes ?? null,
    created_at: prev?.created_at || new Date().toISOString(),
  };
}

function daysFromNowIso(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

// ------------------------------------------------------------- SITE ----

async function handleSite(pathname: string, sp: URLSearchParams, method: string, body: any): Promise<DemoApiResult | null> {
  if (pathname.startsWith("/api/crm")) return null;

  if (pathname === "/api/slug/check" && method === "GET") {
    const slug = sp.get("slug") || "";
    return { status: 200, json: { slug, valid: /^[a-z0-9-]+$/.test(slug), available: true } };
  }

  if (pathname === "/api/slug" && method === "POST") {
    return {
      status: 403,
      json: { error: "🔒 Na demonstração a URL é fixa. Ao adquirir seu site você escolhe seu próprio nome e pode vincular domínio próprio!" },
    };
  }

  if (pathname === "/api/site" && method === "POST") {
    const demo = loadDemoData();
    const site = { ...demo.site } as Record<string, unknown>;
    const map: [string, string][] = [
      ["name", "name"], ["surname", "surname"], ["fullName", "fullName"], ["role", "role"],
      ["eyebrow", "eyebrow"], ["description", "description"], ["badgeTitle", "badgeTitle"],
      ["badgeSubtitle", "badgeSubtitle"], ["whatsapp", "whatsapp"], ["email", "email"],
      ["instagram", "instagram"], ["instagramHandle", "instagramHandle"], ["logoMode", "logoMode"],
      ["logoUrl", "logoUrl"], ["logoLightUrl", "logoLightUrl"], ["logoText", "logoText"], ["faviconUrl", "faviconUrl"],
    ];
    for (const [from, to] of map) {
      if (body[from] !== undefined && body[from] !== null) site[to] = String(body[from]);
    }
    if (body.stats && typeof body.stats === "object") {
      site.stats = {
        years: String(body.stats.years ?? ""),
        clients: String(body.stats.clients ?? ""),
        satisfaction: String(body.stats.satisfaction ?? ""),
      };
    }
    if (body.social && typeof body.social === "object") {
      site.social = body.social;
    }
    demo.site = site as unknown as typeof demo.site;
    saveDemoData(demo);
    return { status: 200, json: { success: true } };
  }

  if (pathname === "/api/sections") {
    const demo = loadDemoData();
    const types: SectionType[] = ["header", ...DEMO_SECTION_TYPES, "footer"];

    if (method === "GET") {
      const sections = types.map((type, ix) => {
        const base = JSON.parse(JSON.stringify(DEFAULT_SECTION_CONTENT[type]));
        const saved = demo.sections[type];
        let enabled = true;
        let content = base;
        let hasOverride = false;
        if (saved) {
          enabled = saved.enabled;
          hasOverride = JSON.stringify(saved.content) !== JSON.stringify(DEFAULT_SECTION_CONTENT[type]);
          const cleaned: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(saved.content || {})) if (v !== null) cleaned[k] = v;
          content = { ...base, ...cleaned };
        }
        if (type === "hero") {
          content = {
            ...content,
            firstName: demo.site.name || (content.firstName as string),
            lastName: demo.site.surname || (content.lastName as string),
            role: demo.site.role || (content.role as string),
            eyebrow: demo.site.eyebrow || (content.eyebrow as string),
            description: demo.site.description || (content.description as string),
            badgeTitle: demo.site.badgeTitle || (content.badgeTitle as string),
            badgeSubtitle: demo.site.badgeSubtitle || (content.badgeSubtitle as string),
            stats: [
              { value: demo.site.stats.years, label: "Anos de experiência" },
              { value: demo.site.stats.clients, label: "Clientes atendidas" },
              { value: demo.site.stats.satisfaction, label: "Satisfação" },
            ].filter((s) => Boolean(s.value)),
          };
        }
        if (type === "header") content = { logoText: demo.site.logoText };
        if (type === "footer") {
          content = {
            aboutText: `${demo.site.fullName} — ${demo.site.role}.`,
            social: demo.site.social,
            showPlatformCredit: true,
          };
        }
        const showInNav = NAV_TYPES.includes(type);
        return {
          id: `sec-${type}`,
          key: type,
          type,
          label: SECTION_TYPE_LABELS[type],
          anchor: anchorFor(type),
          navLabel: showInNav ? NAV_LABELS[type] : undefined,
          is_required: !["trustbar", "pricing"].includes(type),
          enabled,
          has_override: hasOverride,
          tenant_content: saved?.content || {},
          content,
          permissions: {
            can_edit: true, can_toggle: true, can_edit_image: true, can_edit_video: true,
            can_edit_button: true, can_edit_colors: true, can_edit_layout: true, available_to_all: true,
          },
          can_toggle: true,
          can_edit: true,
          settings: showInNav ? { showInNav: true } : { showInNav: false },
          sort_order: (ix + 1) * 10,
        };
      });
      return {
        status: 200,
        json: {
          sections,
          tenant: { id: "demo-tenant", slug: "demonstracao", site_status: "active" },
          isSuperAdmin: false,
        },
      };
    }

    if (method === "POST") {
      if (body.action === "toggle") {
        const sectionType = String(body.sectionId || "").replace("sec-", "");
        if (demo.sections[sectionType]) {
          demo.sections[sectionType].enabled = Boolean(body.enabled);
          saveDemoData(demo);
        }
        return { status: 200, json: {} };
      }
      if (body.action === "save") {
        const sectionType = String(body.sectionId || "").replace("sec-", "");
        if (demo.sections[sectionType]) {
          demo.sections[sectionType].content = body.content || {};
          saveDemoData(demo);
        }
        return { status: 200, json: {} };
      }
    }
  }

  // ---------- domains ----------
  const crm = () => loadDemoCrm();

  if (pathname === "/api/domains") {
    if (method === "GET") {
      return { status: 200, json: { domains: crm().domains } };
    }
    if (method === "POST") {
      const domain = String(body.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!domain || !domain.includes(".")) return { status: 400, json: { error: "Domínio inválido." } };
      const db2 = crm();
      if (db2.domains.some((d) => d.domain === domain)) return { status: 409, json: { error: "Domínio já vinculado." } };
      db2.domains.push({ id: genId("dom"), domain, status: "pending", created_at: new Date().toISOString() });
      saveDemoCrm(db2);
      return {
        status: 200,
        json: {
          instructions: {
            explanation: "Adicione os registros abaixo no painel do seu provedor de DNS (em demonstração isso é simulado).",
            records: [
              { type: "A", host: "@", value: "76.76.21.21", ttl: "3600" },
              { type: "CNAME", host: "www", value: "cname.vercel-dns.com", ttl: "3600" },
            ],
          },
        },
      };
    }
  }

  const domVerify = pathname.match(/^\/api\/domains\/([^/]+)\/verify$/);
  if (domVerify && method === "POST") {
    const db2 = crm();
    const dom = db2.domains.find((d) => d.id === domVerify[1]);
    if (!dom) return { status: 404, json: { error: "Domínio não encontrado." } };
    dom.status = "active";
    saveDemoCrm(db2);
    return { status: 200, json: { verified: true, message: "DNS verificado com sucesso (simulação da demonstração)." } };
  }

  const domItem = pathname.match(/^\/api\/domains\/([^/]+)$/);
  if (domItem && method === "DELETE") {
    const db2 = crm();
    db2.domains = db2.domains.filter((d) => d.id !== domItem[1]);
    saveDemoCrm(db2);
    return { status: 200, json: {} };
  }

  return null;
}

// ------------------------------------------------------------ MÍDIA ----

function handleMedia(pathname: string, sp: URLSearchParams, method: string, body: any): DemoApiResult | null {
  if (!pathname.startsWith("/api/media")) return null;
  const db = loadDemoCrm();

  if (pathname === "/api/media/stats" && method === "GET") {
    const totalBytes = db.media.reduce((a, m) => a + m.file_size, 0);
    return { status: 200, json: { totalBytes, totalFiles: db.media.length, quotaBytes: 50 * 1024 * 1024 } };
  }

  if (pathname === "/api/media/presign" && method === "POST") {
    const id = genId("media");
    return {
      status: 200,
      json: {
        id,
        storageKey: `demo/${id}`,
        uploadUrl: `demo-upload://${id}`,
        publicUrl: "",
        category: body.category || "outros",
        limitMb: 50,
      },
    };
  }

  if (pathname === "/api/media/upload" && method === "POST") {
    const file = body.file;
    if (!file) return { status: 400, json: { error: "Arquivo ausente." } };
    const media: DemoMediaFile = {
      id: genId("media"),
      public_url: file.dataUrl,
      original_name: file.name,
      mime_type: file.type || "image/*",
      file_size: Number(file.size || 0),
      category: body.category || "outros",
      status: "uploaded",
      created_at: new Date().toISOString(),
    };
    db.media.unshift(media);
    saveDemoCrm(db);
    return { status: 200, json: { media } };
  }

  if (pathname === "/api/media/complete" && method === "POST") {
    const media = db.media.find((m) => m.id === body.id);
    if (!media) return { status: 404, json: { error: "Mídia não encontrada." } };
    return { status: 200, json: { media } };
  }

  if (pathname === "/api/media" && method === "GET") {
    let list = [...db.media];
    const category = sp.get("category");
    if (category) list = list.filter((m) => m.category === category);
    const q = (sp.get("q") || "").toLowerCase();
    if (q) list = list.filter((m) => m.original_name.toLowerCase().includes(q));
    if (sp.get("sort") === "oldest") list.reverse();
    return { status: 200, json: { items: list } };
  }

  const mediaItem = pathname.match(/^\/api\/media\/([^/]+)$/);
  if (mediaItem && method === "DELETE") {
    db.media = db.media.filter((m) => m.id !== mediaItem[1]);
    saveDemoCrm(db);
    return { status: 200, json: {} };
  }

  return null;
}

// ---------------------------------------------------------------- IA ----

function demoGenerateText(payload: Record<string, any>): string {
  const toolCode = payload.tool || payload.kind || "";
  const fields = payload.fields || {};
  const subject =
    fields.product || fields.topic || fields.theme || fields.subject ||
    fields.title || fields.about || fields.prompt || "óleos essenciais doTERRA";
  const tone = fields.tone || "acolhedor";

  const byTool: Record<string, string> = {
    title: `🌿 5 opções de título sobre ${subject}:\n\n1. ${subject}: o segredo natural que faltava na sua rotina\n2. Descubra o poder de ${subject}\n3. ${subject} — bem-estar que você sente\n4. Transforme sua rotina com ${subject}\n5. O guia simples para começar com ${subject}`,
    description: `✨ ${subject}\n\nCuide de você com o que a natureza tem de melhor.\n\n💚 Benefícios na sua rotina diária\n🌿 Fácil de usar\n🤝 Acompanhamento próximo\n\n👉 Chame no WhatsApp e saiba mais!\n\n#doterra #oleosessenciais #bemestar`,
    post: `🌿 Post pronto para publicar\n\nVocê sabia que pequenos rituais transformam o dia?\n\n${subject} pode fazer parte da sua rotina de bem-estar de forma simples e prazerosa.\n\n💬 Me conta nos comentários: qual seu momento favorito do dia?\n👉 Chama no WhatsApp pra eu te indicar o ideal pra você!\n\n#doterra #oleosessenciais #bemestar #autocuidado`,
    product: `🛍️ ${subject}\n\nUm essencial na sua casa:\n\n• Aroma marcante e envolvente\n• Perfeito para a rotina da família\n• Qualidade certificada CPTG®\n\n💰 Investimento que cabe no seu bolso\n📲 Chame no WhatsApp para garantir o seu!\n\n#${String(subject).toLowerCase().replace(/\s+/g, "")} #doterra #oleosessenciais`,
    ad: `📢 Anúncio — versão A (curta)\n\nDescubra ${subject} e transforme sua rotina. Toque e saiba mais!\n\n📢 Versão B (completa)\n\nVocê busca mais bem-estar no dia a dia? ${subject} pode ser exatamente o que faltava. Chame no WhatsApp e receba uma recomendação personalizada — sem compromisso! 💚`,
    ideas: `💡 Ideias de conteúdo sobre ${subject}\n\nEDUCATIVO\n1. Como diluir corretamente (carrossel)\n2. 3 formas de uso no dia a dia (Reels)\n\nCOMERCIAL\n3. Bastidores da reposição de estoque (Stories)\n4. Depoimento de cliente (post)\n\nENGAJAMENTO\n5. Enquete: qual aroma combina com seu humor hoje?\n6. Caixinha de perguntas sobre rotinas`,
    calendar: `📅 Calendário de 7 dias — ${subject}\n\nDia 1: Reels educativo — o que é e como começar\nDia 2: Story enquete — qual aroma combina com você?\nDia 3: Carrossel — 3 formas de usar\nDia 4: Post depoimento de cliente\nDia 5: Stories bastidores do estoque\nDia 6: Live curta ou Reels — rotina noturna\nDia 7: Post comercial com CTA WhatsApp`,
    faq: `❓ FAQ sobre ${subject}\n\nP: Como começo de forma simples?\nR: Comece com um óleo versátil e use em uma única rotina (ex.: difusor à noite).\n\nP: É seguro para toda a família?\nR: Usado conforme as orientações, sim. Sempre siga as instruções de diluição.\n\nP: Como compro?\nR: Pelo WhatsApp eu faço o pedido junto com você — rápido e sem complicação!`,
    "client-reply": `💚 Resposta sugerida\n\nOi, tudo bem? Que bom seu interesse em ${subject}!\n\nPosso te explicar com calma e indicar o que faz sentido para o seu momento. Quando puder, me chame por aqui que eu te acompanho nessa escolha. 🌿`,
  };

  if (byTool[toolCode]) return byTool[toolCode];

  return `✨ Sugestão criada sobre ${subject} (tom ${tone}):\n\nOs óleos essenciais podem fazer parte da sua rotina de bem-estar de diferentes formas. Experimente incluir ${subject} em um momento do seu dia — pode ser pela manhã para energia ou à noite para relaxar.\n\n👉 Chame no WhatsApp para receber uma recomendação personalizada.\n\n#doterra #bemestar`;
}

function handleAi(pathname: string, method: string, body: any): DemoApiResult | null {
  if (!pathname.startsWith("/api/ai/") && pathname !== "/api/ia/chat") return null;
  const db = loadDemoCrm();

  if (pathname === "/api/ai/catalog" && method === "GET") {
    const tools = DEMO_AI_TOOLS.map((t) => {
      const schema = TOOL_SCHEMAS.find((s) => s.code === t.code);
      return { ...t, fields: schema?.fields || [], generates_content: schema?.generatesContent ?? true };
    });
    return {
      status: 200,
      json: {
        tools,
        templates: DEMO_AI_TEMPLATES,
        history: db.aiHistory,
        userTemplates: db.aiUserTemplates,
        favorites: db.aiFavorites,
        settings: { provider_id: null, has_key: false, key_hint: null },
        providers: DEMO_AI_PROVIDERS,
      },
    };
  }

  if (pathname === "/api/ai/favorites" && method === "POST") {
    const code = body.tool_code;
    if (body.favorite) {
      if (!db.aiFavorites.includes(code)) db.aiFavorites.push(code);
    } else {
      db.aiFavorites = db.aiFavorites.filter((c) => c !== code);
    }
    saveDemoCrm(db);
    return { status: 200, json: { favorites: db.aiFavorites } };
  }

  if (pathname === "/api/ai/generate" && method === "POST") {
    const text = demoGenerateText(body);
    const toolCode = body.tool || body.kind || null;
    const item = {
      id: genId("aih"),
      tool_code: toolCode,
      tool_name: toolCode,
      content: text,
      favorite: false,
      created_at: new Date().toISOString(),
    };
    db.aiHistory.unshift(item);
    if (db.aiHistory.length > 50) db.aiHistory.pop();
    saveDemoCrm(db);
    return { status: 200, json: { text, history_id: item.id } };
  }

  const histItem = pathname.match(/^\/api\/ai\/history\/([^/]+)$/);
  if (histItem) {
    const h = db.aiHistory.find((x) => x.id === histItem[1]);
    if (h && method === "PATCH") {
      h.favorite = Boolean(body.favorite);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
    if (h && method === "DELETE") {
      db.aiHistory = db.aiHistory.filter((x) => x.id !== histItem[1]);
      saveDemoCrm(db);
      return { status: 200, json: {} };
    }
  }

  if (pathname === "/api/ai/settings") {
    if (method === "GET") {
      return { status: 200, json: { settings: { provider_id: null, has_key: false, key_hint: null }, providers: DEMO_AI_PROVIDERS } };
    }
    if (method === "POST") {
      return { status: 200, json: {} };
    }
  }

  if (pathname === "/api/ai/test" && method === "POST") {
    return { status: 200, json: { ok: true, message: "Demonstração: provedor simulado com sucesso (nenhuma chave é enviada)." } };
  }

  if (pathname === "/api/ai/user-templates" && method === "POST") {
    const tpl = {
      id: genId("aut"),
      template_code: body.template_code,
      name: body.name,
      data: body.data || {},
      created_at: new Date().toISOString(),
    };
    db.aiUserTemplates.unshift(tpl);
    saveDemoCrm(db);
    return { status: 200, json: { template: tpl } };
  }

  const userTpl = pathname.match(/^\/api\/ai\/user-templates\/([^/]+)$/);
  if (userTpl && method === "DELETE") {
    db.aiUserTemplates = db.aiUserTemplates.filter((t) => t.id !== userTpl[1]);
    saveDemoCrm(db);
    return { status: 200, json: {} };
  }

  // Chat da IA pública (site /demonstracao)
  if (pathname === "/api/ia/chat" && method === "POST") {
    const message = String(body.message || "");
    const knowledge = loadDemoCrm().knowledge;
    // Resposta simulada acolhedora com sugestão de óleos por tema
    const lower = message.toLowerCase();
    const table: [RegExp, string, string[]][] = [
      [/sono|dormir|ins[oô]nia/i, "Lavender é uma ótima aliada para a rotina da noite. Experimente difundir algumas gotas antes de dormir.", ["Lavender", "Frankincense"]],
      [/ansiedade|ansios|calma|estress/i, "Para momentos de agitação, Lavender e Frankincense ajudam a trazer sensação de calma no dia a dia.", ["Lavender", "Frankincense"]],
      [/imunidade|gripe|resfri/i, "On Guard é o blend protetor mais querido da casa — ótimo para a rotina da família em qualquer estação.", ["On Guard"]],
      [/energia|foco|concentra/i, "Peppermint e Lemon são clássicos para dar aquele ânimo e clareza mental durante o dia.", ["Peppermint", "Lemon"]],
      [/digest[ií]/i, "DigestZen auxilia no conforto digestivo quando aplicado topicamente com movimentos circulares.", ["DigestZen"]],
      [/dor|muscul/i, "Deep Relief traz sensação refrescante e aliviante para pontos de tensão muscular.", ["Deep Relief", "Peppermint"]],
    ];
    for (const [re, text, oils] of table) {
      if (re.test(lower)) return { status: 200, json: { text, oils, matched: true, redirectWhatsApp: false } };
    }
    const trained = knowledge.find((k) => k.keywords.split(",").some((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase())));
    if (trained) return { status: 200, json: { text: trained.text, oils: trained.oils, matched: true, redirectWhatsApp: false } };
    return {
      status: 200,
      json: {
        text: "Ótima pergunta! Posso te ajudar melhor com uma conversa rápida — clique abaixo para falar com a consultora 💚",
        oils: [],
        matched: false,
        redirectWhatsApp: true,
      },
    };
  }

  return null;
}

function handleIaTraining(pathname: string, method: string, body: any): DemoApiResult | null {
  if (pathname !== "/api/ia/training") return null;
  const db = loadDemoCrm();
  if (method === "GET") {
    return { status: 200, json: { knowledge: db.knowledge, sectionId: null, can_edit: true } };
  }
  if (method === "POST") {
    const knowledge = (Array.isArray(body.knowledge) ? body.knowledge : []).filter(
      (k: any) => k && typeof k.text === "string" && k.text.trim()
    );
    db.knowledge = knowledge;
    saveDemoCrm(db);
    return { status: 200, json: { success: true, knowledge } };
  }
  return null;
}

function handleBilling(pathname: string): DemoApiResult | null {
  if (
    ["/api/checkout", "/api/checkout/mp", "/api/billing-portal", "/api/cancel-subscription", "/api/reactivate-subscription"].includes(pathname)
  ) {
    return {
      status: 403,
      json: {
        error:
          "🔒 Demonstração: ações de pagamento estão desativadas aqui. Ao adquirir seu SITE DOTERRA, esta tela controla ativação, mensalidade e histórico reais.",
      },
    };
  }
  return null;
}

// ------------------------------------------------------------- MAIN ----

export async function handleDemoApi(
  pathname: string,
  searchParams: URLSearchParams,
  method: string,
  body: any
): Promise<DemoApiResult> {
  try {
    return (
      handleCrm(pathname, searchParams, method, body) ||
      (await handleSite(pathname, searchParams, method, body)) ||
      handleMedia(pathname, searchParams, method, body) ||
      handleAi(pathname, method, body) ||
      handleIaTraining(pathname, method, body) ||
      handleBilling(pathname) || { status: 404, json: { error: "Não encontrado (demonstração)." } }
    );
  } catch (e) {
    return { status: 500, json: { error: e instanceof Error ? e.message : "Erro interno da demonstração." } };
  }
}
