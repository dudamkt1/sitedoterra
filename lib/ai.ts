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
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
];

// Modelos atuais (30/jul-ago/2026) na ordem de preferência. Groq descontinuou
// llama-3.3-70b-versatile e llama-3.1-8b-instant (shutdown 16/08/2026), com
// recomendação oficial para openai/gpt-oss-20b / openai/gpt-oss-120b / qwen.
// No OpenRouter, o roteador "openrouter/free" NUNCA quebra (sempre escolhe um
// modelo gratuito disponível) — é a nossa maior garantia. As listas são só o
// primeiro passo; além delas fazemos DESCOBERTA DINÂMICA via API (ver abaixo).
const OPENAI_COMPAT_MODEL_FALLBACKS: Record<string, string[]> = {
  groq: [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3-32b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "allam-2-7b",
  ],
  openrouter: [
    "openrouter/free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free",
  ],
};

// Prioridade de modelos usada na descoberta dinâmica do Groq.
const GROQ_MODEL_PRIORITY = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "allam-2-7b",
];

// Prioridade de modelos gratuitos usada na descoberta dinâmica do OpenRouter.
const OPENROUTER_FREE_PRIORITY = [
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

// Modelos que estão descontinuados e seus substitutos atuais. Aplicado a TODO
// provedor lido do banco, para NUNCA tentar um modelo morto — mesmo que o banco
// (ou o deploy anterior) ainda tenha o valor antigo. Corrige sozinho.
// A linha Gemini 2.x foi retirada para novas chaves (HTTP 404 "no longer
// available to new users") — o substituto atual estável é o gemini-3.5-flash.
const MODEL_MIGRATIONS: Record<string, Record<string, string>> = {
  "google-gemini": {
    "gemini-1.5-flash": "gemini-3.5-flash",
    "gemini-1.5-pro": "gemini-3.5-flash",
    "gemini-2.0-flash": "gemini-3.5-flash",
    "gemini-2.5-flash": "gemini-3.5-flash",
    "gemini-2.5-pro": "gemini-3.5-flash",
  },
  groq: {
    "llama-3.3-70b-versatile": "openai/gpt-oss-20b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "llama3-70b-8192": "openai/gpt-oss-20b",
    "llama3-8b-8192": "openai/gpt-oss-20b",
  },
  openrouter: {
    "meta-llama/llama-3.1-8b-instruct:free": "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free": "openrouter/free",
    "meta-llama/llama-3.1-70b-instruct:free": "openrouter/free",
  },
};

/** Troca o modelo do provedor pelo substituto atual se ele estiver descontinuado. */
function normalizeProviderModel(p: AiProvider): AiProvider {
  const map = MODEL_MIGRATIONS[p.code];
  if (!map) return p;
  const replacement = map[p.model || ""];
  if (!replacement || replacement === p.model) return p;
  return { ...p, model: replacement };
}

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

/**
 * DESCOBERTA DINÂMICA: consulta a API do provedor e devolve os modelos
 * atualmente disponíveis (priorizando gratuitos/estáveis). Assim, mesmo que a
 * lista estática acima fique velha, o sistema sempre encontra um modelo válido.
 * Best-effort: falhou a consulta => retorna lista vazia.
 */
async function discoverLiveModels(p: AiProvider, apiKey: string): Promise<string[]> {
  try {
    if (p.code === "groq" && apiKey) {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: { id?: string }[] };
      const ids = new Set(
        (data.data || []).map((m) => m.id).filter((id): id is string => Boolean(id))
      );
      return GROQ_MODEL_PRIORITY.filter((id) => ids.has(id));
    }

    if (p.code === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models/");
      if (!res.ok) return [];
      const data = (await res.json()) as {
        data?: { id?: string; pricing?: { prompt?: string; completion?: string }; modality?: string; input_modalities?: string[] }[];
      };
      const freeIds = (data.data || [])
        .filter(
          (m) =>
            m.id?.includes(":free") &&
            m.pricing?.prompt === "0" &&
            m.pricing?.completion === "0" &&
            !m.id.includes("content-safety") &&
            !m.id.includes("rerank") &&
            !m.id.includes("embed") &&
            (m.modality === "text" || (m.input_modalities && m.input_modalities.includes("text")))
        )
        .map((m) => m.id as string);
      const chosen = OPENROUTER_FREE_PRIORITY.filter((id) => freeIds.includes(id));
      if (chosen.length) return chosen;
      // Nenhum preferido disponível: devolve qualquer gratuito de texto.
      return freeIds.sort((a, b) => a.length - b.length);
    }
  } catch {
    // descoberta dinâmica é best-effort
  }
  return [];
}

type ChatRunResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Tenta gerar em um provedor OpenAI-compatible com FALLBACK automático:
 * 1) modelo configurado + lista estável; 2) se tudo falhar com "modelo
 * indisponível", faz descoberta dinâmica e tenta os modelos atuais do provedor.
 */
async function chatWithFallback(
  p: AiProvider,
  apiKey: string,
  makeBody: (model: string) => Record<string, unknown>,
  extractText: (json: any) => string
): Promise<ChatRunResult> {
  const tried = new Set<string>();
  let lastErr = "";
  let lastStatus = 0;

  const attempt = async (model: string): Promise<ChatRunResult | null> => {
    if (tried.has(model)) return null;
    tried.add(model);
    const res = await fetch(`${p.base_url || ""}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(makeBody(model)),
    });
    if (res.ok) {
      await persistWorkingModel(p.id, model, p.model);
      return { ok: true, text: extractText(await res.json()) };
    }
    const err = await res.text();
    if (!isModelUnavailable(res.status, err)) {
      return { ok: false, error: `Erro do provedor (HTTP ${res.status}): ${err.slice(0, 200)}` };
    }
    lastErr = err;
    lastStatus = res.status;
    return null;
  };

  const statics = openAiCompatCandidates(p);
  for (const model of statics) {
    const r = await attempt(model);
    if (r) return r;
  }

  const discovered = await discoverLiveModels(p, apiKey);
  for (const model of discovered) {
    const r = await attempt(model);
    if (r) return r;
  }

  return { ok: false, error: `Erro do provedor (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` };
}

// Prioridade de modelos usada na descoberta dinâmica do Gemini.
const GEMINI_MODEL_PRIORITY = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
];

/**
 * DESCOBERTA DINÂMICA GEMINI: consulta a lista oficial de modelos da API e
 * devolve os que AQUELA chave consegue usar para generateContent (priorizando
 * flash). Cobre casos como "model no longer available to new users".
 */
async function discoverGeminiModels(p: AiProvider, apiKey: string, base?: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${base || p.base_url || "https://generativelanguage.googleapis.com"}/v1beta/models?key=${apiKey}`, {
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
      const usable = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => (m.name || "").replace(/^models\//, ""))
        .filter((id) => Boolean(id) && !/@/.test(id) && !/embedding/i.test(id) && !/imagen/i.test(id) && !/audio|speech|tts|asr/i.test(id));
      if (!usable.length) return [];
      const preferred = GEMINI_MODEL_PRIORITY.filter((id) => usable.includes(id));
      if (preferred.length) return preferred;
      return usable.sort((a, b) => a.length - b.length);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

type GeminiRunResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Gera no Gemini com FALLBACK + DESCOBERTA DINÂMICA: tenta o modelo configurado
 * e os estáveis; se todos falharem como "modelo indisponível", consulta a lista
 * oficial de modelos da chave e tenta um disponível (preferindo flash).
 */
async function geminiChat(
  p: AiProvider,
  apiKey: string,
  payload: { system?: string; prompt?: string }
): Promise<GeminiRunResult> {
  const base = p.base_url || "https://generativelanguage.googleapis.com";
  const tried = new Set<string>();
  let lastErr = "";
  let lastStatus = 0;

  const attempt = async (model: string): Promise<GeminiRunResult | string | null> => {
    if (tried.has(model)) return null;
    tried.add(model);
    const url = `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: payload.prompt || "Responda apenas: ok" }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    };
    if (payload.system) body.systemInstruction = { parts: [{ text: payload.system }] };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await persistWorkingModel(p.id, model, p.model);
      const json = (await res.json()) as any;
      const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
      return { ok: true, text };
    }
    const err = await res.text();
    if (!isModelUnavailable(res.status, err)) {
      return `Erro do provedor (HTTP ${res.status}): ${err.slice(0, 200)}`;
    }
    lastErr = err;
    lastStatus = res.status;
    return null;
  };

  for (const model of geminiCandidates(p)) {
    const r = await attempt(model);
    if (typeof r === "string") return { ok: false, error: r };
    if (r) return r;
  }
  for (const model of await discoverGeminiModels(p, apiKey, base)) {
    const r = await attempt(model);
    if (typeof r === "string") return { ok: false, error: r };
    if (r) return r;
  }
  return { ok: false, error: `Erro do provedor (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` };
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
  const rows = data as unknown as AiProvider[];
  const providers = rows.map((p) => normalizeProviderModel(p));
  // best-effort: se detectamos modelo descontinuado, corrige no banco (self-heal)
  for (const p of providers) {
    const original = rows.find((r) => r.id === p.id);
    if (original && p.model && original.model !== p.model) {
      await persistWorkingModel(p.id, p.model, original.model).catch(() => {});
    }
  }
  return providers;
}

export async function getProvidersForAdmin(): Promise<AiProvider[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_providers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  const rows = data as unknown as AiProvider[];
  const providers = rows.map((p) => normalizeProviderModel(p));
  for (const p of providers) {
    const original = rows.find((r) => r.id === p.id);
    if (original && p.model && original.model !== p.model) {
      await persistWorkingModel(p.id, p.model, original.model).catch(() => {});
    }
  }
  return providers;
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
  const original = provider as unknown as AiProvider;
  const p = normalizeProviderModel(original);
  if (p.model && p.model !== original.model) {
    await persistWorkingModel(p.id, p.model, original.model).catch(() => {});
  }

  try {
    if (p.code === "google-gemini") {
      const r = await geminiChat(p, apiKey, { prompt: "Responda apenas: ok" });
      return r.ok
        ? { ok: true, message: "Conexão OK! Sua chave está funcionando." }
        : { ok: false, message: r.error };
    }

    const run = await chatWithFallback(
      p,
      apiKey,
      makeBodyFor,
      (json) => (json?.choices?.[0]?.message?.content as string | undefined) || ""
    );
    if (run.ok) {
      return { ok: true, message: "Conexão OK! Sua chave está funcionando." };
    }
    return { ok: false, message: run.error };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erro desconhecido na conexão." };
  }
}

function makeBodyFor(model: string): Record<string, unknown> {
  return { model, messages: [{ role: "user", content: "Responda apenas: ok" }], max_tokens: 16 };
}

/**
 * Gera conteúdo usando a configuração de IA do usuário.
 */
export async function generateWithAi(
  userId: string,
  input: { kind?: string; prompt?: string; context?: string; system?: string }
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
  const original = provider as unknown as AiProvider;
  const p = normalizeProviderModel(original);
  if (p.model && p.model !== original.model) {
    await persistWorkingModel(p.id, p.model, original.model).catch(() => {});
  }

  const system = input.system || p.instructions || "Você é um assistente de conteúdo. Responda em português do Brasil.";
  const kind = input.kind || "default";
  const basePrompt = input.prompt || "Escreva um texto curto e elegante.";
  const context = input.context ? `\n\nContexto: ${input.context}` : "";
  const fullPrompt = `${basePrompt}${context}\n\nGere apenas o conteúdo final, sem explicações.`;

  try {
    if (p.code === "google-gemini") {
      const r = await geminiChat(p, apiKey, { system, prompt: fullPrompt });
      if (!r.ok) return { ok: false, error: r.error };
      if (!r.text) return { ok: false, error: "O provedor retornou resposta vazia. Verifique os limites do plano gratuito." };
      return { ok: true, text: r.text.trim() };
    }

    // OpenAI-compatible (Groq, OpenRouter, etc.) com fallback + descoberta dinâmica
    const run = await chatWithFallback(
      p,
      apiKey,
      (model) => ({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: fullPrompt },
        ],
        max_tokens: 700,
        temperature: 0.7,
      }),
      (json) => (json?.choices?.[0]?.message?.content as string | undefined) || ""
    );
    if (!run.ok) return { ok: false, error: run.error };
    const text = run.text;
    if (!text) return { ok: false, error: "O provedor retornou resposta vazia. Verifique os limites do plano gratuito." };
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido ao gerar conteúdo." };
  }
}
