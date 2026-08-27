import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { encryptSecret, decryptSecret, keyHint } from "@/lib/crypto";
import { createTransportFromConfig } from "@/lib/email";

export const runtime = "nodejs";

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { actor };
}

function mask(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 8) return "••••";
  return `••••${v.slice(-4)}`;
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const admin = createAdminClient();
  const { data } = await admin.from("email_config").select("*").eq("id", 1).maybeSingle();
  const row = data as any;
  const passHint = keyHint(row?.smtp_pass_enc || null);

  return NextResponse.json({
    smtp_host: row?.smtp_host || "",
    smtp_port: row?.smtp_port || 587,
    smtp_secure: row?.smtp_secure ?? false,
    smtp_user: row?.smtp_user || "",
    smtp_pass_mask: passHint,
    has_pass: !!decryptSecret(row?.smtp_pass_enc || null),
    smtp_from_email: row?.smtp_from_email || "",
    smtp_from_name: row?.smtp_from_name || "",
    smtp_reply_to: row?.smtp_reply_to || "",
    smtp_logo_url: row?.smtp_logo_url || "",
    smtp_subject: row?.smtp_subject || "Recupere sua senha - {{site_name}}",
    smtp_body_html: row?.smtp_body_html || "",
  });
}

export async function PUT(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const setIf = (field: string, key: string, transform?: (v: string) => unknown) => {
    if (typeof body[key] === "string") {
      const v = body[key].trim();
      // permite limpar com string vazia
      updates[field] = transform ? transform(v) : v || null;
    }
  };

  setIf("smtp_host", "smtp_host");
  if (body.smtp_port !== undefined) updates.smtp_port = Number(body.smtp_port) || null;
  if (typeof body.smtp_secure === "boolean") updates.smtp_secure = body.smtp_secure;
  setIf("smtp_user", "smtp_user");
  setIf("smtp_from_email", "smtp_from_email");
  setIf("smtp_from_name", "smtp_from_name");
  setIf("smtp_reply_to", "smtp_reply_to");
  setIf("smtp_logo_url", "smtp_logo_url");
  setIf("smtp_subject", "smtp_subject");
  if (typeof body.smtp_body_html === "string") updates.smtp_body_html = body.smtp_body_html || null;

  if (typeof body.smtp_pass === "string" && body.smtp_pass.trim() !== "") {
    updates.smtp_pass_enc = encryptSecret(body.smtp_pass.trim());
  }

  const { error } = await admin.from("email_config").upsert({ id: 1, ...updates }, { onConflict: "id" });
  if (error) {
    console.error("email_config upsert error", error.message);
    return NextResponse.json({ error: "Erro ao salvar configuração." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: guard.actor!.id,
    actor_role: "superadmin",
    action: "email_config.updated",
    entity_type: "email_config",
    entity_id: "1",
    metadata: {},
  });

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const action = body.action || "test";
  const admin = createAdminClient();
  const { data } = await admin.from("email_config").select("*").eq("id", 1).maybeSingle();
  const row = data as any;
  if (!row?.smtp_host || !row?.smtp_port || !row?.smtp_user) {
    return NextResponse.json({ ok: false, message: "Preencha Host, Porta e Usuário SMTP antes de testar." });
  }

  if (action === "test") {
    const testTo = typeof body.test_to === "string" ? body.test_to.trim() : "";
    if (!testTo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testTo)) {
      return NextResponse.json({ ok: false, message: "Informe um e-mail válido em 'Enviar teste para'." });
    }
    const pass = decryptSecret(row?.smtp_pass_enc || null);
    if (!row.smtp_host || !row.smtp_port || !row.smtp_user || !pass || !row.smtp_from_email) {
      return NextResponse.json({ ok: false, message: "SMTP incompleto. Verifique host, porta, usuário, senha e remetente." });
    }
    try {
      const { default: nodemailer } = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: row.smtp_host,
        port: Number(row.smtp_port),
        secure: Boolean(row.smtp_secure),
        auth: { user: row.smtp_user, pass },
      });
      await transporter.verify();
      const fromName = row.smtp_from_name || "TopConsultores";
      await transporter.sendMail({
        from: `"${fromName}" <${row.smtp_from_email}>`,
        to: testTo,
        subject: `Teste de e-mail - ${fromName}`,
        html: `<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#1D5C3A;">Teste OK ✅</h2><p>Seu SMTP está configurado corretamente em <b>${fromName}</b>.</p><p>Host: ${row.smtp_host}:${row.smtp_port} ${row.smtp_secure ? "(SSL)" : "(STARTTLS)"}</p><p>Remetente: ${row.smtp_from_email}</p><p style="color:#9b9b8e;font-size:12px;">Este é um e-mail de teste enviado do /admin.</p></div>`,
      });
      return NextResponse.json({ ok: true, message: `E-mail de teste enviado para ${testTo} com sucesso!` });
    } catch (e) {
      return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Falha ao enviar teste." });
    }
  }

  return NextResponse.json({ ok: false, message: "Ação inválida." });
}
