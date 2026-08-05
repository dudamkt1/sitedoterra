"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/dashboard/ui";
import { formatDateTime } from "@/lib/utils";

export function AdminDomains({ rows }: { rows: any[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function runAction(id: string, action: string) {
    setBusy(id);
    await fetch(`/api/admin/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    window.location.reload();
  }

  const filtered = rows.filter((r) => {
    const q = query.toLowerCase();
    const matchQ = !q || r.domain.includes(q) || (r.email || "").toLowerCase().includes(q) || (r.slug || "").includes(q);
    const matchF = filter === "all" || r.status === filter;
    return matchQ && matchF;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Buscar domínio, usuário ou slug..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input max-w-[180px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="verifying">Verificando</option>
          <option value="verified">Verificado</option>
          <option value="active">Ativo</option>
          <option value="error">Erro</option>
          <option value="blocked">Bloqueado</option>
          <option value="removed">Removido</option>
        </select>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Domínio</th>
                <th>Usuário / Tenant</th>
                <th>Status</th>
                <th>Conexão</th>
                <th>Verificação</th>
                <th>Erro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.domain}</td>
                  <td>
                    <div>{r.name || "—"}</div>
                    <div className="text-xs text-gray-400">{r.email}</div>
                    {r.slug && <div className="text-xs text-gray-400">/{r.slug}</div>}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-xs text-gray-500">{formatDateTime(r.connected_at)}</td>
                  <td className="text-xs text-gray-500">{r.verified_at ? formatDateTime(r.verified_at) : "—"}</td>
                  <td className="text-xs text-red-500 max-w-[220px]">{r.error_message || "—"}</td>
                  <td>
                    <div className="flex gap-1 min-w-[200px]">
                      <button className="btn btn-outline !py-1 !px-2 text-xs" onClick={() => runAction(r.id, "verify")} disabled={busy === r.id}>Verificar</button>
                      {r.status !== "blocked" ? (
                        <button className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => runAction(r.id, "block")} disabled={busy === r.id}>Bloquear</button>
                      ) : (
                        <button className="btn btn-primary !py-1 !px-2 text-xs" onClick={() => runAction(r.id, "unblock")} disabled={busy === r.id}>Liberar</button>
                      )}
                      <button className="btn btn-outline !py-1 !px-2 text-xs" onClick={() => runAction(r.id, "unlink")} disabled={busy === r.id}>Desvincular</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">Nenhum domínio encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
