import { createAdminClient } from "@/lib/supabase/admin";
import type { AffiliateSettings, AffiliateDashboardSummary } from "@/types";

/** Busca configuração global do programa de afiliados (cache 60s) */
let affiliateSettingsCache: { data: AffiliateSettings | null; ts: number } | null = null;

export async function getAffiliateSettings(): Promise<AffiliateSettings | null> {
  if (affiliateSettingsCache && Date.now() - affiliateSettingsCache.ts < 60_000) {
    return affiliateSettingsCache.data;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("affiliate_settings").select("*").limit(1).maybeSingle();
  if (error || !data) return null;
  affiliateSettingsCache = { data: data as AffiliateSettings, ts: Date.now() };
  return data as AffiliateSettings;
}

/** Verifica se o programa está ativo globalmente */
export async function isAffiliateProgramActive(): Promise<boolean> {
  const settings = await getAffiliateSettings();
  return settings?.program_active === true;
}

/** Verifica se um usuário tem o programa ativo */
export async function isUserAffiliateActive(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_status")
    .select("is_active")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.is_active === true;
}

/** Obtém o status do afiliado do usuário (inclui aceite de termos) */
export async function getUserAffiliateStatus(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_status")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Ativa/desativa o programa para o usuário */
export async function setUserAffiliateActive(userId: string, active: boolean, termsVersion?: number) {
  const admin = createAdminClient();
  const updates: Record<string, unknown> = { is_active: active };
  if (active && termsVersion) {
    updates.accepted_terms_at = new Date().toISOString();
    updates.accepted_terms_version = termsVersion;
  }
  const { data, error } = await admin
    .from("affiliate_status")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Obtém resumo do dashboard do afiliado */
export async function getAffiliateDashboardSummary(userId: string): Promise<AffiliateDashboardSummary> {
  const admin = createAdminClient();

  const [clicks, conversions, pendingConversions, paidPayouts] = await Promise.all([
    admin.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_user_id", userId),
    admin
      .from("affiliate_conversions")
      .select("commission_amount", { count: "exact", head: true })
      .eq("affiliate_user_id", userId)
      .eq("status", "aprovado"),
    admin
      .from("affiliate_conversions")
      .select("commission_amount", { count: "exact", head: true })
      .eq("affiliate_user_id", userId)
      .eq("status", "pendente"),
    admin
      .from("affiliate_payouts")
      .select("amount", { count: "exact", head: true })
      .eq("affiliate_user_id", userId)
      .eq("status", "pago"),
  ]);

  const totalApproved = conversions.data?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
  const totalPending = pendingConversions.data?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
  const totalPaid = paidPayouts.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  return {
    total_clicks: clicks.count || 0,
    total_conversions: conversions.count || 0,
    available_balance: totalApproved - totalPaid,
    pending_balance: totalPending,
    total_paid: totalPaid,
  };
}

/** Lista conversões do afiliado */
export async function getAffiliateConversions(userId: string, limit = 50, offset = 0) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_conversions")
    .select(`
      *,
      click:affiliate_clicks (
        visitor_token,
        source_subdomain,
        clicked_at
      ),
      new_customer:profiles!affiliate_conversions_new_customer_user_id_fkey (
        email,
        name
      )
    `)
    .eq("affiliate_user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

/** Lista saques do afiliado */
export async function getAffiliatePayouts(userId: string, limit = 50, offset = 0) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_payouts")
    .select("*")
    .eq("affiliate_user_id", userId)
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

/** Solicita saque */
export async function requestAffiliatePayout(
  userId: string,
  amount: number,
  method: "pix" | "mercado_pago",
  pixKey?: string,
  mercadoPagoInfo?: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_payouts")
    .insert({
      affiliate_user_id: userId,
      amount,
      method,
      pix_key: pixKey || null,
      mercado_pago_account_info: mercadoPagoInfo || null,
      status: "solicitado",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Busca cliques do afiliado */
export async function getAffiliateClicks(userId: string, limit = 50, offset = 0) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_clicks")
    .select("*")
    .eq("affiliate_user_id", userId)
    .order("clicked_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

/** Admin: lista todos os afiliados com resumo */
export async function getAllAffiliatesSummary(limit = 50, offset = 0) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_status")
    .select(`
      *,
      user:profiles!affiliate_status_user_id_fkey (email, name),
      clicks:affiliate_clicks (count),
      conversions:affiliate_conversions!affiliate_conversions_affiliate_user_id_fkey (
        commission_amount,
        status
      )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  return (data || []).map((a: any) => {
    const approved = a.conversions?.filter((c: any) => c.status === "aprovado") || [];
    const pending = a.conversions?.filter((c: any) => c.status === "pendente") || [];
    const totalApproved = approved.reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);
    const totalPending = pending.reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);
    return {
      ...a,
      total_clicks: a.clicks?.[0]?.count || 0,
      total_conversions: a.conversions?.length || 0,
      approved_balance: totalApproved,
      pending_balance: totalPending,
    };
  });
}

/** Admin: lista conversões pendentes */
export async function getPendingConversions(limit = 50, offset = 0) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_conversions")
    .select(`
      *,
      affiliate:profiles!affiliate_conversions_affiliate_user_id_fkey (email, name),
      new_customer:profiles!affiliate_conversions_new_customer_user_id_fkey (email, name),
      click:affiliate_clicks (visitor_token, source_subdomain, clicked_at)
    `)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

/** Admin: aprova/estorna conversão */
export async function updateConversionStatus(conversionId: string, status: "aprovado" | "estornado") {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_conversions")
    .update({ status })
    .eq("id", conversionId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Admin: lista saques pendentes */
export async function getPendingPayouts(limit = 50, offset = 0) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_payouts")
    .select(`
      *,
      affiliate:profiles!affiliate_payouts_affiliate_user_id_fkey (email, name)
    `)
    .eq("status", "solicitado")
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

/** Admin: atualiza status do saque */
export async function updatePayoutStatus(
  payoutId: string,
  status: "em_analise" | "pago" | "rejeitado"
) {
  const admin = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "pago") {
    updates.paid_at = new Date().toISOString();
  }
  const { data, error } = await admin
    .from("affiliate_payouts")
    .update(updates)
    .eq("id", payoutId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Admin: atualiza configurações globais */
export async function updateAffiliateSettings(updates: Partial<AffiliateSettings>) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_settings")
    .update(updates)
    .eq("id", (await admin.from("affiliate_settings").select("id").limit(1).single()).data?.id)
    .select("*")
    .single();
  if (error) throw error;
  affiliateSettingsCache = null; // invalida cache
  return data;
}

/**
 * Registra a conversão de afiliado a partir do visitor_token (cookie
 * `tc_visitor_token`). Usado pelos webhooks de pagamento (Stripe/MP) depois
 * que o pagamento de ativação é confirmado.
 *
 * - Lê a % de comissão ATUAL das configurações (a conversão congela o valor no
 *   snapshot da venda, refletindo a regra vigente no momento do pagamento).
 * - Converte centavos → reais antes de chamar a RPC.
 * - Retorna o `conversion_id` se registrada, `null` se nenhuma atribuição
 *   pendente para o token (visitante chegou sem `?ref=`).
 * - Não quebra o webhook se o programa de afiliados estiver inativo.
 */
export async function registerAffiliateConversionForVisitor(input: {
  visitorToken: string;
  newCustomerUserId: string;
  saleAmountCents: number;
}): Promise<string | null> {
  const settings = await getAffiliateSettings();
  if (!settings?.program_active) return null;

  const admin = createAdminClient();
  const commissionPercent = Number(settings.commission_percent) || 0;
  const saleAmount = (input.saleAmountCents || 0) / 100;

  const { data: conversionId, error } = await admin.rpc("register_affiliate_conversion", {
    p_visitor_token: input.visitorToken,
    p_new_customer_user_id: input.newCustomerUserId,
    p_sale_amount: saleAmount,
    p_commission_percent: commissionPercent,
  });

  if (error) {
    // Não propagamos para não quebrar o webhook de pagamento; o afiliado não
    // recebe comissão mas a venda é concluída normalmente.
    console.error("[affiliate] falha ao registrar conversão", error);
    return null;
  }
  return (conversionId as string | null) || null;
}