import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { AiProvider, AiSettings } from "@/types";

/**
 * Camada de serviço da IA. Todo acesso a chaves acontece no servidor.
 */

export async function getEnabledProviders(): Promise<AiProvider[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_providers")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as unknown as AiProvider[];
}

export async function getProvidersForAdmin(): Promise<AiProvider[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_providers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as unknown as AiProvider[];
}

export async function getAiSettings(userId: string): Promise<AiSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("ai_settings").select("*").eq("user_id", userId).maybeSingle();
  return (data as unknown as AiSettings) || null;
}

export async function saveAiSettings(userId: string, providerId: string | null, apiKey?: string | null) {
  const admin = createAdminClient();
  const existing = await getAiSettings(userId);
  const payload: Record<string, unknown> = { user_id: userId, provider_id: providerId };
  if (apiKey) {
    payload.api_key_enc = encryptSecret(apiKey);
  } else if (existing?.api_key_enc) {
    payload.api_key_enc = existing.api_key_enc;
  }
  const { error } = await admin
    .from("ai_settings")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/**
 * Testa a conexão com o provedor usando a chave salva do usuário.
 */
export async function testProviderConnection(userId: string, providerId: string): Promise<{ ok: boolean; message: string }> {
  const settings = await getAiSettings(userId);
  if (!settings?.api_key_enc) {
    return { ok: false, message: "Nenhuma API Key configurada ainda." };
  }
  const apiKey = decryptSecret(settings.api_key_enc);
  if (!apiKey) return { ok: false, message: "Não foi possível ler a API Key armazenada." };

  const admin = createAdminClient();
  const { data: provider } = await admin.from("ai_providers").select("*").eq("id", providerId).maybeSingle();
  if (!provider) return { ok: false, message: "Provedor não encontrado." };
  const p = provider as unknown as AiProvider;

  try {
    if (p.code === "google-gemini") {
      const url = `${p.base_url || "https://generativelanguage.googleapis.com"}/v1beta/models/${p.model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responda apenas: ok" }] }] }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, message: `Falha na conexão (HTTP ${res.status}): ${err.slice(0, 200)}` };
      }
      return { ok: true, message: "Conexão OK! Sua chave está funcionando." };
    }

    // OpenAI-compatible (Groq, OpenRouter, etc.)
    const res = await fetch(`${p.base_url || ""}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: p.model || "llama-3.3-70b-versatile", messages: [{ role: "user", content: "Responda apenas: ok" }], max_tokens: 16 }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, message: `Falha na conexão (HTTP ${res.status}): ${err.slice(0, 200)}` };
    }
    return { ok: true, message: "Conexão OK! Sua chave está funcionando." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erro desconhecido na conexão." };
  }
}

/**
 * Gera conteúdo usando a configuração de IA do usuário.
 */
export async function generateWithAi(
  userId: string,
  input: { kind?: string; prompt?: string; context?: string }
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const settings = await getAiSettings(userId);
  if (!settings?.provider_id || !settings.api_key_enc) {
    return { ok: false, error: "Configure uma API Key em /painel/ia para usar a IA." };
  }
  const apiKey = decryptSecret(settings.api_key_enc);
  if (!apiKey) return { ok: false, error: "Não foi possível ler a API Key armazenada." };

  const admin = createAdminClient();
  const { data: provider } = await admin.from("ai_providers").select("*").eq("id", settings.provider_id).maybeSingle();
  if (!provider) return { ok: false, error: "Provedor não encontrado." };
  const p = provider as unknown as AiProvider;

  const system = p.instructions || "Você é um assistente de conteúdo. Responda em português do Brasil.";
  const kind = input.kind || "default";
  const basePrompt = input.prompt || "Escreva um texto curto e elegante.";
  const context = input.context ? `\n\nContexto: ${input.context}` : "";
  const fullPrompt = `${basePrompt}${context}\n\nGere apenas o conteúdo final, sem explicações.`;

  try {
    if (p.code === "google-gemini") {
      const url = `${p.base_url || "https://generativelanguage.googleapis.com"}/v1beta/models/${p.model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, error: `Erro do provedor (HTTP ${res.status}): ${err.slice(0, 200)}` };
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
      if (!text) return { ok: false, error: "O provedor retornou resposta vazia. Verifique os limites do plano gratuito." };
      return { ok: true, text: text.trim() };
    }

    // OpenAI-compatible
    const res = await fetch(`${p.base_url || ""}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: p.model || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: fullPrompt },
        ],
        max_tokens: 700,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Erro do provedor (HTTP ${res.status}): ${err.slice(0, 200)}` };
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || "";
    if (!text) return { ok: false, error: "O provedor retornou resposta vazia. Verifique os limites do plano gratuito." };
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido ao gerar conteúdo." };
  }
}
