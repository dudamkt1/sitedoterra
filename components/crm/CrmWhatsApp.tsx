"use client";

import { useEffect, useState } from "react";
import { EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog } from "@/components/crm/crm-ui";
import { WHATSAPP_PROVIDERS, MESSAGE_TEMPLATE_PRESETS } from "@/lib/crm-shared";
import type { CrmWhatsAppConfig, CrmMessageTemplate, CrmClient } from "@/types";

export default function CrmWhatsApp() {
  const [config, setConfig] = useState<CrmWhatsAppConfig | null>(null);
  const [messages, setMessages] = useState<CrmMessageTemplate[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [sendForm, setSendForm] = useState({ client_id: "", message: "" });
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [w, m, c] = await Promise.all([
        fetch("/api/crm/whatsapp").then((r) => r.json()),
        fetch("/api/crm/messages").then((r) => r.json()),
        fetch("/api/crm/clients?perPage=100").then((r) => r.json()),
      ]);
      setConfig(w.config);
      setMessages(m.messages || []);
      setClients(c.clients || []);
      setForm({
        enabled: w.config.enabled ? "1" : "0",
        provider: w.config.provider || "meta",
        api_url: w.config.api_url || "",
        phone_id: w.config.phone_id || "",
        webhook_url: w.config.webhook_url || "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function saveConfig(enabled?: boolean) {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/crm/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: enabled !== undefined ? enabled : form.enabled === "1",
          provider: form.provider,
          api_url: form.api_url,
          phone_id: form.phone_id,
          webhook_url: form.webhook_url,
          access_token: form.access_token || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      setConfig(json.config);
      setForm((f) => ({ ...f, enabled: json.config.enabled ? "1" : "0" }));
      setToast({ ok: true, text: "Configuração do WhatsApp salva!" });
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage() {
    const client = clients.find((c) => c.id === sendForm.client_id);
    if (!client) return;
    if (!sendForm.message.trim()) return;
    setSending(true);
    setToast(null);
    try {
      const phone = client.whatsapp || client.phone;
      if (!phone) throw new Error("Este cliente não possui WhatsApp cadastrado.");
      const res = await fetch("/api/crm/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, phone, message: sendForm.message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar.");
      setToast({ ok: true, text: "Mensagem enviada!" });
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao enviar." });
    } finally {
      setSending(false);
    }
  }

  function fillTemplate(m: CrmMessageTemplate | (typeof MESSAGE_TEMPLATE_PRESETS)[number]) {
    setSendForm((f) => ({ ...f, message: m.message }));
  }

  async function saveMessage(m: CrmMessageTemplate, newMessage: string) {
    if (m.id) {
      await apiPost("/api/crm/messages", { id: m.id, code: m.code, label: m.label, message: newMessage });
    } else {
      await apiPost("/api/crm/messages", { code: m.code, label: m.label, message: newMessage });
    }
    setToast({ ok: true, text: "Mensagem salva!" });
    load();
  }

  async function deleteMessage(m: CrmMessageTemplate) {
    if (!confirmDialog("Excluir esta mensagem?")) return;
    await apiDelete(`/api/crm/messages/${m.id}`);
    load();
  }

  const selectedClient = clients.find((c) => c.id === sendForm.client_id);
  const mergedMessages: (CrmMessageTemplate | (typeof MESSAGE_TEMPLATE_PRESETS)[number])[] = [
    ...MESSAGE_TEMPLATE_PRESETS.map((p) => messages.find((m) => m.code === p.code) || p),
  ];

  if (loading) return <LoadingState label="Carregando WhatsApp..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!config) return null;

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">
            {config.enabled ? (
              <span className="text-green-600">Conectado · {config.provider || "Meta"}</span>
            ) : (
              <span className="text-amber-600">WhatsApp não configurado</span>
            )}
          </p>
        </div>
        <button
          className={`btn ${config.enabled ? "btn-outline" : "btn-primary"}`}
          disabled={saving}
          onClick={() => saveConfig(!config.enabled)}
        >
          {config.enabled ? "Desativar" : "Ativar"}
        </button>
      </div>

      {!config.enabled && (
        <div className="card mb-6 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-700">
            🔒 <strong>WhatsApp não configurado.</strong> Para enviar mensagens pelo sistema, ative e preencha as
            credenciais abaixo. O token fica criptografado e nunca é exposto. Suporta a API oficial do WhatsApp/Meta ou
            provedores compatíveis (Z-API, Evolution API).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="card-title mb-4">Configuração da API</h2>
          <div className="space-y-3">
            <Field label="Provedor">
              <select className="input" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
                {WHATSAPP_PROVIDERS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="API URL / endpoint">
              <input className="input" placeholder="https://graph.facebook.com/v21.0/PHONE_ID/messages" value={form.api_url} onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))} />
            </Field>
            <Field label="Access Token (fica criptografado no servidor)">
              <input type="password" className="input" placeholder={config.has_token ? `•••• (token já cadastrado ${config.key_hint || ""})` : "Cole o token"} value={form.access_token || ""} onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))} />
            </Field>
            <Field label="Phone ID / Número (opcional)">
              <input className="input" placeholder="Ex.: 5521999999999" value={form.phone_id} onChange={(e) => setForm((f) => ({ ...f, phone_id: e.target.value }))} />
            </Field>
            <Field label="Webhook URL (opcional)">
              <input className="input" value={form.webhook_url} onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))} />
            </Field>
            <p className="text-xs text-gray-400">
              Status da conexão: <strong>{config.connection_status}</strong>. O envio é feito pelo servidor
              (autenticado), respeitando as regras da plataforma e nunca enviando automaticamente sem sua ação.
            </p>
            <button className="btn btn-primary w-full" disabled={saving} onClick={() => saveConfig()}>{saving ? "Salvando..." : "Salvar configuração"}</button>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title mb-4">Enviar mensagem</h2>
          <div className="space-y-3">
            <Field label="Cliente (com WhatsApp cadastrado)">
              <select className="input" value={sendForm.client_id} onChange={(e) => setSendForm((f) => ({ ...f, client_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {clients.filter((c) => c.whatsapp || c.phone).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.whatsapp || c.phone}</option>
                ))}
              </select>
            </Field>
            <Field label="Mensagem">
              <textarea className="input min-h-28" placeholder="Escreva a mensagem ou escolha uma pronta abaixo..." value={sendForm.message} onChange={(e) => setSendForm((f) => ({ ...f, message: e.target.value }))} />
            </Field>
            <p className="text-xs text-gray-400">
              Você pode usar <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code> no texto — ele será substituído
              pelo primeiro nome do cliente.
            </p>
            <button className="btn btn-gold w-full" disabled={sending || !selectedClient || !sendForm.message.trim() || !config.enabled} onClick={sendMessage}>
              {sending ? "Enviando..." : `💬 Enviar para ${selectedClient ? selectedClient.name.split(" ")[0] : "cliente"}`}
            </button>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-2">Mensagens prontas</h3>
          <div className="space-y-2">
            {mergedMessages.map((m) => (
              <div key={m.code} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-600">{m.label}</span>
                  <button
                    className="text-xs text-[#1d5c3a] underline"
                    onClick={() => {
                      const saved = messages.find((x) => x.code === m.code);
                      if (saved) fillTemplate(saved);
                      else fillTemplate(m);
                    }}
                  >Usar</button>
                </div>
                <textarea
                  className="input !py-1.5 text-xs min-h-14"
                  defaultValue={m.message}
                  onBlur={(e) => {
                    const saved = messages.find((x) => x.code === m.code);
                    saveMessage(saved || ({ code: m.code, label: m.label, message: "" } as CrmMessageTemplate), e.target.value);
                  }}
                />
                {m.code && messages.some((x) => x.code === m.code) && (
                  <div className="flex justify-end mt-1">
                    <button
                      className="text-xs text-red-500"
                      onClick={() => {
                        const saved = messages.find((x) => x.code === m.code)!;
                        deleteMessage(saved);
                      }}
                    >Excluir</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!config.enabled && clients.length === 0 && (
        <div className="card mt-6">
          <EmptyState icon="💬" title="Cadastre clientes com WhatsApp para começar a usar." />
        </div>
      )}
    </div>
  );
}