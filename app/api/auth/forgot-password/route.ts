import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicBaseUrl } from "@/lib/public-url";
import { getEmailConfig, isEmailConfigured, buildRecoveryHtml, decryptSmtpPass } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailRaw || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verifica se e-mail existe em profiles (fonte do site). Também checa tenants por email se houver.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("user_id, email")
    .ilike("email", emailRaw)
    .maybeSingle();

  if (profileErr) {
    console.error("forgot-password profile check error", profileErr.message);
  }

  // Fallback: lista usuários via auth admin se não encontrou em profiles (pode haver user sem profile ainda)
  let exists = !!profile;
  if (!exists) {
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      exists = (list?.users || []).some((u) => (u.email || "").toLowerCase() === emailRaw);
    } catch {}
  }

  if (!exists) {
    return NextResponse.json({ error: "E-mail não encontrado. Verifique ou crie uma conta." }, { status: 404 });
  }

  const redirectTo = `${getPublicBaseUrl()}/auth/callback?next=/atualizar-senha`;
  const emailCfg = await getEmailConfig();

  // Se SMTP configurado em /admin/emails, envia e-mail personalizado do site (remetente, logo, texto)
  if (isEmailConfigured(emailCfg)) {
    try {
      const adminForLink = createAdminClient();
      // Busca nome do usuário para personalizar
      let userName: string | null = null;
      if (profile) {
        // tenta pegar name do profile via admin
        const { data: prof2 } = await adminForLink.from("profiles").select("name").eq("user_id", profile.user_id).maybeSingle();
        userName = (prof2 as any)?.name || null;
      }
      if (!userName) {
        try {
          const { data: list } = await adminForLink.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const u = (list?.users || []).find((x) => (x.email || "").toLowerCase() === emailRaw);
          userName = (u?.user_metadata as any)?.name || (u?.user_metadata as any)?.full_name || null;
        } catch {}
      }

      const { data: linkData, error: linkErr } = await adminForLink.auth.admin.generateLink({
        type: "recovery",
        email: emailRaw,
        options: { redirectTo },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        throw new Error(linkErr?.message || "Falha ao gerar link de recuperação");
      }
      const recoveryLink = linkData.properties.action_link as string;

      const siteName = emailCfg?.smtp_from_name || "TopConsultores";
      const subjectTpl = emailCfg?.smtp_subject || "Recupere sua senha - {{site_name}}";
      const subject = subjectTpl.replace(/\{\{site_name\}\}/g, siteName).replace(/\{\{name\}\}/g, userName || "");

      const html = buildRecoveryHtml({
        siteName,
        logoUrl: emailCfg?.smtp_logo_url || null,
        userName,
        recoveryLink,
        supportEmail: emailCfg?.smtp_from_email || null,
        customHtml: emailCfg?.smtp_body_html || null,
      });

      const { default: nodemailer } = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: emailCfg!.smtp_host!,
        port: Number(emailCfg!.smtp_port),
        secure: Boolean(emailCfg!.smtp_secure),
        auth: { user: emailCfg!.smtp_user!, pass: decryptSmtpPass(emailCfg!)! },
      });
      await transporter.verify().catch(() => {});
      await transporter.sendMail({
        from: `"${siteName}" <${emailCfg!.smtp_from_email}>`,
        to: emailRaw,
        subject,
        html,
        replyTo: emailCfg?.smtp_reply_to || undefined,
      });

      return NextResponse.json({ success: true, message: "Enviamos um e-mail com instruções para criar uma nova senha. Verifique sua caixa de entrada e spam." });
    } catch (e) {
      console.error("custom SMTP recovery failed, fallback to supabase", e);
      // fallback para Supabase se custom falhar
    }
  }

  // Fallback: Supabase padrão (quando SMTP não configurado)
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(emailRaw, {
    redirectTo,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Enviamos um e-mail com instruções para criar uma nova senha. Verifique sua caixa de entrada e spam." });
}
