export const RESERVED_SLUGS = [
  "admin",
  "login",
  "cadastro",
  "signup",
  "signin",
  "api",
  "super-admin",
  "superadmin",
  "painel",
  "dashboard",
  "configuracoes",
  "config",
  "usuarios",
  "usuario",
  "dominio",
  "dominios",
  "domains",
  "domain",
  "assinatura",
  "assinaturas",
  "pagamento",
  "pagamentos",
  "billing",
  "planos",
  "plans",
  "admin-login",
  "auth",
  "www",
  "app",
  "suporte",
  "ajuda",
  "help",
  "legal",
  "politica-privacidade",
  "termos",
  "terms",
  "privacy",
  "status",
  "health",
  "webhook",
  "webhooks",
  "cobranca",
  "financeiro",
  "pricing",
  "precos",
  "preco",
];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length < 2 || slug.length > 40) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return false;
  if (slug.includes("--")) return false;
  if (RESERVED_SLUGS.includes(slug)) return false;
  return true;
}

export function isValidDomain(domain: string): boolean {
  const value = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!value || value.length > 253) return false;
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(value)) return false;
  const parts = value.split(".");
  if (parts.length < 2) return false;
  return parts.every((p) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(p));
}

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/.*$/, "");
}

export function isApexDomain(domain: string): boolean {
  const parts = domain.split(".");
  // Ex.: com.br, com, org → apex. www.example.com → não-apex
  const withoutWww = domain.replace(/^www\./, "");
  return withoutWww === domain;
}

export function domainBase(domain: string): string {
  return domain.replace(/^www\./, "");
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
