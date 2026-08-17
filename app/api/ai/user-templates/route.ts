import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUserTemplate, getUserTemplates } from "@/lib/ai-center";
import { ensureTenantForUser } from "@/lib/onboarding";

export const runtime = "nodejs";

/** POST /api/ai/user-templates — salva/duplica um template do usuário. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const templateCode = typeof body.template_code === "string" ? body.template_code : "";
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "Template sem nome";
  const data = body.data && typeof body.data === "object" ? body.data : {};

  if (!templateCode) return NextResponse.json({ error: "Template não informado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  const saved = await saveUserTemplate({
    user_id: user.id,
    tenant_id: tenant?.id || null,
    template_code: templateCode,
    name: name || "Meu template",
    data,
  });
  if (!saved) return NextResponse.json({ error: "Erro ao salvar o template." }, { status: 500 });

  const userTemplates = await getUserTemplates(user.id);
  return NextResponse.json({ success: true, template: saved, userTemplates });
}
