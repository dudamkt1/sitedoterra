import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserNotificationItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  href: string;
  read: boolean;
  created_at: string;
}

/**
 * GET   /api/user/notifications   → lista as notificações do usuário logado
 * PATCH /api/user/notifications   → marca como lida (body: { notificationId, read }
 *                                    ou { readAll: true })
 *
 * Somente o próprio usuário (ou superadmin) acessa.
 */
export async function GET(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (!actorProfile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 403 });

  const admin = createAdminClient();
  const url = new URL(request.url);
  const onlyUnread = url.searchParams.get("unread") === "1";

  let query = admin
    .from("user_notifications")
    .select("id, kind, title, detail, href, read, created_at")
    .eq("user_id", actor.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (onlyUnread) query = query.eq("read", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Erro ao carregar notificações." }, { status: 500 });

  const items = ((data || []) as unknown as UserNotificationItem[]).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    detail: n.detail,
    href: n.href || "/painel/conta",
    read: Boolean(n.read),
    created_at: n.created_at,
  }));

  const unreadCount = items.filter((i) => !i.read).length;

  return NextResponse.json({ items, unreadCount, total: items.length });
}

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  if (body.readAll === true) {
    const { error } = await admin
      .from("user_notifications")
      .update({ read: true })
      .eq("user_id", actor.id)
      .eq("read", false);
    if (error) return NextResponse.json({ error: "Erro ao marcar notificações." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const notificationId = String(body.notificationId || "").trim();
  const read = Boolean(body.read);
  if (!notificationId) {
    return NextResponse.json({ error: "Notificação não informada." }, { status: 400 });
  }

  const { error } = await admin
    .from("user_notifications")
    .update({ read })
    .eq("id", notificationId)
    .eq("user_id", actor.id);
  if (error) return NextResponse.json({ error: "Erro ao marcar notificação." }, { status: 500 });

  return NextResponse.json({ success: true });
}
