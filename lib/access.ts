import type { AccountStatus, SiteStatus, SubscriptionStatus } from "@/types";

export interface AccessInput {
  accountStatus: AccountStatus;
  siteStatus: SiteStatus;
  subscriptionStatus: SubscriptionStatus;
  blocked: boolean;
}

export type SiteAccess = "available" | "suspended";

/**
 * REGRA CENTRAL DE ACESSO PÚBLICO.
 *
 * PUBLIC_SITE = AVAILABLE somente quando TODOS os critérios forem verdadeiros:
 *   subscription.status === 'active'
 *   account.status === 'active'
 *   site.status === 'active'
 *   !blocked
 *
 * Esta é a ÚNICA fonte de verdade. Não espalhar esta lógica em componentes.
 */
export function getSiteAccess(input: AccessInput): SiteAccess {
  if (
    input.subscriptionStatus === "active" &&
    input.accountStatus === "active" &&
    input.siteStatus === "active" &&
    !input.blocked
  ) {
    return "available";
  }
  return "suspended";
}

export function isSitePublic(
  accountStatus: AccountStatus,
  siteStatus: SiteStatus,
  subscriptionStatus: SubscriptionStatus,
  blocked: boolean
): boolean {
  return getSiteAccess({ accountStatus, siteStatus, subscriptionStatus, blocked }) === "available";
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
  if (input.subscriptionStatus === "awaiting_activation") {
    reasons.push("Sua assinatura ainda não foi ativada.");
  }
  if (input.subscriptionStatus === "past_due" || input.subscriptionStatus === "unpaid") {
    reasons.push("Há um pagamento pendente. Por favor, atualize seus dados de pagamento.");
  }
  if (input.subscriptionStatus === "canceled" || input.subscriptionStatus === "paused") {
    reasons.push("Sua assinatura está cancelada.");
  }
  if (input.subscriptionStatus === "incomplete" || input.subscriptionStatus === "trialing") {
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
