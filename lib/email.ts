import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";

export interface EmailConfig {
  id: number;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_user: string | null;
  smtp_pass_enc: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
  smtp_reply_to: string | null;
  smtp_logo_url: string | null;
  smtp_subject: string | null;
  smtp_body_html: string | null;
  updated_at: string | null;
}

export async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("email_config").select("*").eq("id", 1).maybeSingle();
    return (data as EmailConfig) || null;
  } catch {
    return null;
  }
}

export function decryptSmtpPass(cfg: EmailConfig | null): string | null {
  if (!cfg?.smtp_pass_enc) return null;
  return decryptSecret(cfg.smtp_pass_enc);
}

export function isEmailConfigured(cfg: EmailConfig | null): boolean {
  if (!cfg) return false;
  return !!(cfg.smtp_host && cfg.smtp_port && cfg.smtp_user && decryptSmtpPass(cfg) && cfg.smtp_from_email);
}

export async function createTransportFromConfig(cfg: EmailConfig) {
  const pass = decryptSmtpPass(cfg);
  if (!cfg.smtp_host || !cfg.smtp_port || !cfg.smtp_user || !pass || !cfg.smtp_from_email) {
    throw new Error("SMTP não configurado");
  }
  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: Number(cfg.smtp_port),
    secure: Boolean(cfg.smtp_secure),
    auth: {
      user: cfg.smtp_user,
      pass,
    },
  });
  return transporter;
}

export function buildRecoveryHtml(opts: {
  siteName: string;
  logoUrl?: string | null;
  userName?: string | null;
  recoveryLink: string;
  supportEmail?: string | null;
  customHtml?: string | null;
}): string {
  const { siteName, logoUrl, userName, recoveryLink, customHtml } = opts;
  // Se admin customizou o HTML, usa-o com placeholders
  if (customHtml && customHtml.trim().length > 20) {
    return customHtml
      .replace(/\{\{site_name\}\}/g, siteName)
      .replace(/\{\{name\}\}/g, userName || "usuário")
      .replace(/\{\{link\}\}/g, recoveryLink)
      .replace(/\{\{logo\}\}/g, logoUrl || "")
      .replace(/\{\{email\}\}/g, opts.supportEmail || "");
  }

  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="${siteName}" style="max-height:48px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1D5C3A;">${siteName}</span>`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf8f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f2;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece7da;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="padding:28px 28px 0;text-align:center;">${logoImg}</td></tr>
        <tr><td style="padding:24px 28px 8px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1a1a14;">Recupere sua senha</h1>
          <p style="margin:12px 0 0;font-family:sans-serif;font-size:14px;line-height:1.6;color:#6b6b5e;">Olá ${userName ? `<strong>${userName}</strong>` : "olá"}! Recebemos um pedido para redefinir a senha da sua conta em <strong>${siteName}</strong>.</p>
          <p style="margin:12px 0 0;font-family:sans-serif;font-size:14px;line-height:1.6;color:#6b6b5e;">Clique no botão abaixo para criar uma <strong>nova senha</strong>. O link é válido por 1 hora e pode ser usado apenas uma vez.</p>
        </td></tr>
        <tr><td style="padding:20px 28px;text-align:center;">
          <a href="${recoveryLink}" style="display:inline-block;background:#1D5C3A;color:#ffffff;text-decoration:none;font-family:sans-serif;font-size:14px;font-weight:700;padding:12px 28px;border-radius:999px;">Criar nova senha →</a>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <p style="margin:0;font-family:sans-serif;font-size:12px;line-height:1.6;color:#9b9b8e;">Ou copie e cole este link no navegador:</p>
          <p style="margin:6px 0 0;font-family:monospace;font-size:11px;word-break:break-all;background:#f7f2ea;padding:10px 12px;border-radius:8px;color:#6b6b5e;">${recoveryLink}</p>
        </td></tr>
        <tr><td style="padding:20px 28px 0;">
          <p style="margin:0;font-family:sans-serif;font-size:12px;line-height:1.6;color:#9b9b8e;">Se você não solicitou esta recuperação, ignore este e-mail. Sua senha permanecerá a mesma.</p>
        </td></tr>
        <tr><td style="padding:20px 28px 28px;border-top:1px solid #f1ede2;margin-top:20px;">
          <p style="margin:0;font-family:sans-serif;font-size:11px;color:#9b9b8e;text-align:center;">Enviado por ${siteName} • Este é um e-mail automático, não responda.</p>
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-family:sans-serif;font-size:11px;color:#9b9b8e;text-align:center;">© ${new Date().getFullYear()} ${siteName}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function verifySmtpConfig(cfg: EmailConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const transporter = await createTransportFromConfig(cfg);
    await transporter.verify();
    return { ok: true, message: "Conexão SMTP verificada com sucesso!" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Falha ao conectar no SMTP" };
  }
}
