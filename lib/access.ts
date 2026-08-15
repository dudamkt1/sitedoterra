import type { AccountStatus, SiteStatus, SubscriptionStatus } from "@/types";

export interface AccessInput {
  accountStatus: AccountStatus;
  siteStatus: SiteStatus;
  subscriptionStatus: SubscriptionStatus;
  blocked: boolean;
  /** false = usuário isento de mensalidade: site fica público sem assinatura ativa. */
  billingEnabled: boolean;
}

export type SiteAccess = "available" | "suspended";

/**
 * REGRA CENTRAL DE ACESSO PÚBLICO.
 *
 * PUBLIC_SITE = AVAILABLE quando:
 *   - conta ativa, site ativo e não bloqueado; E
 *   - billing habilitado → exige subscription.status === 'active';
 *   - billing desabilitado (isenção) → não exige assinatura.
 *
 * Esta é a ÚNICA fonte de verdade. Não espalhar esta lógica em componentes.
 */
export function getSiteAccess(input: AccessInput): SiteAccess {
  const baseOk =
    input.accountStatus === "active" &&
    input.siteStatus === "active" &&
    !input.blocked;
  if (!baseOk) return "suspended";
  if (input.billingEnabled && input.subscriptionStatus !== "active") return "suspended";
  return "available";
}

export function isSitePublic(
  accountStatus: AccountStatus,
  siteStatus: SiteStatus,
  subscriptionStatus: SubscriptionStatus,
  blocked: boolean,
  billingEnabled = true
): boolean {
  return getSiteAccess({ accountStatus, siteStatus, subscriptionStatus, blocked, billingEnabled }) === "available";
}

export interface AccessDetail {
  access: SiteAccess;
  reasons: string[];
}

/**
 * Versão com explicação amigável (usada no painel e na página de suspensão).
 */
export function explainSiteAccess(input: AccessInput): AccessDetail {
  const reasons: string[] = [];

  if (input.blocked) {
    reasons.push("Sua conta foi bloqueada pela administração da plataforma.");
  }
  if (input.accountStatus === "pending_activation") {
    reasons.push("Sua conta ainda está aguardando a ativação.");
  }
  if (input.accountStatus === "cancelled") {
    reasons.push("Sua assinatura foi cancelada.");
  }
  if (input.accountStatus === "suspended") {
    reasons.push("Sua conta está suspensa.");
  }
  if (input.billingEnabled && input.subscriptionStatus === "awaiting_activation") {
    reasons.push("Sua assinatura ainda não foi ativada.");
  }
  if (input.billingEnabled && (input.subscriptionStatus === "past_due" || input.subscriptionStatus === "unpaid")) {
    reasons.push("Há um pagamento pendente. Por favor, atualize seus dados de pagamento.");
  }
  if (input.billingEnabled && (input.subscriptionStatus === "canceled" || input.subscriptionStatus === "paused")) {
    reasons.push("Sua assinatura está cancelada.");
  }
  if (input.billingEnabled && (input.subscriptionStatus === "incomplete" || input.subscriptionStatus === "trialing")) {
    reasons.push("Sua assinatura está em processo de ativação.");
  }
  if (input.siteStatus === "pending") {
    reasons.push("Seu site ainda não foi publicado.");
  }
  if (input.siteStatus === "suspended") {
    reasons.push("Seu site está temporariamente suspenso.");
  }

  return {
    access: getSiteAccess(input),
    reasons: reasons.length > 0 ? reasons : ["Este site está temporariamente indisponível."],
  };
}
