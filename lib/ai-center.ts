import { createAdminClient } from "@/lib/supabase/admin";
import type { AiTool, AiTemplate, AiHistoryItem, AiUserTemplate } from "@/types";
import { TOOL_SCHEMAS } from "@/lib/ai-tools";

/**
 * Camada de acesso a dados da Central de IA. Todo dado é isolado por
 * user_id/tenant_id — um usuário nunca acessa conteúdo de outro.
 */

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Junta as ferramentas do banco com os esquemas de campos do código. */
export async function getAiTools(all = false): Promise<AiTool[]> {
  if (!hasSupabaseEnv()) return [];
  const admin = createAdminClient();
  let query = admin.from("ai_tools").select("*").order("sort_order", { ascending: true });
  if (!all) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as AiTool[]).map((t) => {
    const schema = TOOL_SCHEMAS.find((s) => s.code === t.code);
    return {
      ...t,
      fields: schema?.fields || [],
      generates_content: schema?.generatesContent ?? true,
    };
  });
}

export async function getAiTemplates(all = false): Promise<AiTemplate[]> {
  if (!hasSupabaseEnv()) return [];
  const admin = createAdminClient();
  let query = admin.from("ai_templates").select("*").order("sort_order", { ascending: true });
  if (!all) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as AiTemplate[];
}

export async function getHistory(userId: string, limit = 50): Promise<AiHistoryItem[]> {
  if (!hasSupabaseEnv()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as AiHistoryItem[];
}

export async function saveHistory(input: {
  user_id: string;
  tenant_id: string | null;
  tool_code: string;
  tool_name: string;
  prompt: string;
  content: string;
  metadata?: Record<string, unknown>;
  favorite?: boolean;
}): Promise<AiHistoryItem | null> {
  if (!hasSupabaseEnv()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_history")
    .insert({
      user_id: input.user_id,
      tenant_id: input.tenant_id,
      tool_code: input.tool_code,
      tool_name: input.tool_name,
      prompt: input.prompt,
      content: input.content,
      metadata: input.metadata || {},
      favorite: input.favorite || false,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return data as unknown as AiHistoryItem;
}

export async function deleteHistory(userId: string, id: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("ai_history").delete().eq("id", id).eq("user_id", userId);
  return !error;
}

export async function toggleHistoryFavorite(userId: string, id: string, favorite: boolean): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("ai_history").update({ favorite }).eq("id", id).eq("user_id", userId);
  return !error;
}

export async function getUserTemplates(userId: string): Promise<AiUserTemplate[]> {
  if (!hasSupabaseEnv()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_user_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as AiUserTemplate[];
}

export async function saveUserTemplate(input: {
  user_id: string;
  tenant_id: string | null;
  template_code: string;
  name: string;
  data: Record<string, unknown>;
}): Promise<AiUserTemplate | null> {
  if (!hasSupabaseEnv()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_user_templates")
    .insert({
      user_id: input.user_id,
      tenant_id: input.tenant_id,
      template_code: input.template_code,
      name: input.name,
      data: input.data,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return data as unknown as AiUserTemplate;
}

export async function deleteUserTemplate(userId: string, id: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("ai_user_templates").delete().eq("id", id).eq("user_id", userId);
  return !error;
}

export async function getFavoriteToolCodes(userId: string): Promise<string[]> {
  if (!hasSupabaseEnv()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_user_favorites")
    .select("tool_code")
    .eq("user_id", userId);
  if (error || !data) return [];
  return (data as unknown as { tool_code: string }[]).map((r) => r.tool_code);
}

export async function toggleToolFavorite(userId: string, toolCode: string, favorite: boolean): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const admin = createAdminClient();
  if (favorite) {
    const { error } = await admin.from("ai_user_favorites").insert({ user_id: userId, tool_code: toolCode });
    return !error;
  }
  const { error } = await admin.from("ai_user_favorites").delete().eq("user_id", userId).eq("tool_code", toolCode);
  return !error;
}

/** Estatísticas de uso para o Super Admin (isoladas por role no servidor). */
export async function getAiUsageStats() {
  if (!hasSupabaseEnv()) return null;
  const admin = createAdminClient();

  const [history, perTool, perUser, total] = await Promise.all([
    admin.from("ai_history").select("id, created_at, tool_code").order("created_at", { ascending: false }).limit(200),
    admin.from("ai_history").select("tool_code, id"),
    admin.from("ai_history").select("user_id, id"),
    admin.from("ai_history").select("id, count"),
  ]);

  const toolCounts: Record<string, number> = {};
  for (const row of (perTool.data || []) as { tool_code: string | null }[]) {
    const key = row.tool_code || "outros";
    toolCounts[key] = (toolCounts[key] || 0) + 1;
  }

  const userCounts: Record<string, number> = {};
  for (const row of (perUser.data || []) as { user_id: string }[]) {
    userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1;
  }

  const now = Date.now();
  const last7d = (history.data || []).filter((r) => now - new Date(r.created_at).getTime() < 7 * 86400000).length;

  return {
    total: (total.data as unknown[] | null)?.length || 0,
    last7d,
    byTool: toolCounts,
    byUser: userCounts,
  };
}
