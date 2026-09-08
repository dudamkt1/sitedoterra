"use client";

import { useEffect, useMemo, useState } from "react";
import { CrmModal, Field, LoadingState, ErrorState } from "@/components/crm/crm-ui";
import { MediaPicker } from "@/components/media/MediaPicker";
import {
  BRL,
  datePt,
  normalizeWaNumber,
  openBlobUrl,
  downloadBlob,
  loadImageDataUrl,
  buildReceiptPdfBlob,
  receiptFileName,
  receiptWaMessage,
  waLink,
  type ReceiptConfig,
  type ReceiptSale,
  type ReceiptItem,
  type ReceiptClient,
} from "@/lib/crm-receipt";

const EMPTY_CONFIG: ReceiptConfig = {
  businessName: "",
  doc: "",
  phone: "",
  email: "",
  address: "",
  logoUrl: "",
  primaryColor: "#1d5c3a",
  footerText: "Este recibo confirma o recebimento do valor informado acima.",
};

/* ================================================================== */
/* Prévia HTML (aproxima o PDF final)                                  */
/* ================================================================== */

export function ReceiptPreview({ sale, items, client, config }: {
  sale: ReceiptSale;
  items: ReceiptItem[];
  client: ReceiptClient | null;
  config: ReceiptConfig;
}) {
  const color = config.primaryColor || "#1d5c3a";
  const receiptNo = String(sale.id || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "—";
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden text-sm">
      <div className="p-4 text-white flex items-start justify-between gap-3" style={{ background: color }}>
        <div>
          <p className="font-bold text-base tracking-wide">RECIBO DE PAGAMENTO</p>
          <p className="text-xs opacity-90 mt-0.5">Nº {receiptNo} · {datePt(sale.sale_date)}</p>
          {config.businessName && <p className="text-sm font-medium mt-1">{config.businessName}</p>}
        </div>
        {config.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logoUrl} alt="Logo" className="h-12 w-auto max-w-32 object-contain bg-white/10 rounded p-0.5" referrerPolicy="no-referrer" />
        )}
      </div>
      <div className="p-4 space-y-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs uppercase text-gray-400 font-semibold">Valor recebido</p>
          <p className="text-2xl font-bold" style={{ color }}>{BRL(sale.total_cents)}</p>
        </div>
        <div>
          <p className="font-semibold text-xs uppercase tracking-wide mb-1" style={{ color }}>Recebemos de</p>
          <p className="font-medium">{client?.name || "Sem cliente identificado"}</p>
          {client?.cpf && <p className="text-xs text-gray-500">CPF: {client.cpf}</p>}
          {(client?.whatsapp || client?.phone) && <p className="text-xs text-gray-500">{client?.whatsapp || client?.phone}</p>}
          {client?.email && <p className="text-xs text-gray-500">{client.email}</p>}
        </div>
        <div>
          <p className="font-semibold text-xs uppercase tracking-wide mb-1" style={{ color }}>Referente a</p>
          {items.length ? (
            <ul className="divide-y divide-gray-100 text-xs">
              {items.map((it, i) => (
                <li key={i} className="py-1.5 flex justify-between gap-2">
                  <span>{it.product_name || "Item"} <span className="text-gray-400">x{it.quantity}</span></span>
                  <span className="font-medium whitespace-nowrap">{BRL(it.total_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Venda registrada (sem detalhamento de itens).</p>
          )}
          {sale.discount_cents > 0 && <p className="text-xs text-gray-400 mt-1">Desconto aplicado: {BRL(sale.discount_cents)}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-gray-400">Forma de pagamento</p><p className="font-medium">{sale.payment_method || "—"}</p></div>
          <div><p className="text-gray-400">Data do pagamento</p><p className="font-medium">{datePt(sale.sale_date)}</p></div>
          <div><p className="text-gray-400">Status</p><p className="font-medium">{sale.status || "—"}</p></div>
          <div><p className="text-gray-400">Venda</p><p className="font-medium">#{receiptNo}</p></div>
        </div>
        {sale.notes && <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Observações:</span> {sale.notes}</p>}
        <div className="border-t border-gray-100 pt-3 text-xs text-gray-500">
          <p className="font-semibold text-gray-700">{config.businessName || "Recebedor"}</p>
          {config.doc && <p>CPF/CNPJ: {config.doc}</p>}
          {[config.phone, config.email].filter(Boolean).join(" · ") && <p>{[config.phone, config.email].filter(Boolean).join(" · ")}</p>}
          {config.address && <p>{config.address}</p>}
        </div>
        <p className="text-[11px] text-gray-400 text-center border-t border-gray-100 pt-2">{config.footerText}</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Modal do recibo: prévia + visualizar/baixar/compartilhar            */
/* ================================================================== */

export function ReceiptModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [sale, setSale] = useState<ReceiptSale | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [client, setClient] = useState<ReceiptClient | null>(null);
  const [config, setConfig] = useState<ReceiptConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pdf, setPdf] = useState<{ blob: Blob; filename: string } | null>(null);

  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [showWa, setShowWa] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [saleRes, cfgRes] = await Promise.all([
          fetch(`/api/crm/sales/${saleId}`).then((r) => r.json().then((j) => ({ ok: r.ok, j }))),
          fetch("/api/crm/receipt").then((r) => r.json().then((j) => ({ ok: r.ok, j }))),
        ]);
        if (!saleRes.ok) throw new Error(saleRes.j.error || "Venda não encontrada.");
        setSale(saleRes.j.sale);
        setItems(saleRes.j.items || []);
        setClient(saleRes.j.client || null);
        if (cfgRes.ok && cfgRes.j.config) setConfig({ ...EMPTY_CONFIG, ...cfgRes.j.config });
        const phone = saleRes.j.client?.whatsapp || saleRes.j.client?.phone || "";
        setWaPhone(phone);
        setWaMessage(receiptWaMessage(saleRes.j.client?.name || "", saleRes.j.sale.sale_date, BRL(saleRes.j.sale.total_cents)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar recibo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  const canShareFile = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      typeof (navigator as Navigator & { canShare?: (d: unknown) => boolean }).canShare === "function" &&
      !!pdf,
    [pdf]
  );

  async function ensurePdf(): Promise<{ blob: Blob; filename: string } | null> {
    if (pdf) return pdf;
    if (!sale) return null;
    setGenerating(true);
    try {
      const logoDataUrl = await loadImageDataUrl(config.logoUrl);
      const built = await buildReceiptPdfBlob({ sale, items, client, config, logoDataUrl });
      setPdf(built);
      return built;
    } catch {
      setError("Não foi possível gerar o PDF. Tente novamente.");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function handleView() {
    const built = await ensurePdf();
    if (built) openBlobUrl(built.blob);
  }

  async function handleDownload() {
    const built = await ensurePdf();
    if (built) downloadBlob(built.blob, built.filename);
  }

  async function handleNativeShare() {
    const built = await ensurePdf();
    if (!built) return;
    try {
      const file = new File([built.blob], built.filename, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string; text: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share?.({ files: [file], title: "Recibo de pagamento", text: waMessage });
        return;
      }
    } catch {
      // Cancelado pelo usuário ou falha — cai para o fallback abaixo.
    }
    setShowWa(true);
  }

  return (
    <CrmModal
      title="📄 Recibo de pagamento"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn-outline" disabled={generating || loading} onClick={handleView}>
            {generating ? "Gerando..." : "👁 Visualizar"}
          </button>
          <button type="button" className="btn btn-primary" disabled={generating || loading} onClick={handleDownload}>
            ⬇ Baixar PDF
          </button>
        </>
      }
    >
      {loading ? (
        <LoadingState label="Carregando dados da venda..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : sale ? (
        <div className="space-y-4">
          <ReceiptPreview sale={sale} items={items} client={client} config={config} />

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-sm text-green-900 mb-1">💬 Enviar pelo WhatsApp</p>
            {!showWa ? (
              <div className="flex flex-col sm:flex-row gap-2">
                {canShareFile ? (
                  <button type="button" className="btn btn-primary flex-1 !py-3" disabled={generating} onClick={handleNativeShare}>
                    📤 Compartilhar PDF (WhatsApp...)
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`btn ${canShareFile ? "btn-outline" : "btn-primary"} flex-1 !py-3`}
                  onClick={async () => {
                    await ensurePdf();
                    setShowWa(true);
                  }}
                >
                  {canShareFile ? "Ou baixar + mensagem pronta" : "⬇ Baixar PDF e abrir WhatsApp"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="WhatsApp do cliente">
                  <input
                    className="input"
                    inputMode="tel"
                    placeholder="Ex.: 11999998888"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                  />
                </Field>
                <Field label="Mensagem (edite antes de enviar)">
                  <textarea className="input min-h-20" value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />
                </Field>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Passo a passo: 1) toque em <strong>Baixar PDF</strong> acima · 2) abra a conversa abaixo ·
                  3) anexe o PDF na conversa do WhatsApp.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    className={`btn btn-primary flex-1 !py-3 text-center ${!normalizeWaNumber(waPhone) ? "opacity-50 pointer-events-none" : ""}`}
                    href={normalizeWaNumber(waPhone) ? waLink(waPhone, waMessage) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    💬 Abrir WhatsApp com mensagem
                  </a>
                  <button type="button" className="btn btn-outline" onClick={() => setShowWa(false)}>Voltar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </CrmModal>
  );
}

/* ================================================================== */
/* Configuração "Meu recibo"                                           */
/* ================================================================== */

export function ReceiptSettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [form, setForm] = useState<ReceiptConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/crm/receipt");
        const json = await res.json();
        if (res.ok && json.config) setForm({ ...EMPTY_CONFIG, ...json.config });
      } catch {
        // Mantém vazio — usuário preenche.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: keyof ReceiptConfig, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/crm/receipt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      setForm({ ...EMPTY_CONFIG, ...json.config });
      setMsg({ ok: true, text: "Configurações do recibo salvas!" });
      onSaved?.();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  const sampleSale: ReceiptSale = {
    id: "00000000-0000-0000-0000-000000000000",
    sale_date: new Date().toISOString().slice(0, 10),
    discount_cents: 0,
    total_cents: 125000,
    payment_method: "Pix",
    status: "Pago",
    notes: null,
  };
  const sampleItems: ReceiptItem[] = [
    { product_name: "Óleo essencial Lavanda 15ml", quantity: 1, unit_price_cents: 125000, total_cents: 125000 },
  ];
  const sampleClient: ReceiptClient = { name: "Maria Silva", cpf: "000.000.000-00", whatsapp: "(11) 99999-8888" };

  return (
    <CrmModal
      title="⚙️ Configurar meu recibo"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn-primary" disabled={saving || loading} onClick={save}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </>
      }
    >
      {loading ? (
        <LoadingState label="Carregando configurações..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <Field label="Logotipo">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  className="input flex-1 min-w-40"
                  placeholder="URL do logo ou escolha na biblioteca"
                  value={form.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                />
                <MediaPicker scope="tenant" value={form.logoUrl || undefined} onChange={(url) => set("logoUrl", url)} />
              </div>
              {form.logoUrl && (
                <div className="mt-2 rounded-lg bg-gray-50 p-2 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Prévia do logo" className="h-14 w-auto max-w-full object-contain rounded" referrerPolicy="no-referrer" />
                </div>
              )}
            </Field>
            <Field label="Nome profissional / empresa">
              <input className="input" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="Ex.: Ana Beatriz · Bem-estar" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="CPF / CNPJ (opcional)">
                <input className="input" value={form.doc} onChange={(e) => set("doc", e.target.value)} placeholder="000.000.000-00" />
              </Field>
              <Field label="WhatsApp (opcional)">
                <input className="input" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="11999998888" />
              </Field>
            </div>
            <Field label="E-mail (opcional)">
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@exemplo.com" />
            </Field>
            <Field label="Endereço (opcional)">
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, cidade/UF" />
            </Field>
            <Field label="Cor principal">
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-14 rounded border border-gray-200 bg-white p-1" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
                <input className="input flex-1" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} placeholder="#1d5c3a" />
              </div>
            </Field>
            <Field label="Mensagem de rodapé">
              <textarea className="input min-h-16" value={form.footerText} onChange={(e) => set("footerText", e.target.value)} />
            </Field>
            {msg && (
              <p className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
            )}
          </div>
          <div>
            <p className="label">Prévia do recibo</p>
            <ReceiptPreview sale={sampleSale} items={sampleItems} client={sampleClient} config={form} />
            <p className="text-[11px] text-gray-400 mt-2">Prévia aproximada — o PDF final segue o mesmo layout em página A4.</p>
          </div>
        </div>
      )}
    </CrmModal>
  );
}

/** Nome do arquivo do recibo (exportado para testes/reuso). */
export function receiptFileNameFor(clientName: string, saleDate: string): string {
  return receiptFileName(clientName, saleDate);
}
