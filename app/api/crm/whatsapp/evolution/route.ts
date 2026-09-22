import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getWhatsAppConfig } from "@/lib/crm";
import { decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * Proxy seguro da Evolution API (QR Code / status / logout).
 * O API Key NUNCA sai do servidor: o browser fala só com estas rotas.
 *
 * Convenção dos campos já usados no painel:
 *   - API URL = https://sua-evolution.com/message/sendText/SUA_INSTANCIA
 *     (a base é derivada cortando a partir de "/message/")
 *   - Phone ID = Instance Name
 *   - Token = API Key global da Evolution (AUTHENTICATION_API_KEY)
 */

type EvoCtx = { base: string; instance: string; key: string };

async function evoContext(admin: any, tenantId: string): Promise<{ ctx?: EvoCtx; error?: string }> {
  const config = await getWhatsAppConfig(admin, tenantId);
  if (config.provider !== "evolution") {
    return { error: "Escolha o provedor Evolution API para conectar via QR Code." };
  }
  const rawUrl = (config.api_url || "").trim().replace(/\/$/, "");
  if (!rawUrl) return { error: "Informe a URL do servidor Evolution na configuração e salve." };
  const cut = rawUrl.toLowerCase().indexOf("/message/");
  const base = (cut >= 0 ? rawUrl.slice(0, cut) : rawUrl).replace(/\/$/, "");
  const row = await admin
    .from("crm_whatsapp_config")
    .select("access_token_enc")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const key = decryptSecret((row as any)?.data?.access_token_enc);
  if (!key) return { error: "Informe a API Key da Evolution (Token) na configuração e salve." };
  const instance = String((config as any).phone_id || "").trim();
  if (!instance) return { error: "Informe o Instance Name no campo Phone ID e salve." };
  return { ctx: { base, instance, key } };
}

async function evoFetch(ctx: EvoCtx, path: string, init?: RequestInit) {
  const res = await fetch(`${ctx.base}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      apikey: ctx.key,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

function pickQr(json: any): string | null {
  if (!json || typeof json !== "object") return null;
  const raw =
    json.base64 ||
    json.qrcode?.base64 ||
    json.qr?.base64 ||
    json.qrcode?.code ||
    null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const v = raw.trim();
  return v.startsWith("data:image") ? v : `data:image/png;base64,${v}`;
}

function pickState(json: any): string {
  const s = json?.instance?.state || json?.state || json?.status;
  return typeof s === "string" ? s.toLowerCase() : "unknown";
}

/** GET — estado da conexão da instância (open = conectado e pronto p/ envios). */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  try {
    const { ctx, error: cfgErr } = await evoContext(admin, tenant!.id);
    if (!ctx) return NextResponse.json({ error: cfgErr }, { status: 400 });
    let state = "unknown";
    try {
      const { res, json } = await evoFetch(ctx, `/instance/connectionState/${encodeURIComponent(ctx.instance)}`);
      if (res.ok) state = pickState(json);
      else if (res.status === 404) state = "not_found";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/timeout|timed out/i.test(msg)) {
        return NextResponse.json({ error: "Servidor Evolution não respondeu (timeout). Confira a URL." }, { status: 502 });
      }
      return NextResponse.json(
        { error: "Não foi possível alcançar o servidor Evolution. Confira a URL (https://...) e se ele está no ar." },
        { status: 502 }
      );
    }
    return NextResponse.json({ state, connected: state === "open", instance: ctx.instance });
  } catch (e) {
    console.error("[whatsapp-evolution] erro em status:", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/** POST { action: "qr" | "disconnect" } */
export async function POST(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const { ctx, error: cfgErr } = await evoContext(admin, tenant!.id);
    if (!ctx) return NextResponse.json({ error: cfgErr }, { status: 400 });

    if (action === "disconnect") {
      try {
        await evoFetch(ctx, `/instance/logout/${encodeURIComponent(ctx.instance)}`, { method: "DELETE" });
      } catch (e) {
        return NextResponse.json({ error: "Falha ao falar com o servidor Evolution." }, { status: 502 });
      }
      return NextResponse.json({ success: true, connected: false });
    }

    if (action === "qr") {
      // Garante a instância (409/"já existe" é caminho normal — segue p/ o QR).
      try {
        await evoFetch(ctx, `/instance/create`, {
          method: "POST",
          body: JSON.stringify({ instanceName: ctx.instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
        });
      } catch {
        return NextResponse.json({ error: "Não foi possível alcançar o servidor Evolution. Confira a URL." }, { status: 502 });
      }
      // Tenta o formato v2 e cai para o v1.
      let qr: string | null = null;
      let state = "unknown";
      const attempts = [
        `/instance/connect/${encodeURIComponent(ctx.instance)}`,
        `/instance/qrcode/${encodeURIComponent(ctx.instance)}`,
      ];
      for (const path of attempts) {
        try {
          const { res, json } = await evoFetch(ctx, path);
          if (!res.ok) continue;
          state = pickState(json) || state;
          qr = pickQr(json);
          if (qr || state === "open") break;
        } catch {
          // tenta o próximo formato
        }
      }
      if (state === "open" || (!qr && state !== "unknown")) {
        // Sem QR e sem estado claro: devolve o estado p/ a UI decidir.
      }
      if (!qr && state !== "open") {
        return NextResponse.json(
          { error: "Não foi possível gerar o QR Code. Confira se a URL, a API Key e o Instance Name estão corretos.", state },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, qr, state, connected: state === "open" });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    console.error("[whatsapp-evolution] erro:", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
