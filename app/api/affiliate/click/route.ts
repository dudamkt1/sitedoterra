import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const VISITOR_TOKEN_COOKIE = "tc_visitor_token";
const VISITOR_TOKEN_MAX_AGE = 180 * 24 * 60 * 60; // 180 dias

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ref, subdomain } = body;

    if (!ref) {
      return NextResponse.json({ error: "Parâmetro ref é obrigatório" }, { status: 400 });
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

    // Registra o clique via function SQL (first-click wins)
    const admin = createAdminClient();
    const { data: clickId, error } = await admin.rpc("register_affiliate_click", {
      p_affiliate_user_id: ref,
      p_visitor_token: visitorToken,
      p_source_subdomain: subdomain || "unknown",
    });

    if (error) {
      console.error("Erro ao registrar clique de afiliado:", error);
      return NextResponse.json({ error: "Erro ao registrar clique" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      click_id: clickId,
      visitor_token: visitorToken,
      already_attributed: clickId === null,
    });
  } catch (err) {
    console.error("Erro no endpoint de clique de afiliado:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}