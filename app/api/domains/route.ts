import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { isValidDomain, normalizeDomain, isApexDomain, domainBase } from "@/lib/utils";
import { addVercelDomain, buildDnsInstructions, getVercelDomain, VercelApiError } from "@/lib/vercel";
import { getPublicBaseUrl } from "@/lib/public-url";

export const runtime = "nodejs";

/** Traduz o erro técnico em mensagem acionável para o usuário. */
function friendlyInfraError(err: unknown): { error: string; status: number } {
  const msg = err instanceof Error ? err.message : String(err);
  if (/não configurados/i.test(msg)) {
    return { error: "Integração com a infraestrutura indisponível no momento. Tente novamente em instantes ou fale com o suporte.", status: 500 };
  }
  const apiErr = err instanceof VercelApiError ? err : null;
  if (apiErr && (apiErr.status === 401 || apiErr.status === 403)) {
    return { error: "Falha de autenticação com a infraestrutura. Fale com o suporte para regularizar a conexão.", status: 502 };
  }
  if (/already in use|another account|forbidden/i.test(msg)) {
    return { error: "Este domínio já está em uso em outro projeto. Se for seu, remova de lá ou fale com o suporte.", status: 409 };
  }
  if (/invalid|bad_request|400/i.test(msg)) {
    return { error: "A infraestrutura recusou este domínio. Confira a digitação (ex.: meusite.com.br) e tente novamente.", status: 400 };
  }
  if (/fetch failed|network|timeout|ETIMEDOUT|ECONN/i.test(msg)) {
    return { error: "Falha de comunicação com a infraestrutura. Verifique sua conexão e tente novamente.", status: 502 };
  }
  return { error: "Não foi possível registrar o domínio na infraestrutura. Verifique se o domínio é válido e tente novamente.", status: 502 };
}

/**
 * Conecta um domínio personalizado ao site do tenant.
 * Validações: formato, reservado, já cadastrado em outro tenant.
 * Fluxo: adiciona na Vercel + registra no banco + retorna instruções DNS.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { domain: rawDomain } = await request.json();
  const domain = normalizeDomain(String(rawDomain || ""));

  if (!isValidDomain(domain)) {
    return NextResponse.json(
      { error: "Domínio inválido. Informe um domínio como meusite.com.br ou www.meusite.com.br." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const base = domainBase(domain);

  // Domínio principal da plataforma
  const mainDomain = getPublicBaseUrl()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "");
  if (mainDomain && base === mainDomain) {
    return NextResponse.json({ error: "Este domínio pertence à plataforma e não pode ser utilizado." }, { status: 409 });
  }

  // Já cadastrado (em qualquer tenant, ativo)
  const { data: existing } = await admin
    .from("domains")
    .select("*")
    .eq("domain", domain)
    .not("status", "in", ["removed"])
    .maybeSingle();

  if (existing) {
    // Retry do próprio tenant (ex.: tentativa anterior que parou no meio):
    // retoma de onde parou em vez de barrar com "outro site".
    if (existing.tenant_id === tenant.id) {
      let vercelInfo = null;
      try {
        const lookup = domain.startsWith("www.") ? domain : domain.replace(/^www\./, "");
        vercelInfo = await getVercelDomain(lookup);
      } catch {}
      const instructions = buildDnsInstructions(domain, Boolean(existing.is_apex ?? isApexDomain(domain)), vercelInfo || undefined);
      return NextResponse.json({ success: true, domain: existing, instructions, resumed: true });
    }
    return NextResponse.json(
      { error: "Este domínio já está vinculado a outro site. Se for seu, entre em contato com o suporte." },
      { status: 409 }
    );
  }

  // Registra na Vercel (usa o domínio base; www é tratado como subdomínio pela Vercel)
  const vercelDomain = domain.startsWith("www.") ? domain : base;
  let vercelInfo;
  try {
    vercelInfo = await addVercelDomain(vercelDomain);
  } catch (err) {
    console.error("Falha ao adicionar domínio na Vercel", err);
    const friendly = friendlyInfraError(err);
    return NextResponse.json({ error: friendly.error }, { status: friendly.status });
  }

  // Insere no banco
  const { data: domainRow, error: insertError } = await admin
    .from("domains")
    .insert({
      tenant_id: tenant.id,
      domain,
      is_apex: isApexDomain(domain),
      vercel_domain_id: vercelInfo.apexName || domain,
      status: "pending",
      connected_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    // Rollback na Vercel para não deixar domínio órfão
    try {
      const { removeVercelDomain } = await import("@/lib/vercel");
      await removeVercelDomain(vercelDomain);
    } catch {}
    return NextResponse.json({ error: "Não foi possível registrar o domínio." }, { status: 500 });
  }

  const instructions = buildDnsInstructions(domain, domainRow.is_apex, vercelInfo);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "domain.connected",
    entity_type: "domain",
    entity_id: domainRow.id,
    metadata: { domain },
  });

  return NextResponse.json({ success: true, domain: domainRow, instructions });
}
