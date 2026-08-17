"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CrmExportBundle, CrmClient, CrmSale } from "@/types";

const BRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const datePt = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

/** Busca o pacote completo de dados do CRM do usuário logado. */
export async function fetchCrmBundle(): Promise<CrmExportBundle> {
  const res = await fetch("/api/crm/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "pdf", export_type: "completo" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao exportar.");
  return json.bundle;
}

function saveBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = [headers, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  // BOM para Excel reconhecer UTF-8
  saveBlob("\uFEFF" + content, filename, "text/csv;charset=utf-8;");
}

export function exportCsvAll(bundle: CrmExportBundle) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(
    `clientes-${stamp}.csv`,
    ["Nome", "Categoria", "VIP", "CPF", "Nascimento", "Email", "Telefone", "WhatsApp", "Cidade", "Estado", "Primeiro contato", "Primeira compra", "Última compra", "Compras", "Total gasto", "Ticket médio", "Observações"],
    bundle.clients.map((c) => [
      c.name, c.category, c.is_vip ? "Sim" : "Não", c.cpf || "", c.birth_date || "", c.email || "", c.phone || "", c.whatsapp || "",
      c.city || "", c.state || "", c.first_contact_at || "", c.first_purchase_at || "", c.last_purchase_at || "",
      c.purchase_count || 0, (c.total_spent_cents || 0) / 100, (c.ticket_avg_cents || 0) / 100, c.notes || "",
    ])
  );
  downloadCsv(
    `vendas-${stamp}.csv`,
    ["Data", "Cliente", "Status", "Itens", "Desconto", "Total", "Forma de pagamento", "Observações"],
    bundle.sales.map((s) => [
      s.sale_date, s.client_name || "", s.status,
      (s.items || []).map((i) => `${i.product_name} x${i.quantity}`).join(" | "),
      (s.discount_cents || 0) / 100, s.total_cents / 100, s.payment_method || "", s.notes || "",
    ])
  );
  downloadCsv(
    `financeiro-${stamp}.csv`,
    ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Forma de pagamento", "Observações"],
    bundle.financial.map((f) => [
      f.entry_date, f.type === "income" ? "Entrada" : "Saída", f.category || "", f.description || "",
      (f.type === "income" ? 1 : -1) * f.amount_cents / 100, f.payment_method || "", f.notes || "",
    ])
  );
  downloadCsv(
    `cobrancas-${stamp}.csv`,
    ["Cliente", "Vencimento", "Valor", "Status", "Forma de pagamento", "Observações"],
    bundle.charges.map((c) => [c.client_name || "", c.due_date, c.amount_cents / 100, c.status, c.payment_method || "", c.notes || ""])
  );
  downloadCsv(
    `tarefas-${stamp}.csv`,
    ["Título", "Cliente", "Data", "Horário", "Prioridade", "Categoria", "Status", "Observações"],
    bundle.tasks.map((t) => [t.title, t.client_name || "", t.due_date || "", t.due_time || "", t.priority, t.category || "", t.status, t.notes || ""])
  );
}

function sectionHeader(doc: jsPDF, title: string, startY: number): number {
  if (startY > 250) {
    doc.addPage();
    startY = 20;
  }
  doc.setFontSize(13);
  doc.setTextColor(29, 92, 58);
  doc.text(title, 14, startY);
  doc.setDrawColor(196, 150, 58);
  doc.setLineWidth(0.5);
  doc.line(14, startY + 2, 196, startY + 2);
  return startY + 8;
}

