import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";
import type { Plan } from "@/types";

/**
 * FONTE CENTRAL DE VERDADE COMERCIAL.
 *
 * Toda informação comercial exibida na HOME, no painel e usada no checkout
 * deve ser resolvida a partir da tabela `plans` (gerenciada pelo Super Admin
 * em /admin/planos). Nenhum preço, mensalidade, desconto ou benefício deve
 * ficar hardcoded no frontend.
 */

export interface OfferView {
  name: string;
  description: string | null;
  activationRegularCents: number;
  activationPriceCents: number;
  monthlyPriceCents: number;
  savingsCents: number;
  promoText: string;
  ctaText: string;
  transparencyText: string;
  cancelText: string;
  allowCancel: boolean;
  trialDays: number;
  billingInterval: string;
  benefits: string[];
  ctaUrl: string;
}

export function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isActivePlan(p: Plan): boolean {
  return p.is_active !== false && p.status !== "inactive";
}

/** Lista as ofertas comerciais ativas, na ordem definida pelo Super Admin. */
export async function getActiveOffers(): Promise<Plan[]> {
  if (!hasSupabaseEnv()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .neq("status", "inactive")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as unknown as Plan[];
}

/** Retorna a oferta principal (primeira oferta ativa) ou null. */
export async function getActiveOffer(): Promise<Plan | null> {
  const offers = await getActiveOffers();
  return offers[0] || null;
}

export async function getPlanById(id: string): Promise<Plan | null> {
  if (!hasSupabaseEnv() || !id) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("plans").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as unknown as Plan;
}

/** Substitui placeholders ({price}, {activation}, {monthly}) por valores formatados. */
export function resolveTemplate(template: string | null | undefined, plan: Plan): string {
  if (!template) return "";
  return template
    .replace(/\{price\}/g, formatBRL(plan.activation_price_cents))
    .replace(/\{activation\}/g, formatBRL(plan.activation_price_cents))
    .replace(/\{monthly\}/g, formatBRL(plan.monthly_price_cents));
}

export function offerBenefits(plan: Plan): string[] {
  const features = plan.features;
  if (Array.isArray(features)) return features.filter((f) => typeof f === "string") as string[];
  return [];
}

/** Economia dinâmica: valor normal − valor promocional (nunca negativo). */
export function computeSavings(plan: Plan): number {
  const normal = plan.activation_regular_price_cents || 0;
  const promo = plan.activation_price_cents || 0;
  return Math.max(0, normal - promo);
}

/** Constrói a visão da oferta (sem expor Price IDs do Stripe ao frontend). */
export function buildOfferView(plan: Plan): OfferView {
  return {
    name: plan.name,
    description: plan.description,
    activationRegularCents: plan.activation_regular_price_cents || 0,
    activationPriceCents: plan.activation_price_cents || 0,
    monthlyPriceCents: plan.monthly_price_cents || 0,
    savingsCents: computeSavings(plan),
    promoText: plan.promo_text || "Oferta especial de lançamento",
    ctaText: resolveTemplate(plan.cta_text, plan),
    transparencyText: resolveTemplate(plan.transparency_text, plan),
    cancelText: plan.cancel_text || "Sem fidelidade. Cancele quando quiser.",
    allowCancel: plan.allow_cancel !== false,
    trialDays: plan.trial_days || 30,
    billingInterval: plan.billing_interval,
    benefits: offerBenefits(plan),
    ctaUrl: "/cadastro",
  };
}

/**
 * Conteúdo final injetado na seção "Planos / Oferta" da HOME.
 * Título, subtítulo e preços vêm da configuração comercial (tabela plans).
 */
export function buildPricingContent(plan: Plan): Record<string, unknown> {
  return {
    title: plan.offer_title || "Tenha um site assim hoje mesmo",
    subtitle: plan.offer_subtitle || "Seu negócio merece uma presença profissional na internet.",
    offer: buildOfferView(plan),
  };
}
