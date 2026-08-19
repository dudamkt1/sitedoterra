import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { resolveHomeSections } from "@/lib/home";
import { findIaResponse, type IaTrainingEntry } from "@/lib/ia-knowledge";
import { generateWithAi } from "@/lib/ai";

export const runtime = "nodejs";

/**
 * POST /api/ia/chat
 * { message, slug }
 *
 * Responde o chat da seção "Especialista IA doTERRA" da HOME pública.
 * Fluxo: 1) match local (base padrão + treinamento do consultor);
 *        2) se não houve match, usa a IA do consultor com contexto doTERRA;
 *        3) se a IA não souber (ou não estiver configurada), redireciona
 *           para o WhatsApp do consultor (redirectWhatsApp=true).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim().slice(0, 600);
  const slug = String(body.slug || "").trim();

  if (!message) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  const tenant = await getPublicTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Site não encontrado." }, { status: 404 });
  }

  // Carrega o conhecimento da seção about (global → tenant), o mesmo que a HOME renderiza.
  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
  const about = sections.find((s) => s.type === "about");
  const knowledge = ((about?.content?.knowledge as IaTrainingEntry[]) || []).filter(
    (k) => typeof k === "object" && k && typeof k.text === "string"
  );

  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const whatsapp = String(siteData.whatsapp || "");
  const profileName = tenant.profile_name || "";

  // 1) Match local (treinamento do consultor + base padrão doTERRA).
  const local = findIaResponse(message, knowledge);
  if (local.matched) {
    return NextResponse.json({
      text: local.text,
      oils: local.oils,
      matched: true,
      redirectWhatsApp: false,
      whatsapp,
      profileName,
    });
  }

  // 2) IA do consultor (contexto doTERRA + conhecimento treinado).
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("tenants")
    .select("user_id")
    .eq("id", tenant.tenant_id)
    .maybeSingle();

  if (owner?.user_id) {
    const trained = knowledge
      .map((k) => `- Pergunta/assunto: ${k.keywords || "—"}\n  Resposta: ${k.text}`)
      .join("\n");

    const system = [
      "Você é a 'Especialista IA doTERRA', assistente virtual de uma consultora de óleos essenciais doTERRA.",
      "Responda em português do Brasil, de forma acolhedora, educativa e ética.",
      "Use SEMPRE as informações da doTERRA sobre óleos essenciais e bem-estar. Não invente propriedades medicinais nem prometa curas.",
      "Se a pergunta não for sobre óleos essenciais, bem-estar, doTERRA ou o universo da consultora, responda exatamente: NAO_SEI",
      "Se não souber a resposta com segurança, responda exatamente: NAO_SEI",
      "Responda apenas o conteúdo final, sem explicações extras.",
    ].join(" ");

    const ai = await generateWithAi(owner.user_id, {
      kind: "chat",
      prompt: message,
      context: trained || undefined,
      system,
    });

    if (ai.ok && ai.text) {
      const text = ai.text.trim();
      if (text && !/^NAO_SEI$/i.test(text)) {
        return NextResponse.json({
          text,
          oils: [],
          matched: true,
          redirectWhatsApp: false,
          whatsapp,
          profileName,
        });
      }
    }
  }

  // 3) Fallback → WhatsApp do consultor.
  const fallbackText = whatsapp
    ? "Ainda não sei responder isso com segurança! Para um atendimento personalizado e cheio de cuidado, fale comigo agora no WhatsApp:"
    : "Ainda não sei responder isso com segurança! Que tal falarmos direto para eu te ajudar melhor?";

  return NextResponse.json({
    text: fallbackText,
    oils: [],
    matched: false,
    redirectWhatsApp: true,
    whatsapp,
    profileName,
  });
}