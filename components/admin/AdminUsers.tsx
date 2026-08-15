"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDate } from "@/lib/utils";

interface Row {
  profile: any;
  tenant: any;
  subscription: any;
  activation: any;
  domains: any[];
  registeredAt: string;
  activatedAt: string;
  nextBilling: string;
  url: string;
}

export function AdminUsers({ rows, plans }: { rows: Row[]; plans: any[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function runAction(userId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(null);
    window.location.reload();
  }

  async function changePlan(userId: string, planId: string) {
    if (!planId) return;
    setBusy(userId);
    await fetch(`/api/admin/users/${userId}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    setBusy(null);
    window.location.reload();
  }

  const filtered = rows.filter((r) => {
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      r.profile.email.toLowerCase().includes(q) ||
      (r.profile.name || "").toLowerCase().includes(q) ||
      (r.tenant?.slug || "").includes(q) ||
      r.domains.some((d) => d.domain.includes(q));
    const matchS = statusFilter === "all" || r.profile.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Buscar por nome, e-mail, slug ou domínio..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending_activation">Aguardando ativação</option>
          <option value="suspended">Suspenso</option>
          <option value="blocked">Bloqueado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Ativação (R$ 297)</th>
                <th>Assinatura</th>
                <th>Site / URL</th>
                <th>Domínio</th>
                <th>Cadastro</th>
                <th>Próx. cobrança</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const p = r.profile;
                const s = r.subscription;
                const dom = r.domains.find((d) => d.status !== "removed");
                const activation = r.activation;
                return (
                  <tr key={p.user_id}>
                    <td>
                      <div className="font-medium">{p.name || "—"}</div>
                      <div className="text-xs text-gray-400">{p.email}</div>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <div className="text-sm">{s?.plan?.name || "—"}</div>
                      <div className="text-xs text-gray-400">{s?.plan ? formatBRL(s.plan.monthly_price_cents) + "/mês" : ""}</div>
                    </td>
                    <td>
                      <div className="text-sm">{activation ? formatBRL(activation.amount_cents) : "—"}</div>
                      <div className="mt-1">
                        <span className={`badge ${activation ? "badge-green" : "badge-yellow"}`}>
                          {activation ? "Pago" : "Pendente"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={s?.status || "awaiting_activation"} />
                        {r.tenant?.monthly_billing_enabled === false && (
                          <span className="badge badge-yellow" title="Ativo sem mensalidade (isenção)">
                            s/ mensal
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-xs text-gray-500">{r.url}</div>
                      {r.tenant && (
                        <div className="text-xs text-gray-400">site: <StatusBadge status={r.tenant.site_status} /></div>
                      )}
                    </td>
                    <td>
                      {dom ? (
                        <div>
                          <div className="text-xs">{dom.domain}</div>
                          <div className="mt-1"><StatusBadge status={dom.status} /></div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500">
                      {r.registeredAt}
                      <div className="text-gray-400 mt-1">Ativação: {r.activatedAt}</div>
                    </td>
                    <td className="text-xs text-gray-500">{r.nextBilling}</td>
                    <td>
                      <div className="flex flex-col gap-1 min-w-[150px]">
                        <select
                          className="input !py-1 text-xs"
                          value={s?.plan?.id || ""}
                          onChange={(e) => changePlan(p.user_id, e.target.value)}
                          disabled={busy === p.user_id}
                        >
                          <option value="">Alterar plano…</option>
                          {plans.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                        </select>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-primary !py-1 !px-2 text-xs"
                            onClick={() => runAction(p.user_id, "activate_site", { billing: "monthly" })}
                            disabled={busy === p.user_id}
                          >
                            Ativar (mensal)
                          </button>
                          <button
                            className="btn btn-gold !py-1 !px-2 text-xs"
                            onClick={() => runAction(p.user_id, "activate_site", { billing: "none" })}
                            disabled={busy === p.user_id}
                          >
                            Ativar (sem mensal)
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {p.status !== "blocked" ? (
                            <button className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "block")} disabled={busy === p.user_id}>Bloquear</button>
                          ) : (
                            <button className="btn btn-primary !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "unblock")} disabled={busy === p.user_id}>Desbloquear</button>
                          )}
                          {p.status !== "suspended" ? (
                            <button className="btn btn-outline !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "suspend")} disabled={busy === p.user_id}>Suspender</button>
                          ) : (
                            <button className="btn btn-gold !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "unsuspend")} disabled={busy === p.user_id}>Reativar</button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center text-gray-400 py-8">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
