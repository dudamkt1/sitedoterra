import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getWhatsAppConfig } from "@/lib/crm";
import { decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * POST /api/crm/whatsapp/send
 * Envia mensagem pela API do WhatsApp configurada (Meta Cloud API ou provedor compatível).
 * O token NUNCA sai do servidor. Exige que o provedor esteja configurado e habilitado.
 */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();

  const config = await getWhatsAppConfig(admin, tenant!.id);
  if (!config.enabled) {
    return NextResponse.json({ error: "WhatsApp não configurado." }, { status: 400 });
  }

  // Modo simples (sem API) — apenas registra histórico e retorna sucesso (link wa.me é aberto no cliente, gratuito)
  const isSimples = config.provider === "simples" || body.mode === "simples";
  if (isSimples) {
    const phoneSimple = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const messageSimple = typeof body.message === "string" ? body.message.trim() : "";
    const clientIdSimple = typeof body.client_id === "string" ? body.client_id : null;
    if (!phoneSimple || !messageSimple) {
      return NextResponse.json({ error: "Número e mensagem são obrigatórios." }, { status: 400 });
    }
    if (clientIdSimple) {
      await admin.from("crm_client_timeline").insert({
        tenant_id: tenant!.id,
        client_id: clientIdSimple,
        event_type: "mensagem",
        title: "Mensagem via WhatsApp (modo simples — link direto)",
        description: messageSimple.slice(0, 120),
        event_at: new Date().toISOString(),
      });
    }
    await admin.from("audit_logs").insert({
      actor_id: user!.id,
      actor_role: "user",
      action: "crm_whatsapp_send_simples",
      entity_type: "crm_whatsapp_config",
      entity_id: tenant!.id,
      metadata: { mode: "simples", phone: phoneSimple },
    });
    return NextResponse.json({ success: true, mode: "simples" });
  }

  const token = decryptSecret((await admin.from("crm_whatsapp_config").select("access_token_enc").eq("tenant_id", tenant!.id).maybeSingle()).data?.access_token_enc);
  if (!token || !config.api_url) {
    return NextResponse.json({ error: "WhatsApp não configurado." }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const clientId = typeof body.client_id === "string" ? body.client_id : null;

  if (!phone || !message) {
    return NextResponse.json({ error: "Número e mensagem são obrigatórios." }, { status: 400 });
  }

  // --- Meta WhatsApp Cloud API (provider padrão) ---
  let result: { ok: boolean; detail?: string } = { ok: false };

  if (!config.provider || config.provider === "meta") {
    try {
      const res = await fetch(`${config.api_url.replace(/\/$/, "")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok || json.error?.code === 0) {
        result = { ok: true };
      } else {
        result = { ok: false, detail: json.error?.message || `HTTP ${res.status}` };
      }
    } catch (e) {
      result = { ok: false, detail: e instanceof Error ? e.message : "Falha de rede" };
    }
  } else {
    // --- Provedor compatível (Z-API / Evolution API / outro) ---
    try {
      const res = await fetch(`${config.api_url.replace(/\/$/, "")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.provider === "zapi"
            ? { "Client-Token": token }
            : config.provider === "evolution"
              ? { apikey: token }
              : { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          number: phone,
          text: message,
          message: message,
        }),
      });
      const json = await res.json().catch(() => ({}));
      result = res.ok ? { ok: true } : { ok: false, detail: json.message || json.error || `HTTP ${res.status}` };
    } catch (e) {
      result = { ok: false, detail: e instanceof Error ? e.message : "Falha de rede" };
    }
  }

  if (clientId) {
    await admin.from("crm_client_timeline").insert({
      tenant_id: tenant!.id,
      client_id: clientId,
      event_type: "mensagem",
      title: "Mensagem enviada via WhatsApp",
      description: message.slice(0, 120),
      event_at: new Date().toISOString(),
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_whatsapp_send",
    entity_type: "crm_whatsapp_config",
    entity_id: tenant!.id,
    metadata: { ok: result.ok, detail: result.detail || null, provider: config.provider },
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Não foi possível enviar: ${result.detail || "erro desconhecido"}` }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}