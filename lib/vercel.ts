/**
 * Integração com a API da Vercel para domínios personalizados.
 *
 * Valores DNS exibidos ao usuário vêm da configuração REAL da Vercel
 * (target `cname.vercel-dns.com` para www e record `A 76.76.21.21` para raiz).
 * Nenhum valor fictício é exibido.
 */

const VERCEL_API = "https://api.vercel.com";

// Valores canônicos da Vercel para apontamento de domínios
export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";
export const VERCEL_APEX_A_RECORD = "76.76.21.21";

interface VercelCredentials {
  projectId: string | null;
  token: string | null;
  teamId: string | null;
}

/** Normaliza valor de platform_config (jsonb pode vir como string quotada). */
function cfgStr(v: unknown): string {
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
      try {
        return String(JSON.parse(t));
      } catch {
        return t.slice(1, -1);
      }
    }
    return t;
  }
  return String(v ?? "");
}

// Cache curto para não ler platform_config em toda chamada.
let credsCache: { data: VercelCredentials; ts: number } | null = null;
const CREDS_CACHE_MS = 60_000;

/**
 * Resolve as credenciais da API Vercel — ENV primeiro, `platform_config`
 * (editável em /admin/dominios) como alternativa. Sem uma das duas fontes,
 * a conexão de domínios próprios não funciona.
 */
export async function getVercelCredentials(): Promise<VercelCredentials> {
  const fromEnv: VercelCredentials = {
    projectId: process.env.VERCEL_PROJECT_ID || null,
    token: process.env.VERCEL_API_TOKEN || null,
    teamId: process.env.VERCEL_TEAM_ID || null,
  };
  if (fromEnv.projectId && fromEnv.token) return fromEnv;
  if (credsCache && Date.now() - credsCache.ts < CREDS_CACHE_MS) return credsCache.data;
  let db: VercelCredentials = { projectId: null, token: null, teamId: null };
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", ["vercel_project_id", "vercel_api_token", "vercel_team_id"]);
    const map = new Map((data || []).map((r: { key: string; value: unknown }) => [r.key, cfgStr(r.value)]));
    db = {
      projectId: map.get("vercel_project_id") || null,
      token: map.get("vercel_api_token") || null,
      teamId: map.get("vercel_team_id") || null,
    };
  } catch {
    // mantém vazio
  }
  const merged: VercelCredentials = {
    projectId: fromEnv.projectId || db.projectId,
    token: fromEnv.token || db.token,
    teamId: fromEnv.teamId || db.teamId,
  };
  credsCache = { data: merged, ts: Date.now() };
  return merged;
}

/** Status SEM segredos (para exibir no admin). */
export async function getVercelConfigStatus(): Promise<{
  projectIdSource: "env" | "admin" | null;
  hasToken: boolean;
  teamIdSource: "env" | "admin" | null;
}> {
  const envPid = process.env.VERCEL_PROJECT_ID || null;
  const envToken = process.env.VERCEL_API_TOKEN || null;
  const envTeam = process.env.VERCEL_TEAM_ID || null;
  let dbPid: string | null = null;
  let dbToken = false;
  let dbTeam: string | null = null;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", ["vercel_project_id", "vercel_api_token", "vercel_team_id"]);
    for (const r of (data || []) as { key: string; value: unknown }[]) {
      const v = cfgStr(r.value);
      if (r.key === "vercel_project_id" && v) dbPid = v;
      if (r.key === "vercel_api_token" && v) dbToken = true;
      if (r.key === "vercel_team_id" && v) dbTeam = v;
    }
  } catch {}
  return {
    projectIdSource: envPid ? "env" : dbPid ? "admin" : null,
    hasToken: Boolean(envToken) || dbToken,
    teamIdSource: envTeam ? "env" : dbTeam ? "admin" : null,
  };
}

/** Invalida o cache de credenciais (após salvar no admin). */
export function invalidateVercelCredsCache(): void {
  credsCache = null;
}

interface VercelDomainResponse {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: { type: string; domain: string; value: string }[];
  nameservers?: string[];
  intendedNameservers?: string[];
  cdnEnabled?: boolean;
  createdAt?: number;
}

interface VercelAddDomainResponse {
  name: string;
  apexName: string;
  verified: boolean;
  nameservers: string[];
  intendedNameservers?: string[];
  verification?: { type: string; domain: string; value: string }[];
  cdnEnabled?: boolean;
}

/** Erro da API Vercel com status/código preservados para mensagens amigáveis. */
export class VercelApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "VercelApiError";
    this.status = status;
    this.code = code;
  }
}

