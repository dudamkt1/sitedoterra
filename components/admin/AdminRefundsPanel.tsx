"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Modal, StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";

export interface RefundRow {
  id: string;
  tenant_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  mercadopago_payment_id: string | null;
  email: string;
  name: string;
  phone: string;
  slug: string;
  site_status: string;
}

const PAGE_SIZE = 20;

function waDigits(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function defaultMessage(name: string, amountCents: number): string {
  const who = name && name !== "—" ? `Olá ${name}!` : "Olá!";
  const amount = formatBRL(amountCents);
  return (
    `${who} Aqui é da equipe TopConsultores. ` +
    `Vimos que você solicitou o reembolso da ativação do seu site (${amount}) ` +
    `e queríamos conversar antes de concluir: aconteceu algo que a gente possa resolver? ` +
    `Seu site segue no ar e estamos à disposição!`
  );
}

function defaultEmailSubject(): string {
  return "Sobre seu pedido de reembolso — TopConsultores";
}

function defaultEmailBody(name: string, amountCents: number): string {
  const who = name && name !== "—" ? `Olá ${name}!` : "Olá!";
  const amount = formatBRL(amountCents);
  return (
    `${who}\n\n` +
    `Aqui é da equipe TopConsultores. Vimos que você solicitou o reembolso da ativação do seu site (${amount}) ` +
    `e gostaríamos de conversar antes de concluir: tem algo que possamos resolver para você continuar?\n\n` +
    `Seu site segue no ar e estamos à disposição!`
  );
}

export function AdminRefundsPanel({ rows }: { rows: RefundRow[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmAuth, setConfirmAuth] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [waRow, setWaRow] = useState<RefundRow | null>(null);
  const [waText, setWaText] = useState("");
  /** E-mail como 2ª opção (quando o usuário não tem WhatsApp). */
  const [emailRow, setEmailRow] = useState<RefundRow | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.email.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const awaitingCount = rows.filter((r) => r.status === "refund_pending").length;

  function openWhatsApp(row: RefundRow) {
    setWaText(defaultMessage(row.name, row.amount_cents));
    setWaRow(row);
  }

  function openEmail(row: RefundRow) {
    setEmailSubject(defaultEmailSubject());
    setEmailBody(defaultEmailBody(row.name, row.amount_cents));
    setEmailRow(row);
  }

  async function authorize(paymentId: string) {
    setActingId(paymentId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/refunds/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Não foi possível autorizar agora." });
      } else {
        setMsg({ ok: true, text: data.message || "Reembolso autorizado." });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setMsg({ ok: false, text: "Não foi possível autorizar agora." });
    } finally {
      setActingId(null);
      setConfirmAuth(null);
    }
  }

  async function reject(paymentId: string) {
    setActingId(paymentId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/refunds/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Não foi possível reverter agora." });
      } else {
        setMsg({ ok: true, text: data.message || "Pedido revertido." });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setMsg({ ok: false, text: "Não foi possível reverter agora." });
    } finally {
      setActingId(null);
      setConfirmReject(null);
    }
  }

  return (
    <div className="card !p-0 overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Pedidos de Reembolso</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Garantia de 7 dias: converse no WhatsApp e tente reverter antes — só autorize quando mantido o pedido.
            Após autorizado, o MP devolve e o site é desativado (dados preservados).
          </p>
        </div>
        <Link href="/admin/financeiro" className="text-xs text-[#1d5c3a] underline">
          Ver financeiro →
        </Link>
      </div>

      <div className="px-6 py-3 border-b border-gray-100">
        <input
          className="input"
          value={search}
          placeholder="Filtrar por usuário (nome, e-mail ou /site)..."
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {msg && (
        <p className={`mx-6 mt-3 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-400">
          {rows.length === 0 ? "Nenhum pedido de reembolso." : "Nenhum usuário encontrado para este filtro."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Data</th><th>Usuário</th><th>Site</th><th>Valor</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const pending = r.status === "refund_pending";
                  const digits = waDigits(r.phone);
                  return (
                    <tr key={r.id}>
                      <td className="text-xs">{formatDateTime(r.created_at)}</td>
                      <td className="text-xs">
                        <p className="font-semibold break-all">{r.name !== "—" ? r.name : r.email}</p>
                        <p className="text-gray-400 break-all">{r.email}</p>
                      </td>
                      <td className="text-xs">/{r.slug} ({r.site_status})</td>
                      <td>{formatBRL(r.amount_cents)}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {pending ? (
                            <>
                              {confirmAuth === r.id ? (
                                <>
                                  <button type="button" className="btn btn-gold !py-1.5 !px-3 !text-xs" onClick={() => authorize(r.id)} disabled={actingId === r.id}>
                                    {actingId === r.id ? "Autorizando..." : "Confirmar devolução"}
                                  </button>
                                  <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setConfirmAuth(null)} disabled={actingId === r.id}>
                                    Voltar
                                  </button>
                                </>
                              ) : confirmReject === r.id ? (
                                <>
                                  <button type="button" className="btn btn-primary !py-1.5 !px-3 !text-xs" onClick={() => reject(r.id)} disabled={actingId === r.id}>
                                    {actingId === r.id ? "Revertendo..." : "Confirmar reversão"}
                                  </button>
                                  <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setConfirmReject(null)} disabled={actingId === r.id}>
                                    Voltar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-gold !py-1.5 !px-3 !text-xs" onClick={() => setConfirmAuth(r.id)} disabled={actingId !== null}>
                                    Autorizar reembolso
                                  </button>
                                  <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setConfirmReject(r.id)} disabled={actingId !== null}>
                                    Reverter pedido
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">Concluído</span>
                          )}
                          {digits ? (
                            <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openWhatsApp(r)}>
                              💬 Enviar mensagem
                            </button>
                          ) : (
                            <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openEmail(r)} title={`Enviar e-mail para ${r.email}`}>
                              ✉️ Enviar e-mail
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              {filtered.length} pedido(s){awaitingCount > 0 ? ` (${awaitingCount} aguardando)` : ""} — página {safePage + 1} de {totalPages}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline !py-1.5 !px-4 !text-xs" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                  ← Voltar
                </button>
                <button type="button" className="btn btn-outline !py-1.5 !px-4 !text-xs" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                  Avançar →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {waRow && (
        <Modal open onClose={() => setWaRow(null)} title={`Conversar com ${waRow.name !== "—" ? waRow.name : waRow.email}`}>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              A mensagem abre no WhatsApp de <strong>{waRow.phone}</strong> — edite como quiser antes de enviar.
            </p>
            <textarea
              className="input min-h-32"
              value={waText}
              onChange={(e) => setWaText(e.target.value)}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn btn-primary flex-1 !py-3"
                onClick={() => {
                  const digits = waDigits(waRow.phone);
                  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(waText)}`, "_blank", "noopener");
                  setWaRow(null);
                }}
              >
                💬 Abrir WhatsApp e enviar
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setWaRow(null)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {emailRow && (
        <Modal open onClose={() => setEmailRow(null)} title={`Enviar e-mail para ${emailRow.name !== "—" ? emailRow.name : emailRow.email}`}>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              Sem WhatsApp cadastrado — a conversa segue pelo e-mail <strong>{emailRow.email}</strong>. Edite como quiser antes de enviar.
            </p>
            <div>
              <label className="label !mb-1">Assunto</label>
              <input
                className="input"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <textarea
              className="input min-h-32"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                className="btn btn-primary flex-1 !py-3 text-center"
                href={`mailto:${encodeURIComponent(emailRow.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                onClick={() => setEmailRow(null)}
              >
                ✉️ Abrir e-mail e enviar
              </a>
              <button type="button" className="btn btn-outline" onClick={() => setEmailRow(null)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
