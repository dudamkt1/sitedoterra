import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { AiProvider, AiSettings } from "@/types";

/**
 * Camada de serviço da IA. Todo acesso a chaves acontece no servidor.
 */

// ---------------------------------------------------------------------------
// ROBUSTEZ CONTRA MODELOS DESCONTINUADOS
// ---------------------------------------------------------------------------
// Modelos de IA mudam/são descontinuados pelos provedores (ex.: gemini-1.5-flash
// saiu do ar). Para o CLIENTE nunca ver "modelo não encontrado", usamos uma
// lista de modelos estáveis: se o modelo configurado falhar com "modelo não
// disponível", tentamos automaticamente o próximo da lista e atualizamos a
// configuração global (ai_providers) para o modelo que funcionou.
// ---------------------------------------------------------------------------

const GEMINI_KNOWN_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
];

const OPENAI_COMPAT_MODEL_FALLBACKS: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"],
  openrouter: [
    "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-70b-instruct:free",
  ],
};

/** Candidatos de modelo para Gemini: configurado primeiro, depois estáveis. */
function geminiCandidates(p: AiProvider): string[] {
  return Array.from(
    new Set([p.model, ...GEMINI_KNOWN_MODELS].filter((m): m is string => Boolean(m)))
  );
}

/** Candidatos para provedores OpenAI-compatible (Groq, OpenRouter, etc.). */
function openAiCompatCandidates(p: AiProvider): string[] {
  const base = OPENAI_COMPAT_MODEL_FALLBACKS[p.code] || [];
  return Array.from(new Set([p.model, ...base].filter((m): m is string => Boolean(m))));
}

/** true quando o erro significa "modelo descontinuado/indisponível" (recoverável). */
function isModelUnavailable(status: number, body: string): boolean {
  return status === 404 && /(no longer available|not found|not supported|does not exist)/i.test(body);
}

/** Persiste o modelo que funcionou na configuração global (auto-healing). */
async function persistWorkingModel(providerId: string, model: string, configured: string | null) {
  if (!model || !providerId || model === configured) return;
  try {
    const admin = createAdminClient();
    await admin.from("ai_providers").update({ model, updated_at: new Date().toISOString() }).eq("id", providerId);
  } catch {
    // best-effort: não bloqueia a resposta do usuário
  }
}

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
      const base = p.base_url || "https://generativelanguage.googleapis.com";
      let lastErr = "";
      let lastStatus = 0;
      for (const model of geminiCandidates(p)) {
        const url = `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Responda apenas: ok" }] }] }),
        });
        if (res.ok) {
          await persistWorkingModel(p.id, model, p.model);
          return { ok: true, message: "Conexão OK! Sua chave está funcionando." };
        }
        const err = await res.text();
        if (!isModelUnavailable(res.status, err)) {
          return { ok: false, message: `Falha na conexão (HTTP ${res.status}): ${err.slice(0, 200)}` };
        }
        lastErr = err;
        lastStatus = res.status;
      }
      return { ok: false, message: `Falha na conexão (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` };
    }

    // OpenAI-compatible (Groq, OpenRouter, etc.)
    let lastErr = "";
    let lastStatus = 0;
    for (const model of openAiCompatCandidates(p)) {
      const res = await fetch(`${p.base_url || ""}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "Responda apenas: ok" }], max_tokens: 16 }),
      });
      if (res.ok) {
        await persistWorkingModel(p.id, model, p.model);
        return { ok: true, message: "Conexão OK! Sua chave está funcionando." };
      }
      const err = await res.text();
      if (!isModelUnavailable(res.status, err)) {
        return { ok: false, message: `Falha na conexão (HTTP ${res.status}): ${err.slice(0, 200)}` };
      }
      lastErr = err;
      lastStatus = res.status;
    }
    return { ok: false, message: `Falha na conexão (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` };
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
      const base = p.base_url || "https://generativelanguage.googleapis.com";
      let lastErr = "";
      let lastStatus = 0;
      for (const model of geminiCandidates(p)) {
        const url = `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          }),
        });
        if (res.ok) {
          await persistWorkingModel(p.id, model, p.model);
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
          if (!text) return { ok: false, error: "O provedor retornou resposta vazia. Verifique os limites do plano gratuito." };
          return { ok: true, text: text.trim() };
        }
        const err = await res.text();
        if (!isModelUnavailable(res.status, err)) {
          return { ok: false, error: `Erro do provedor (HTTP ${res.status}): ${err.slice(0, 200)}` };
        }
        lastErr = err;
        lastStatus = res.status;
      }
      return { ok: false, error: `Erro do provedor (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` };
    }

    // OpenAI-compatible
    let lastErr = "";
    let lastStatus = 0;
    for (const model of openAiCompatCandidates(p)) {
      const res = await fetch(`${p.base_url || ""}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: fullPrompt },
          ],
          max_tokens: 700,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        await persistWorkingModel(p.id, model, p.model);
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content || "";
        if (!text) return { ok: false, error: "O provedor retornou resposta vazia. Verifique os limites do plano gratuito." };
        return { ok: true, text: text.trim() };
      }
      const err = await res.text();
      if (!isModelUnavailable(res.status, err)) {
        return { ok: false, error: `Erro do provedor (HTTP ${res.status}): ${err.slice(0, 200)}` };
      }
      lastErr = err;
      lastStatus = res.status;
    }
    return { ok: false, error: `Erro do provedor (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido ao gerar conteúdo." };
  }
}
