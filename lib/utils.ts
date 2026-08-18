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
  "midia",
  "midias",
  "media",
  "arquivos",
  "uploads",
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

// Sufixos públicos de duas partes (ex.: .com.br) — usados para detectar o apex real.
// O apex é o "domínio registrado": sufixo + 1 rótulo.
const TWO_PART_PUBLIC_SUFFIXES = new Set([
  // Brasil
  "com.br", "net.br", "org.br", "gov.br", "edu.br", "mil.br", "adv.br", "art.br",
  "blog.br", "eco.br", "emp.br", "eng.br", "esp.br", "etc.br", "far.br", "fm.br",
  "fot.br", "fst.br", "g12.br", "ind.br", "inf.br", "jor.br", "lel.br", "med.br",
  "mus.br", "not.br", "ntr.br", "odo.br", "ppg.br", "pro.br", "psc.br", "psi.br",
  "rec.br", "radio.br", "srv.br", "teo.br", "tmp.br", "tur.br", "tv.br", "vet.br",
  "vlog.br", "wiki.br", "web.br",
  // Internacional (casos comuns)
  "co.uk", "org.uk", "net.uk", "me.uk", "com.au", "net.au", "org.au", "com.co",
  "net.co", "org.co", "com.mx", "com.ar", "com.ve", "com.pe", "com.cl", "com.ec",
  "com.uy", "com.py", "co.jp", "ne.jp", "or.jp", "co.in", "com.cn", "com.sg",
  "com.tw", "com.hk", "com.my", "co.za", "com.ng", "com.gh", "co.ke", "com.eg",
  "com.ma",
]);

export function isApexDomain(domain: string): boolean {
  const value = domain.toLowerCase();
  const parts = value.split(".");
  if (parts.length < 2) return false;
  // Ex.: .com.br é um sufixo de duas partes → apex tem 3 rótulos (topconsultores.com.br).
  // Já oleos.topconsultores.com.br tem 4 rótulos → é subdomínio.
  const lastTwo = parts.slice(-2).join(".");
  if (TWO_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
    return parts.length === 3;
  }
  // Sufixos de uma parte (ex.: .com, .net, .org) → apex tem 2 rótulos.
  return parts.length === 2;
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

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
