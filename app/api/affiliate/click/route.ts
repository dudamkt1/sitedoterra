import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const VISITOR_TOKEN_COOKIE = "tc_visitor_token";
const VISITOR_TOKEN_MAX_AGE = 180 * 24 * 60 * 60; // 180 dias

// Validação leve de UUID (formato canônico). A validação forte (afiliado
// existente + ativo) é feita pela RPC `register_affiliate_click` no servidor.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let { ref, subdomain } = body as { ref?: string; subdomain?: string };

    // Fallback: aceita `ref` via query string (permite GET opcional abaixo).
    if (!ref) {
      try {
        const url = new URL(request.url);
        ref = url.searchParams.get("ref") || undefined;
      } catch {
        // ignore
      }
    }

    if (!ref) {
      return NextResponse.json({ error: "Parâmetro ref é obrigatório" }, { status: 400 });
    }

    if (!UUID_RE.test(ref)) {
      // Não confiar cegamente no valor recebido — formato deve ser UUID.
      return NextResponse.json({ error: "ref inválido" }, { status: 400 });
    }

    const cookieStore = await cookies();

    // Obtém ou gera o visitor_token
    let visitorToken = cookieStore.get(VISITOR_TOKEN_COOKIE)?.value;

    if (!visitorToken) {
      visitorToken = crypto.randomUUID();
      // Salva o cookie no response
      cookieStore.set(VISITOR_TOKEN_COOKIE, visitorToken, {
        maxAge: VISITOR_TOKEN_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    // Registra o clique via function SQL (first-click wins).
    // A RPC já valida: programa ativo, afiliado existente e afiliado ativo.
    const admin = createAdminClient();
    const { data: clickId, error } = await admin.rpc("register_affiliate_click", {
      p_affiliate_user_id: ref,
      p_visitor_token: visitorToken,
      p_source_subdomain: (subdomain || "unknown").slice(0, 200),
    });

    if (error) {
      console.error("Erro ao registrar clique de afiliado:", error);
      // Falha silenciosa para o cliente (caller não quebra a página);
      // o cookie ainda fica registrado se foi gerado nesta chamada.
      return NextResponse.json({ success: false, visitor_token: visitorToken }, { status: 200 });
    }

    // A RPC já aplicou TODAS as regras:
    //   - program_active (Super Admin)
    //   - affiliate_status.is_active (afiliado aceitou os termos)
    //   - site_status='active' OU allow_inactive_site_affiliate=true
    //   - first-click wins (preserva a primeira atribuição)
    // Quando ela retorna null, indica que o clique NÃO foi registrado
    // (afiliado inativo, programa pausado, ou site inativo com permissão OFF).
    // O cookie tc_visitor_token AINDA é gerado/persistido — assim a UI
    // pode exibir o link normalmente, e a decisão final fica na conversão.

    return NextResponse.json({
      success: true,
      click_id: clickId,
      visitor_token: visitorToken,
      already_attributed: clickId === null,
      // client_attempt reflete: o backend decidiu não registrar (mas o cookie
      // existe e a UI pode continuar tentando contratar).
      eligible: clickId !== null,
    });
  } catch (err) {
    console.error("Erro no endpoint de clique de afiliado:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}