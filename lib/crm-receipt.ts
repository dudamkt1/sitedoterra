"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** Configuração do recibo (espelha GET/PUT /api/crm/receipt). */
export interface ReceiptConfig {
  businessName: string;
  doc: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  primaryColor: string;
  footerText: string;
}

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export interface ReceiptSale {
  id: string;
  sale_date: string;
  discount_cents: number;
  total_cents: number;
  payment_method: string | null;
  status: string;
  notes: string | null;
}

export interface ReceiptClient {
  name: string;
  cpf?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
}

export const BRL = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function datePt(v: string | null | undefined): string {
  if (!v) return "—";
  // sale_date vem como YYYY-MM-DD — evita shift de fuso ao converter.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(v).toLocaleDateString("pt-BR");
}

function hexToRgb(hex: string): [number, number, number] {
  const h = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!h) return [29, 92, 58];
  const n = parseInt(h[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Remove acentos/caracteres inválidos para nome de arquivo. */
export function sanitizeFileName(s: string): string {
  return (
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "Sem-cliente"
  );
}

export function receiptFileName(clientName: string, saleDate: string): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(saleDate || "");
  const stamp = d ? `${d[3]}-${d[2]}-${d[1]}` : new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
  return `Recibo-${sanitizeFileName(clientName)}-${stamp}.pdf`;
}

/** Normaliza telefone para wa.me (só dígitos, com DDI padrão 55 quando local). */
export function normalizeWaNumber(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${normalizeWaNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export function receiptWaMessage(clientName: string, saleDate: string, total: string): string {
  const first = String(clientName || "").trim().split(/\s+/)[0] || "tudo bem?";
  return `Olá, ${first}! 😊\n\nSegue o seu recibo de ${total} referente à compra realizada em ${datePt(saleDate)}.\n\nObrigado pela preferência!`;
}

/** Carrega imagem remota como dataURL (para embutir no PDF). Retorna null se falhar. */
export async function loadImageDataUrl(url: string, timeoutMs = 8000): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageDims(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export interface ReceiptPdfInput {
  sale: ReceiptSale;
  items: ReceiptItem[];
  client: ReceiptClient | null;
  config: ReceiptConfig;
  logoDataUrl?: string | null;
}

/**
 * Gera o PDF real do recibo (A4) e retorna o Blob + nome do arquivo.
 * Usa apenas dados passados — nunca inventa valores; campos vazios são ocultados.
 */
export async function buildReceiptPdfBlob(input: ReceiptPdfInput): Promise<{ blob: Blob; filename: string }> {
  const { sale, items, client, config } = input;
  const [pr, pg, pb] = hexToRgb(config.primaryColor);
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const clientName = client?.name || "Sem cliente identificado";
  const receiptNo = String(sale.id || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "—";

  // ---------- Cabeçalho ----------
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("RECIBO DE PAGAMENTO", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nº ${receiptNo}  ·  ${datePt(sale.sale_date)}`, 14, 21);
  if (config.businessName) {
    doc.setFontSize(10);
    doc.text(config.businessName.slice(0, 60), 14, 28);
  }

  // Logo (canto superior direito, sem deformar).
  if (input.logoDataUrl) {
    try {
      const dims = await imageDims(input.logoDataUrl);
      const maxW = 40;
      const maxH = 24;
      let w = maxW;
      let h = maxH;
      if (dims) {
        const ratio = dims.w / dims.h;
        if (maxW / maxH > ratio) {
          h = maxH;
          w = maxH * ratio;
        } else {
          w = maxW;
          h = maxW / ratio;
        }
      }
      const fmt = input.logoDataUrl.includes("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(input.logoDataUrl, fmt, 196 - w, 5, w, h);
    } catch {
      // Logo opcional — segue sem ela.
    }
  }
  doc.setTextColor(40, 40, 40);

  let y = 42;

  // ---------- Valor em destaque ----------
  doc.setFillColor(245, 247, 245);
  doc.roundedRect(14, y, 182, 20, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(pr, pg, pb);
  doc.text("VALOR RECEBIDO", 20, y + 8);
  doc.setFontSize(18);
  doc.text(BRL(sale.total_cents), 20, y + 16);
  doc.setTextColor(40, 40, 40);
  y += 27;

  const section = (title: string, atY: number): number => {
    if (atY > 255) {
      doc.addPage();
      atY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(pr, pg, pb);
    doc.text(title, 14, atY);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, atY + 2, 196, atY + 2);
    doc.setTextColor(40, 40, 40);
    return atY + 8;
  };

  // ---------- Recebemos de (cliente) ----------
  y = section("Recebemos de", y);
  const clientRows: [string, string][] = [[
    "Nome",
    clientName,
  ]];
  if (client?.cpf) clientRows.push(["CPF", client.cpf]);
  const clientContact = client?.whatsapp || client?.phone || "";
  if (clientContact) clientRows.push(["Telefone/WhatsApp", clientContact]);
  if (client?.email) clientRows.push(["E-mail", client.email]);
  autoTable(doc, {
    startY: y,
    body: clientRows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 42, textColor: [100, 100, 100] } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ---------- Referente a (itens) ----------
  y = section("Referente a", y);
  if (items.length) {
    autoTable(doc, {
      startY: y,
      head: [["Produto / Serviço", "Qtd", "Valor unit.", "Total"]],
      body: items.map((it) => [
        it.product_name || "Item",
        String(it.quantity),
        BRL(it.unit_price_cents),
        BRL(it.total_cents),
      ]),
      theme: "grid",
      headStyles: { fillColor: [pr, pg, pb], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: "center", cellWidth: 18 }, 2: { halign: "right", cellWidth: 32 }, 3: { halign: "right", cellWidth: 32 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    if (sale.discount_cents > 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Desconto aplicado: ${BRL(sale.discount_cents)}`, 196, y, { align: "right" });
      doc.setTextColor(40, 40, 40);
      y += 5;
    }
  } else {
    doc.setFontSize(10);
    doc.text("Venda registrada (sem detalhamento de itens).", 14, y);
    y += 7;
  }

  // ---------- Pagamento ----------
  y = section("Pagamento", y);
  const payRows: [string, string][] = [
    ["Forma de pagamento", sale.payment_method || "—"],
    ["Data do pagamento", datePt(sale.sale_date)],
    ["Status da venda", sale.status || "—"],
    ["Venda", `#${receiptNo}`],
  ];
  if (sale.notes) payRows.push(["Observações", sale.notes]);
  autoTable(doc, {
    startY: y,
    body: payRows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 42, textColor: [100, 100, 100] } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ---------- Recebedor ----------
  y = section("Recebedor", y);
  const recvLines: string[] = [];
  if (config.businessName) recvLines.push(config.businessName);
  if (config.doc) recvLines.push(`CPF/CNPJ: ${config.doc}`);
  const recvContact = [config.phone, config.email].filter(Boolean).join("  ·  ");
  if (recvContact) recvLines.push(recvLines.length ? recvContact : `Contato: ${recvContact}`);
  if (config.address) recvLines.push(config.address);
  doc.setFontSize(10);
  for (const line of recvLines) {
    if (y > 258) {
      doc.addPage();
      y = 20;
    }
    doc.text(line.slice(0, 95), 14, y);
    y += 5.5;
  }
  y += 6;
  if (y > 250) {
    doc.addPage();
    y = 30;
  }
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(60, y, 150, y);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Assinatura do recebedor", 105, y + 4, { align: "center" });
  doc.setTextColor(40, 40, 40);

  // ---------- Rodapé ----------
  const footer = config.footerText || "Este recibo confirma o recebimento do valor informado acima.";
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(footer.slice(0, 120), 105, 288, { align: "center" });
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}  ·  Página ${i} de ${pageCount}`, 105, 293, { align: "center" });
  }

  const filename = receiptFileName(clientName, sale.sale_date);
  const blob = doc.output("blob");
  return { blob, filename };
}

/** Abre o Blob em nova aba para visualização. Retorna a URL (revogar após uso). */
export function openBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  return url;
}

/** Força o download do Blob com o nome informado. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
