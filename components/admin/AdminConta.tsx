"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/dashboard/ui";
import { formatDate } from "@/lib/utils";

interface Row {
  profile: any;
  tenant: any;
  subscription: any;
}

export function AdminConta({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function openEdit(r: Row) {
    setEditing(r);
    setEditForm({ name: r.profile.name || "", phone: r.profile.phone || "", email: r.profile.email || "" });
    setNewPassword("");
    setMsg(null);
  }

  async function api(url: string, body: Record<string, unknown>, method = "PATCH") {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  async function saveProfile() {
    if (!editing) return;
    if (!editForm.name.trim()) {
      setMsg({ ok: false, text: "Informe o nome." });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(editForm.email.trim())) {
      setMsg({ ok: false, text: "E-mail inválido." });
      return;
    }
    setBusy(editing.profile.user_id);
    setMsg(null);
    const { ok, json } = await api(`/api/admin/users/${editing.profile.user_id}`, { action: "update_profile", ...editForm });
    setBusy(null);
    if (!ok) { setMsg({ ok: false, text: json.error || "Erro ao salvar." }); return; }
    setMsg({ ok: true, text: "Dados atualizados!" });
    setTimeout(() => window.location.reload(), 600);
  }

  async function savePassword() {
    if (!editing) return;
    if (newPassword.length < 6) { setMsg({ ok: false, text: "Senha precisa ter ao menos 6 caracteres." }); return; }
    setBusy(editing.profile.user_id);
    setMsg(null);
    const { ok, json } = await api(`/api/admin/users/${editing.profile.user_id}`, { action: "set_password", password: newPassword });
    setBusy(null);
    if (!ok) { setMsg({ ok: false, text: json.error || "Erro ao redefinir senha." }); return; }
    setMsg({ ok: true, text: "Senha redefinida!" });
    setNewPassword("");
  }

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#%&*";
    let out = "";
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter((r) => {
      const matchQ = !q || r.profile.email.toLowerCase().includes(q) || (r.profile.name || "").toLowerCase().includes(q) || (r.profile.phone || "").includes(q) || (r.tenant?.slug || "").includes(q);
      const matchS = statusFilter === "all" || r.profile.status === statusFilter;
      return matchQ && matchS;
    });
  }, [rows, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input className="input max-w-xs" placeholder="Buscar por nome, e-mail, telefone ou slug..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending_activation">Aguardando ativação</option>
          <option value="suspended">Suspenso</option>
          <option value="blocked">Bloqueado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} conta(s)</span>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th>Ativação</th>
                <th>Site / Slug</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.profile.user_id}>
                  <td>
                    <div className="font-medium">{r.profile.name || "—"}</div>
                    <div className="text-xs text-gray-400">{r.profile.email}</div>
                  </td>
                  <td className="text-sm">{r.profile.phone || "—"}</td>
                  <td><StatusBadge status={r.profile.status} /></td>
                  <td className="text-xs text-gray-500">{formatDate(r.profile.created_at)}</td>
                  <td className="text-xs text-gray-500">{formatDate(r.profile.activated_at)}</td>
                  <td>
                    <div className="text-xs text-gray-500">{r.tenant ? `/${r.tenant.slug}` : "—"}</div>
                    {r.tenant && <div className="text-xs text-gray-400"><StatusBadge status={r.tenant.site_status} /></div>}
                  </td>
                  <td>
                    <button className="btn btn-outline !py-1 !px-3 text-xs" onClick={() => openEdit(r)}>✎ Editar conta</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">Nenhuma conta encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title">Editar conta</h2>
              <button className="text-gray-400 text-xl" onClick={() => setEditing(null)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{editing.profile.email} · cadastrado em {formatDate(editing.profile.created_at)}</p>

            {msg && <p className={`mb-4 text-sm rounded-lg px-3 py-2 ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>}

            <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-5">
              <section>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Dados da conta</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nome</label>
                    <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Telefone / WhatsApp</label>
                    <input className="input" value={editForm.phone} placeholder="5511999999999" onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">E-mail de acesso</label>
                    <input className="input" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-primary !py-1.5 !px-4 text-xs mt-3" disabled={busy === editing.profile.user_id} onClick={saveProfile}>Salvar dados</button>
              </section>

              <hr className="border-gray-100" />

              <section>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Informações gerais (somente leitura)</p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <dl className="divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Status da conta</dt><dd><StatusBadge status={editing.profile.status} /></dd></div>
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Cadastro</dt><dd className="font-medium">{formatDate(editing.profile.created_at)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Ativação</dt><dd className="font-medium">{formatDate(editing.profile.activated_at)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Cancelamento</dt><dd className="font-medium">{formatDate(editing.profile.cancelled_at)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Suspensão</dt><dd className="font-medium">{formatDate((editing.profile as any).suspended_at)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Bloqueio</dt><dd className="font-medium">{formatDate((editing.profile as any).blocked_at)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-gray-500">Site</dt><dd className="font-medium">{editing.tenant ? `/${editing.tenant.slug}` : "—"} {editing.tenant && <StatusBadge status={editing.tenant.site_status} />}</dd></div>
                  </dl>
                </div>
              </section>

              <hr className="border-gray-100" />

              <section>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Trocar senha</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="label">Nova senha (mín. 6 caracteres)</label>
                    <input className="input" type="text" autoComplete="off" placeholder="Digite ou gere uma senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={() => setNewPassword(generatePassword())}>🎲 Gerar senha</button>
                  <button className="btn btn-primary !py-1.5 !px-4 text-xs" disabled={busy === editing.profile.user_id || newPassword.length < 6} onClick={savePassword}>Redefinir senha</button>
                </div>
                <p className="text-[0.7rem] text-gray-400 mt-2">A nova senha passa a valer imediatamente para o login deste usuário.</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
