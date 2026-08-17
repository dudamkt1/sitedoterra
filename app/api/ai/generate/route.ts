import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateWithAi } from "@/lib/ai";
import { buildToolPrompt } from "@/lib/ai-tools";
import { getAiTools, saveHistory } from "@/lib/ai-center";
import { ensureTenantForUser } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * POST /api/ai/generate — gera conteúdo usando a IA configurada pelo usuário.
 *
 * Compatível com o formato anterior ({ kind, prompt, context }) e com o novo
 * formato da Central de IA ({ tool, fields }), em que o prompt é montado no
 * servidor a partir do esquema da ferramenta.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const tool = typeof body.tool === "string" ? body.tool : "";
  const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
  const kind = typeof body.kind === "string" ? body.kind : "default";
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 2000) : "";
  const save = body.save !== false;

  let finalPrompt = prompt;
  let toolCode = "";
  let toolName = "";
  let system = undefined as string | undefined;

  if (tool) {
    const tools = await getAiTools();
    const def = tools.find((t) => t.code === tool);
    if (!def) return NextResponse.json({ error: "Ferramenta não encontrada." }, { status: 404 });
    if (!def.enabled) return NextResponse.json({ error: "Esta ferramenta está desativada." }, { status: 403 });
    if (!def.generates_content) return NextResponse.json({ error: "Esta ferramenta não gera conteúdo via IA." }, { status: 400 });

    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) normalized[k] = v.join(", ");
      else normalized[k] = String(v);
    }

    finalPrompt = buildToolPrompt(def.code, normalized);
    toolCode = def.code;
    toolName = def.name;
    system = def.base_prompt || undefined;
  }

  const result = await generateWithAi(user.id, {
    kind,
    prompt: finalPrompt,
    context: context || (tool ? "" : undefined),
    system,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Erro ao gerar conteúdo" }, { status: 502 });
  }

  // Salva automaticamente no histórico (isolado por usuário/tenant).
  let historyId: string | null = null;
  if (save && tool) {
    const tenant = await ensureTenantForUser(user.id);
    const saved = await saveHistory({
      user_id: user.id,
      tenant_id: tenant?.id || null,
      tool_code: toolCode,
      tool_name: toolName,
      prompt: finalPrompt,
      content: result.text || "",
      metadata: { fields },
    });
    historyId = saved?.id || null;
  }

  return NextResponse.json({ text: result.text, tool_code: toolCode, tool_name: toolName, history_id: historyId });
}