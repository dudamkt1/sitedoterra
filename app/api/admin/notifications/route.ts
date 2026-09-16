import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

export interface AdminNotificationItem {
  id: string;
  kind: "refund" | "feedback" | "new_user";
  title: string;
  detail: string;
  created_at: string;
  href: string;
}

/**
 * GET /api/admin/notifications
 * Central de avisos do Super Admin (badge vermelha da "Visão geral").
 *
 * Retorna TUDO que precisa de atenção do admin vindo de usuários:
 *  - pedidos de reembolso aguardando (`payments.status = refund_pending`);
 *  - mensagens de feedback pendentes (`user_feedback.status = pending`);
 *  - novos cadastros recentes (`profiles` criados nos últimos 7 dias).
 *
 * Apenas super admin. Leitura somente — NÃO altera nada do fluxo de reembolso.
 */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ total: 0, items: [] }, { status: 200 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ total: 0, items: [] }, { status: 200 });
  }

  const admin = createAdminClient();
  const items: AdminNotificationItem[] = [];

  // 1) Pedidos de reembolso aguardando autorização.
  try {
    const { data: refunds } = await admin
      .from("payments")
      .select("id, tenant_id, amount_cents, created_at, metadata")
      .eq("type", "activation")
      .eq("status", "refund_pending")
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = (refunds || []) as any[];
    const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean)));
    const tenantById: Record<string, any> = {};
    const contactByUser: Record<string, { email: string; name: string }> = {};
    if (tenantIds.length > 0) {
      const { data: tRows } = await admin
        .from("tenants")
        .select("id, slug, user_id")
        .in("id", tenantIds);
      for (const t of ((tRows || []) as any[])) tenantById[t.id] = t;
      const userIds = Array.from(
        new Set(Object.values(tenantById).map((t: any) => t.user_id).filter(Boolean))
      ) as string[];
      if (userIds.length > 0) {
        const { data: pRows } = await admin
          .from("profiles")
          .select("user_id, email, name")
          .in("user_id", userIds);
        for (const p of ((pRows || []) as any[])) {
          contactByUser[p.user_id] = { email: p.email || "", name: p.name || "" };
        }
      }
    }

    for (const r of rows) {
      const t = tenantById[r.tenant_id];
      const contact = t ? contactByUser[t.user_id] : undefined;
      const who = contact?.name || contact?.email || (t?.slug ? `/${t.slug}` : "Usuário");
      const amount = ((r.amount_cents || 0) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      items.push({
        id: `refund:${r.id}`,
        kind: "refund",
        title: `Pedido de reembolso — ${who} (${amount})`,
        detail: `Solicitado em ${new Date(r.created_at).toLocaleString("pt-BR")}. Converse no WhatsApp e autorize ou reverta em Visão geral → Pedidos de Reembolso.`,
        created_at: r.created_at,
        href: "/admin",
      });
    }
  } catch (e) {
    console.error("[admin/notifications] refunds error:", (e as Error)?.message);
  }

  // 2) Mensagens de usuários aguardando leitura.
  try {
    const { data: fb } = await admin
      .from("user_feedback")
      .select("id, user_name, user_email, type, message, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    for (const f of ((fb || []) as any[])) {
      const who = f.user_name || f.user_email || "Usuário";
      items.push({
        id: `feedback:${f.id}`,
        kind: "feedback",
        title: `Nova mensagem de ${who}`,
        detail: String(f.message || "").slice(0, 140),
        created_at: f.created_at,
        href: "/admin/feedback",
      });
    }
  } catch (e) {
    console.error("[admin/notifications] feedback error:", (e as Error)?.message);
  }

  // 3) Novos cadastros (últimos 7 dias, até 20).
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, email, name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const p of ((profs || []) as any[])) {
      const who = p.name || p.email || "Novo usuário";
      items.push({
        id: `new_user:${p.user_id}:${p.created_at}`,
        kind: "new_user",
        title: `Novo cadastro — ${who}`,
        detail: `${p.email || ""} · ${new Date(p.created_at).toLocaleString("pt-BR")}`.trim(),
        created_at: p.created_at,
        href: "/admin/usuarios",
      });
    }
  } catch (e) {
    console.error("[admin/notifications] new users error:", (e as Error)?.message);
  }

  items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return NextResponse.json({ total: items.length, items });
}
