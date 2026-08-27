"use client";

import { useEffect, useState } from "react";
import { PasswordField } from "@/components/PasswordField";

export default function AdminEmailConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [hasPass, setHasPass] = useState(false);
  const [passMask, setPassMask] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/email-config");
        const json = await res.json();
        if (res.ok) {
          setSmtpHost(json.smtp_host || "");
          setSmtpPort(json.smtp_port || 587);
          setSmtpSecure(Boolean(json.smtp_secure));
          setSmtpUser(json.smtp_user || "");
          setHasPass(Boolean(json.has_pass));
          setPassMask(json.smtp_pass_mask || null);
          setFromEmail(json.smtp_from_email || "");
          setFromName(json.smtp_from_name || "");
          setReplyTo(json.smtp_reply_to || "");
          setLogoUrl(json.smtp_logo_url || "");
          setSubject(json.smtp_subject || "Recupere sua senha - {{site_name}}");
          setBodyHtml(json.smtp_body_html || "");
        } else {
          setMsg({ ok: false, text: json.error || "Erro ao carregar." });
        }
      } catch {
        setMsg({ ok: false, text: "Falha de conexão." });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_secure: smtpSecure,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
          smtp_from_email: fromEmail,
          smtp_from_name: fromName,
          smtp_reply_to: replyTo,
          smtp_logo_url: logoUrl,
          smtp_subject: subject,
          smtp_body_html: bodyHtml,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: "Configuração de e-mail salva com sucesso!" });
        setSmtpPass("");
        // recarrega máscara
        const r2 = await fetch("/api/admin/email-config");
        if (r2.ok) {
          const j2 = await r2.json();
          setHasPass(Boolean(j2.has_pass));
          setPassMask(j2.smtp_pass_mask || null);
        }
      } else {
        setMsg({ ok: false, text: json.error || "Erro ao salvar." });
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão." });
    }
    setSaving(false);
  }

  async function testSend() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", test_to: testTo }),
      });
      const json = await res.json();
      setMsg({ ok: Boolean(json.ok), text: json.message || "Sem resposta." });
    } catch {
      setMsg({ ok: false, text: "Falha de conexão no teste." });
    }
    setTesting(false);
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando configuração de e-mail...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card">
        <h2 className="card-title mb-1">1. Servidor SMTP (envio)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure o SMTP que o site usará para enviar e-mails transacionais (ex.: recuperação de senha). Recomendamos
          <b> Hostinger (smtp.hostinger.com:465 SSL) </b> ou <b>Gmail (smtp.gmail.com:587)</b>. Para Gmail, use Senha de App.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">SMTP Host *</label>
            <input className="input" placeholder="smtp.hostinger.com ou smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
          </div>
          <div>
            <label className="label">Porta *</label>
            <input type="number" className="input" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
            <p className="text-xs text-gray-400 mt-1">465 = SSL, 587 = STARTTLS</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer">
          <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
          Usar SSL/TLS (porta 465)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label">Usuário SMTP (login) *</label>
            <input className="input" placeholder="seu@email.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
          </div>
          <div>
            <label className="label">Senha SMTP {hasPass && passMask ? `(salva: ${passMask})` : ""}</label>
            <PasswordField value={smtpPass} onChange={setSmtpPass} placeholder={hasPass ? "•••• deixe vazio para manter" : "Senha ou Senha de App"} autoComplete="off" />
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 mt-4 text-xs text-amber-800">
          <b>Dica SMTP/POP:</b> Para Hostinger: Host <code>smtp.hostinger.com</code> porta <code>465</code> SSL. Para Gmail: Host <code>smtp.gmail.com</code> porta <code>587</code> sem SSL + Senha de App (myaccount.google.com → Segurança → Senhas de app). POP não é necessário para envio.
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-1">2. Remetente e identidade</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">E-mail remetente *</label>
            <input className="input" placeholder="noreply@seudominio.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Nome remetente</label>
            <input className="input" placeholder="TopConsultores" value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </div>
          <div>
            <label className="label">Reply-To (responder para)</label>
            <input className="input" placeholder="suporte@seudominio.com" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </div>
          <div>
            <label className="label">URL do logotipo</label>
            <input className="input" placeholder="https://seudominio.com/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Aparece no topo do e-mail de recuperação.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-1">3. Template do e-mail de recuperação</h2>
        <p className="text-xs text-gray-400 mb-3">Use placeholders: <code>{"{{site_name}}"}</code> <code>{"{{name}}"}</code> <code>{"{{link}}"}</code> <code>{"{{logo}}"}</code>. Deixe em branco para usar o template padrão bonito.</p>
        <div>
          <label className="label">Assunto</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Recupere sua senha - {{site_name}}" />
        </div>
        <div className="mt-3">
          <label className="label">Corpo HTML (opcional)</label>
          <textarea className="input min-h-32 font-mono text-xs" value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} placeholder="Deixe vazio para usar o template padrão com logo, botão e cores do site. Se preencher, use HTML completo com {{link}}." />
        </div>
      </div>

      {msg && <p className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? "Salvando..." : "💾 Salvar configuração"}
        </button>
        <div className="flex items-center gap-2">
          <input className="input !py-2 !w-64" placeholder="Enviar teste para..." value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button type="button" onClick={testSend} disabled={testing} className="btn btn-outline !py-2">
            {testing ? "Enviando..." : "📧 Testar envio"}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Após salvar, o próximo e-mail de “Esqueceu a senha?” já sairá do remetente configurado, com seu logo e texto. Se SMTP não estiver configurado, o sistema usa o e-mail padrão do Supabase.
      </p>
    </div>
  );
}