/** Exporta a ficha completa de um cliente em PDF. */
export function exportClientPdf(data: {
  client: CrmClient;
  sales: CrmSale[];
  timeline: { event_type: string; title: string; description: string | null; event_at: string }[];
  notes: { note: string; created_at: string }[];
  charges: { amount_cents: number; due_date: string; status: string }[];
  consultant_name: string | null;
  site_name: string | null;
  level: string;
}) {
  const doc = new jsPDF();
  const c = data.client;

  doc.setFillColor(29, 92, 58);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(c.name, 14, 14);
  doc.setFontSize(9);
  doc.text(`Ficha do cliente — gerado pelo SITE DOTERRA`, 14, 21);
  doc.setTextColor(60, 60, 60);

  let y = sectionHeader(doc, "Dados do cliente", 38);
  const personal: [string, string][] = [
    ["Categoria", c.category],
    ["VIP", c.is_vip ? "Sim" : "Não"],
    ["Nível de fidelidade", data.level],
    ["CPF", c.cpf || "—"],
    ["Nascimento", datePt(c.birth_date)],
    ["E-mail", c.email || "—"],
    ["Telefone", c.phone || "—"],
    ["WhatsApp", c.whatsapp || "—"],
    ["Cidade/UF", `${c.city || ""}${c.state ? "/" + c.state : ""}`],
    ["Primeiro contato", datePt(c.first_contact_at)],
    ["Primeira compra", datePt(c.first_purchase_at)],
    ["Última compra", datePt(c.last_purchase_at)],
    ["Número de compras", String(c.purchase_count || 0)],
    ["Total gasto", BRL(c.total_spent_cents || 0)],
    ["Ticket médio", BRL(c.ticket_avg_cents || 0)],
    ["Pontos de fidelidade", String(c.points_balance || 0)],
  ];
  autoTable(doc, { startY: y, body: personal, theme: "grid", styles: { fontSize: 9, cellPadding: 2.5 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 } } });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = sectionHeader(doc, "Compras", y);
  autoTable(doc, {
    startY: y,
    head: [["Data", "Status", "Itens", "Total"]],
    body: data.sales.map((s) => [datePt(s.sale_date), s.status, (s.items || []).map((i) => `${i.product_name} x${i.quantity}`).join(", "), BRL(s.total_cents)]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = sectionHeader(doc, "Cobranças", y);
  autoTable(doc, {
    startY: y,
    head: [["Vencimento", "Valor", "Status"]],
    body: data.charges.map((ch) => [datePt(ch.due_date), BRL(ch.amount_cents), ch.status]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (data.timeline.length) {
    y = sectionHeader(doc, "Linha do tempo", y);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Evento"]],
      body: data.timeline.map((t) => [datePt(t.event_at), `${t.title}${t.description ? " — " + t.description : ""}`]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [29, 92, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (data.notes.length) {
    y = sectionHeader(doc, "Anotações", y);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Anotação"]],
      body: data.notes.map((n) => [datePt(n.created_at), n.note]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [29, 92, 58] },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${i} de ${pages}`, 105, 292, { align: "center" });
    doc.text("Documento gerado pelo SITE DOTERRA", 14, 292);
  }
  doc.save(`cliente-${c.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export async function exportPdfAll(bundle: CrmExportBundle) {
  const doc = new jsPDF();
  const pageW = 210;

  // Cabeçalho
  doc.setFillColor(29, 92, 58);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(bundle.site_name || "Meu Site doTERRA", 14, 14);
  doc.setFontSize(9);
  doc.text(`Relatório do CRM — gerado pelo SITE DOTERRA`, 14, 21);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(`Consultor(a): ${bundle.consultant_name || "—"}`, 14, 38);
  doc.text(`Exportado em: ${new Date(bundle.exported_at).toLocaleString("pt-BR")}`, 14, 44);

  // Resumo
  let y = sectionHeader(doc, "Resumo geral", 52);
  const summaryRows: [string, string][] = [
    ["Clientes cadastrados", String(bundle.clients.length)],
    ["Clientes VIP", String(bundle.clients.filter((c) => c.is_vip).length)],
    ["Vendas registradas", String(bundle.sales.length)],
    ["Faturamento (vendas)", BRL(bundle.sales.filter((s) => s.status !== "Cancelado" && s.status !== "Reembolsado").reduce((a, s) => a + s.total_cents, 0))],
    ["Entradas financeiras", BRL(bundle.financial.filter((f) => f.type === "income").reduce((a, f) => a + f.amount_cents, 0))],
    ["Saídas financeiras", BRL(bundle.financial.filter((f) => f.type === "expense").reduce((a, f) => a + f.amount_cents, 0))],
    ["Cobranças a receber", BRL(bundle.charges.filter((c) => c.status === "Pendente" || c.status === "Vencido").reduce((a, c) => a + c.amount_cents, 0))],
    ["Cobranças pagas", BRL(bundle.charges.filter((c) => c.status === "Pago").reduce((a, c) => a + c.amount_cents, 0))],
    ["Tarefas pendentes", String(bundle.tasks.filter((t) => t.status !== "Concluída").length)],
  ];
  autoTable(doc, {
    startY: y,
    body: summaryRows.map((r) => r),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 100 } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Clientes
  y = sectionHeader(doc, "Clientes", y);
  autoTable(doc, {
    startY: y,
    head: [["Nome", "Categoria", "VIP", "Cidade", "Última compra", "Compras", "Total gasto"]],
    body: bundle.clients.map((c) => [c.name, c.category, c.is_vip ? "Sim" : "Não", c.city || "—", datePt(c.last_purchase_at), String(c.purchase_count || 0), BRL(c.total_spent_cents || 0)]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Vendas
  y = sectionHeader(doc, "Vendas", y);
  autoTable(doc, {
    startY: y,
    head: [["Data", "Cliente", "Status", "Itens", "Desconto", "Total"]],
    body: bundle.sales.map((s) => [
      datePt(s.sale_date), s.client_name || "—", s.status,
      (s.items || []).map((i) => `${i.product_name} x${i.quantity}`).join(", "),
      BRL(s.discount_cents || 0), BRL(s.total_cents),
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Produtos mais vendidos
  y = sectionHeader(doc, "Produtos mais vendidos", y);
  const productMap = new Map<string, { units: number; cents: number }>();
  for (const s of bundle.sales) {
    if (s.status === "Cancelado" || s.status === "Reembolsado") continue;
    for (const it of s.items || []) {
      const cur = productMap.get(it.product_name) || { units: 0, cents: 0 };
      cur.units += it.quantity;
      cur.cents += it.total_cents;
      productMap.set(it.product_name, cur);
    }
  }
  const topProducts = Array.from(productMap.entries()).sort((a, b) => b[1].cents - a[1].cents);
  autoTable(doc, {
    startY: y,
    head: [["Produto", "Quantidade", "Faturamento"]],
    body: topProducts.map(([name, v]) => [name, String(v.units), BRL(v.cents)]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Financeiro
  y = sectionHeader(doc, "Financeiro", y);
  autoTable(doc, {
    startY: y,
    head: [["Data", "Tipo", "Categoria", "Descrição", "Valor"]],
    body: bundle.financial.map((f) => [datePt(f.entry_date), f.type === "income" ? "Entrada" : "Saída", f.category || "—", f.description || "—", BRL((f.type === "income" ? 1 : -1) * f.amount_cents)]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Cobranças
  y = sectionHeader(doc, "Cobranças", y);
  autoTable(doc, {
    startY: y,
    head: [["Cliente", "Vencimento", "Valor", "Status"]],
    body: bundle.charges.map((c) => [c.client_name || "—", datePt(c.due_date), BRL(c.amount_cents), c.status]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Fidelidade
  if (bundle.loyaltyPoints.length) {
    y = sectionHeader(doc, "Fidelidade — histórico de pontos", y);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Cliente", "Pontos", "Tipo", "Descrição"]],
      body: bundle.loyaltyPoints.map((p) => [
        datePt(p.created_at), p.client_name || "—", String(p.amount), p.type, p.description || "—",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [29, 92, 58] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Tarefas
  y = sectionHeader(doc, "Tarefas", y);
  autoTable(doc, {
    startY: y,
    head: [["Título", "Cliente", "Data", "Prioridade", "Status"]],
    body: bundle.tasks.map((t) => [t.title, t.client_name || "—", t.due_date ? datePt(t.due_date) : "—", t.priority, t.status]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 92, 58] },
  });

  // Rodapé + paginação
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${i} de ${pages}`, 105, 292, { align: "center" });
    doc.text("Documento gerado pelo SITE DOTERRA", 14, 292);
  }

  doc.save(`relatorio-crm-${new Date().toISOString().slice(0, 10)}.pdf`);
}