async function vercelFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const creds = await getVercelCredentials();
  if (!creds.projectId || !creds.token) {
    throw new Error("VERCEL_PROJECT_ID ou VERCEL_API_TOKEN não configurados (nem via ENV nem no admin)");
  }
  const sep = path.includes("?") ? "&" : "?";
  const team = creds.teamId ? `${sep}teamId=${encodeURIComponent(creds.teamId)}` : "";
  // Projetos dentro de um Time exigem ?teamId= — sem isso a API retorna
  // 403/404 e o connect quebra.
  const url = `${VERCEL_API}${path}${team}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { message?: string; code?: string } })?.error || {};
    throw new VercelApiError(
      res.status,
      err.code || null,
      `Vercel API error ${res.status}: ${err.message || JSON.stringify(body)}`
    );
  }
  return body as T;
}

async function vercelProjectPath(suffix: string): Promise<string> {
  const creds = await getVercelCredentials();
  return `/v10/projects/${creds.projectId}${suffix}`;
}

async function vercelProjectPath(suffix: string): Promise<string> {
  const creds = await getVercelCredentials();
  return `/v10/projects/${creds.projectId}${suffix}`;
}

/**
 * Adiciona o domínio (ou subdomínio www) ao projeto Vercel.
 * Idempotente: se o domínio já existe no projeto (ex.: tentativa anterior
 * que registrou na Vercel mas falhou depois), busca o registro existente
 * em vez de falhar com 409.
 */
export async function addVercelDomain(domain: string): Promise<VercelAddDomainResponse> {
  try {
    return await vercelFetch<VercelAddDomainResponse>(
      await vercelProjectPath("/domains"),
      {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      }
    );
  } catch (err) {
    const apiErr = err instanceof VercelApiError ? err : null;
    const alreadyExists =
      apiErr?.status === 409 ||
      apiErr?.code === "domain_already_in_use" ||
      /already (exists|in use)/i.test(apiErr?.message || "");
    if (alreadyExists) {
      // Reaproveita o registro existente (retry seguro).
      return (await getVercelDomain(domain)) as unknown as VercelAddDomainResponse;
    }
    throw err;
  }
}

/** Consulta o status atual do domínio (verificação, nameservers, etc.). */
export async function getVercelDomain(domain: string): Promise<VercelDomainResponse> {
  return vercelFetch<VercelDomainResponse>(
    await vercelProjectPath(`/domains/${encodeURIComponent(domain)}`)
  );
}

/** Verifica o domínio (força checagem). */
export async function verifyVercelDomain(domain: string): Promise<VercelDomainResponse> {
  return vercelFetch<VercelDomainResponse>(
    await vercelProjectPath(`/domains/${encodeURIComponent(domain)}/verify`),
    { method: "POST" }
  );
}

/** Remove o domínio do projeto Vercel. */
export async function removeVercelDomain(domain: string): Promise<void> {
  await vercelFetch<{ ok: boolean }>(
    await vercelProjectPath(`/domains/${encodeURIComponent(domain)}`),
    { method: "DELETE" }
  );
}

export interface DnsInstruction {
  records: {
    type: string;
    host: string;
    value: string;
    ttl?: string;
  }[];
  explanation: string;
}

/**
 * Gera instruções DNS reais baseadas na Vercel.
 * Se o domínio já foi adicionado e a Vercel retornou nameservers/verification,
 * usamos os dados reais; caso contrário usamos os padrões canônicos da Vercel.
 */
export function buildDnsInstructions(
  domain: string,
  isApex: boolean,
  vercelInfo?: VercelDomainResponse
): DnsInstruction {
  // Alvo real apontado pela Vercel (pode ser um CNAME por projeto,
  // ex.: 1b9c57f1a54e7591.vercel-dns-017.com). Sempre preferimos o valor
  // retornado pela API da Vercel para o próprio domínio.
  const cnameValue =
    vercelInfo?.verification?.find(
      (v) => v.type === "CNAME" && v.domain.toLowerCase() === domain.toLowerCase()
    )?.value ||
    vercelInfo?.verification?.find((v) => v.type === "CNAME")?.value ||
    VERCEL_CNAME_TARGET;

  const apexValue =
    vercelInfo?.verification?.find((v) => v.type === "A")?.value || VERCEL_APEX_A_RECORD;

  // Domínio raiz (ex.: topconsultores.com.br): A em "@" + CNAME em "www".
  if (isApex) {
    return {
      records: [
        { type: "A", host: "@", value: apexValue, ttl: "automático" },
        { type: "CNAME", host: "www", value: cnameValue, ttl: "automático" },
      ],
      explanation:
        "Aponte o registro A do domínio raiz para o IP fornecido e crie um CNAME de 'www' para o destino da Vercel. Assim, tanto meudominio.com.br quanto www.meudominio.com.br funcionarão no mesmo site.",
    };
  }

  // Subdomínio (ex.: www.meudominio.com.br ou oleos.topconsultores.com.br):
  // CNAME no próprio rótulo do subdomínio apontando para o destino da Vercel.
  const host = domain.split(".")[0];

  return {
    records: [
      {
        type: "CNAME",
        host,
        value: cnameValue,
        ttl: "automático",
      },
    ],
    explanation:
      `Crie (ou edite) um registro CNAME de '${host}' apontando para o destino da Vercel (${cnameValue}). Aguarde a propagação (pode levar de alguns minutos até 24h) e volte para verificar o domínio.`,
  };
}
