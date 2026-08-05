/**
 * Integração com a API da Vercel para domínios personalizados.
 *
 * Valores DNS exibidos ao usuário vêm da configuração REAL da Vercel
 * (target `cname.vercel-dns.com` para www e record `A 76.76.21.21` para raiz).
 * Nenhum valor fictício é exibido.
 */

const VERCEL_API = "https://api.vercel.com";
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;

// Valores canônicos da Vercel para apontamento de domínios
export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";
export const VERCEL_APEX_A_RECORD = "76.76.21.21";

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

async function vercelFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!VERCEL_PROJECT_ID || !VERCEL_TOKEN) {
    throw new Error("VERCEL_PROJECT_ID ou VERCEL_API_TOKEN não configurados");
  }
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Vercel API error ${res.status}: ${(body as { error?: { message?: string } })?.error?.message || JSON.stringify(body)}`
    );
  }
  return body as T;
}

/** Adiciona o domínio (ou subdomínio www) ao projeto Vercel. */
export async function addVercelDomain(domain: string): Promise<VercelAddDomainResponse> {
  return vercelFetch<VercelAddDomainResponse>(
    `/v10/projects/${VERCEL_PROJECT_ID}/domains`,
    {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    }
  );
}

/** Consulta o status atual do domínio (verificação, nameservers, etc.). */
export async function getVercelDomain(domain: string): Promise<VercelDomainResponse> {
  return vercelFetch<VercelDomainResponse>(
    `/v10/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`
  );
}

/** Verifica o domínio (força checagem). */
export async function verifyVercelDomain(domain: string): Promise<VercelDomainResponse> {
  return vercelFetch<VercelDomainResponse>(
    `/v10/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" }
  );
}

/** Remove o domínio do projeto Vercel. */
export async function removeVercelDomain(domain: string): Promise<void> {
  await vercelFetch<{ ok: boolean }>(
    `/v10/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`,
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
  const wwwValue =
    vercelInfo?.verification?.find((v) => v.type === "CNAME" && v.domain.includes("www"))?.value ||
    VERCEL_CNAME_TARGET;

  if (isApex) {
    return {
      records: [
        {
          type: "A",
          host: "@",
          value: vercelInfo?.verification?.find((v) => v.type === "A")?.value || VERCEL_APEX_A_RECORD,
          ttl: "automático",
        },
        {
          type: "CNAME",
          host: "www",
          value: wwwValue,
          ttl: "automático",
        },
      ],
      explanation:
        "Aponte o registro A do domínio raiz para o IP fornecido e crie um CNAME de 'www' para o destino da Vercel. Assim, tanto meudominio.com.br quanto www.meudominio.com.br funcionarão no mesmo site.",
    };
  }

  return {
    records: [
      {
        type: "CNAME",
        host: "www",
        value: wwwValue,
        ttl: "automático",
      },
    ],
    explanation:
      "Crie (ou edite) um registro CNAME de 'www' apontando para o destino da Vercel. O domínio raiz deve ter um registro A apontando para o IP fornecido pela Vercel, se você também quiser usar o domínio sem 'www'.",
  };
}
