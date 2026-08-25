"use client";

import { useMemo, useState } from "react";
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

const SUB_STATUSES = [
  { value: "awaiting_activation", label: "Aguardando ativação" },
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "past_due", label: "Pagamento atrasado" },
  { value: "canceled", label: "Cancelada" },
];

export function AdminUsers({ rows, plans }: { rows: Row[]; plans: any[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  // ---- Modal de edição completa ----
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [editRole, setEditRole] = useState("user");
  const [newPassword, setNewPassword] = useState("");
  const [subStatus, setSubStatus] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ---- Modal de criação ----
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  function openEdit(r: Row) {
    setEditing(r);
    setEditForm({ name: r.profile.name || "", phone: r.profile.phone || "", email: r.profile.email || "" });
    setEditRole(r.profile.role === "superadmin" ? "superadmin" : "user");
    setNewPassword("");
    setSubStatus(r.subscription?.status || "");
    setMsg(null);
  }

  async function api(url: string, body: Record<string, unknown>, method = "PATCH") {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  /** Ações rápidas da tabela: executam e recarregam a página. */
  async function runAction(userId: string, action: string, extra: Record<string, unknown> = {}) {
    if (action === "block" && !window.confirm("Bloquear este usuário? Ele perderá o acesso ao painel e o site sai do ar.")) return;
    setBusy(userId);
    const { ok, json } = await api(`/api/admin/users/${userId}`, { action, ...extra });
    setBusy(null);
    if (!ok) {
      window.alert(json.error || "Erro na operação.");
      return;
    }
    window.location.reload();
  }

  async function deleteUser(userId: string, email: string) {
    if (!window.confirm(`Excluir PERMANENTEMENTE a conta ${email}?\n\nSite, assinatura e CRM serão apagados. Não há como desfazer.`)) return;
    if (!window.confirm("Confirma pela SEGUNDA vez? Esta ação é irreversível.")) return;
    setBusy(userId);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg({ ok: false, text: json.error || "Erro ao excluir." });
      return;
    }
    setEditing(null);
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

  /** Salva uma seção do modal de edição. */
  async function saveSection(action: string, payload: Record<string, unknown>, okText: string) {
    if (!editing) return false;
    setBusy(editing.profile.user_id);
    setMsg(null);
    const { ok, json } = await api(`/api/admin/users/${editing.profile.user_id}`, { action, ...payload });
    setBusy(null);
    if (!ok) {
      setMsg({ ok: false, text: json.error || "Erro ao salvar." });
      return false;
    }
    setMsg({ ok: true, text: okText });
    setTimeout(() => window.location.reload(), 600);
    return true;
  }

  async function createUser() {
    setCreatingUser(true);
    setCreateMsg(null);
    const { ok, json } = await api("/api/admin/users", createForm, "POST");
    setCreatingUser(false);
    if (!ok) {
      setCreateMsg({ ok: false, text: json.error || "Erro ao criar usuário." });
      return;
    }
    setCreateMsg({ ok: true, text: "Usuário criado com sucesso!" });
    setTimeout(() => window.location.reload(), 600);
  }

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = query.toLowerCase();
        const matchQ =
          !q ||
          r.profile.email.toLowerCase().includes(q) ||
          (r.profile.name || "").toLowerCase().includes(q) ||
          (r.tenant?.slug || "").includes(q) ||
          r.domains.some((d) => d.domain.includes(q));
        const matchS = statusFilter === "all" || r.profile.status === statusFilter;
        const matchR = roleFilter === "all" || (r.profile.role || "user") === roleFilter;
        return matchQ && matchS && matchR;
      }),
    [rows, query, statusFilter, roleFilter]
  );

  return (
    <div className="space-y-4">
      {/* ---------- Filtros ---------- */}
      <div className="flex flex-wrap gap-3 items-center">
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
        <select className="input max-w-[180px]" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">Todos os papéis</option>
          <option value="user">Usuários comuns</option>
          <option value="superadmin">Super admins</option>
        </select>
        <button className="btn btn-primary ml-auto" onClick={() => { setCreating(true); setCreateForm({ name: "", email: "", password: "", role: "user" }); setCreateMsg(null); }}>
          ＋ Novo usuário
        </button>
      </div>

      {/* ---------- Tabela ---------- */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Ativação</th>
                <th>Assinatura</th>
                <th>Site / URL</th>
                <th>Cadastro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const p = r.profile;
                const s = r.subscription;
                return (
                  <tr key={p.user_id}>
                    <td>
                      <div className="font-medium">{p.name || "—"}</div>
                      <div className="text-xs text-gray-400">{p.email}</div>
                      {p.phone && <div className="text-xs text-gray-400">{p.phone}</div>}
                    </td>
                    <td>
                      {p.role === "superadmin" ? (
                        <span className="badge bg-[#f6efd8] text-[#8a6a1f] border border-[#e3d3a1] font-semibold">★ Super Admin</span>
                      ) : (
                        <span className="badge badge-gray">Usuário</span>
                      )}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <select
                        className="input !py-1 text-xs min-w-[130px]"
                        value={s?.plan?.id || ""}
                        onChange={(e) => changePlan(p.user_id, e.target.value)}
                        disabled={busy === p.user_id}
                      >
                        <option value="">Alterar plano…</option>
                        {plans.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="text-sm">{r.activation ? formatBRL(r.activation.amount_cents) : "—"}</div>
                      <span className={`badge ${r.activation ? "badge-green" : "badge-yellow"}`}>
                        {r.activation ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 flex-wrap">
                        <StatusBadge status={s?.status || "awaiting_activation"} />
                        {r.tenant?.monthly_billing_enabled === false && (
                          <span className="badge badge-yellow" title="Isento de mensalidade">s/ mensal</span>
                        )}
                      </div>
                      {s?.next_billing_at && (
                        <div className="text-xs text-gray-400 mt-1">Próx.: {formatDate(s.next_billing_at)}</div>
                      )}
                    </td>
                    <td>
                      <div className="text-xs text-gray-500">{r.url}</div>
                      {r.tenant && (
                        <div className="text-xs text-gray-400">site: <StatusBadge status={r.tenant.site_status} /></div>
                      )}
                    </td>
                    <td className="text-xs text-gray-500">{r.registeredAt}</td>
                    <td>
                      <div className="flex flex-col gap-1 min-w-[150px]">
                        <button className="btn btn-outline !py-1 !px-2 text-xs" onClick={() => openEdit(r)}>
                          ✎ Editar completo
                        </button>
                        <div className="flex gap-1">
                          {p.status !== "blocked" ? (
                            <button className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "block")} disabled={busy === p.user_id}>Bloquear</button>
                          ) : (
                            <button className="btn btn-primary !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "unblock")} disabled={busy === p.user_id}>Desbloquear</button>
                          )}
                          {!r.tenant ? null : r.tenant.site_status !== "active" && p.status !== "blocked" ? (
                            <button className="btn btn-gold !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "activate_site", { billing: "none" })} disabled={busy === p.user_id}>Ativar site</button>
                          ) : (
                            <button className="btn btn-outline !py-1 !px-2 text-xs" onClick={() => runAction(p.user_id, "suspend")} disabled={busy === p.user_id}>Suspender site</button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center text-gray-400 py-8">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- MODAL: editar usuário completo ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title">Editar usuário</h2>
              <button className="text-gray-400 text-xl" onClick={() => setEditing(null)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {editing.profile.email} · cadastrado em {editing.registeredAt}
            </p>

            {msg && (
              <p className={`mb-4 text-sm rounded-lg px-3 py-2 ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {msg.text}
              </p>
            )}

            <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-5">
              {/* ----- Dados pessoais ----- */}
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
                <button
                  className="btn btn-primary !py-1.5 !px-4 text-xs mt-3"
                  disabled={busy === editing.profile.user_id}
                  onClick={() => saveSection("update_profile", editForm, "Dados salvos com sucesso!")}
                >
                  Salvar dados
                </button>
              </section>

              <hr className="border-gray-100" />

              {/* ----- Papel ----- */}
              <section>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Papel na plataforma</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px]">
                    <label className="label">Tipo de usuário</label>
                    <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                      <option value="user">Usuário comum (acesso ao próprio painel)</option>
                      <option value="superadmin">Super Admin (acesso total ao /admin)</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-outline !py-1.5 !px-4 text-xs"
                    disabled={busy === editing.profile.user_id}
                    onClick={() => saveSection("set_role", { role: editRole }, editRole === "superadmin" ? "Promovido a Super Admin!" : "Agora é usuário comum.")}
                  >
                    Salvar papel
                  </button>
                </div>
                {editRole === "superadmin" && (
                  <p className="mt-2 text-xs rounded-lg bg-[#fdf6e3] text-[#8a6a1f] px-3 py-2">
                    ⚠️ Super Admin tem acesso irrestrito: usuários, planos, pagamentos, IA e configurações globais.
                  </p>
                )}
              </section>

              <hr className="border-gray-100" />

              {/* ----- Senha ----- */}
              <section>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Nova senha</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="label">Definir nova senha (mín. 6 caracteres)</label>
                    <input
                      className="input"
                      type="text"
                      autoComplete="off"
                      placeholder="Digite ou gere uma senha forte"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline !py-1.5 !px-3 text-xs"
                    onClick={() => setNewPassword(generatePassword())}
                  >
                    🎲 Gerar senha
                  </button>
                  <button
                    className="btn btn-primary !py-1.5 !px-4 text-xs"
                    disabled={busy === editing.profile.user_id || newPassword.length < 6}
                    onClick={() => saveSection("set_password", { password: newPassword }, "Senha redefinida! Compartilhe com segurança.")}
                  >
                    Redefinir senha
                  </button>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* ----- Site, cobrança e assinatura ----- */}
              <section>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Site, cobrança e assinatura</p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">
                        Mensalidade {editing.tenant?.monthly_billing_enabled === false ? "isenta" : "habilitada"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {editing.tenant?.monthly_billing_enabled === false
                          ? "Este usuário NÃO será cobrado pela recorrência."
                          : "Recorrência ativa conforme o plano."}
                      </p>
                    </div>
                    <button
                      className={`btn ${editing.tenant?.monthly_billing_enabled === false ? "btn-gold" : "btn-outline"} !py-1.5 !px-3 text-xs`}
                      disabled={busy === editing.profile.user_id || !editing.tenant}
                      onClick={() =>
                        saveSection(
                          "toggle_monthly",
                          { enabled: editing.tenant?.monthly_billing_enabled === false },
                          editing.tenant?.monthly_billing_enabled === false ? "Mensalidade habilitada." : "Usuário isento de mensalidade."
                        )
                      }
                    >
                      {editing.tenant?.monthly_billing_enabled === false ? "💰 Habilitar mensalidade" : "🚫 Isentar de mensalidade"}
                    </button>
                  </div>

                  <hr className="border-gray-200/60" />

                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="min-w-[200px]">
                      <label className="label">Status da assinatura</label>
                      <select className="input" value={subStatus} onChange={(e) => setSubStatus(e.target.value)}>
                        {!editing.subscription && <option value="">— sem assinatura —</option>}
                        {SUB_STATUSES.map((st) => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-outline !py-1.5 !px-4 text-xs"
                      disabled={busy === editing.profile.user_id || !editing.subscription || !subStatus || subStatus === editing.subscription?.status}
                      onClick={() => saveSection("set_subscription_status", { status: subStatus }, "Status da assinatura atualizado.")}
                    >
                      Aplicar status
                    </button>
                    <div className="text-xs text-gray-400">
                      Plano atual: <strong className="text-gray-600">{editing.subscription?.plan?.name || "—"}</strong>
                      {editing.subscription?.plan && <> · {formatBRL(editing.subscription.plan.monthly_price_cents)}/mês</>}
                    </div>
                  </div>

                  <hr className="border-gray-200/60" />

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">Status do site</p>
                      <p className="text-xs text-gray-400">
                        {editing.tenant ? `/${editing.tenant.slug}` : "sem site"} ·{" "}
                        {editing.tenant ? <StatusBadge status={editing.tenant.site_status} /> : "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {editing.tenant?.site_status !== "active" ? (
                        <>
                          <button className="btn btn-primary !py-1.5 !px-3 text-xs" disabled={busy === editing.profile.user_id} onClick={() => runAction(editing.profile.user_id, "activate_site", { billing: "monthly" })}>
                            Ativar (mensal)
                          </button>
                          <button className="btn btn-gold !py-1.5 !px-3 text-xs" disabled={busy === editing.profile.user_id} onClick={() => runAction(editing.profile.user_id, "activate_site", { billing: "none" })}>
                            Ativar (sem mensal)
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-outline !py-1.5 !px-3 text-xs" disabled={busy === editing.profile.user_id} onClick={() => runAction(editing.profile.user_id, "suspend")}>
                          Suspender site
                        </button>
                      )}
                      {editing.profile.status === "blocked" ? (
                        <button className="btn btn-primary !py-1.5 !px-3 text-xs" disabled={busy === editing.profile.user_id} onClick={() => runAction(editing.profile.user_id, "unblock")}>
                          Desbloquear acesso
                        </button>
                      ) : (
                        <button className="btn btn-danger !py-1.5 !px-3 text-xs" disabled={busy === editing.profile.user_id} onClick={() => runAction(editing.profile.user_id, "block")}>
                          Bloquear acesso
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-gray-400">
                    Bloquear impede o login imediatamente (banimento real na conta de autenticação) e tira o site do ar.
                  </p>

                  <hr className="border-gray-200/60" />

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm text-red-700">Zona de risco</p>
                      <p className="text-xs text-gray-400">
                        Exclui PERMANENTEMENTE a conta, o site, o CRM e todos os dados deste usuário.
                      </p>
                    </div>
                    <button
                      className="btn btn-danger !py-1.5 !px-3 text-xs"
                      disabled={busy === editing.profile.user_id}
                      onClick={() => deleteUser(editing.profile.user_id, editForm.email)}
                    >
                      🗑 Excluir conta
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MODAL: novo usuário ---------- */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-lg my-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title">Criar novo usuário</h2>
              <button className="text-gray-400 text-xl" onClick={() => setCreating(false)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              A conta já nasce com site próprio (URL temporária) e acesso liberado ao painel.
            </p>

            {createMsg && (
              <p className={`mb-4 text-sm rounded-lg px-3 py-2 ${createMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {createMsg.text}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={createForm.name} placeholder="ex.: Maria Silva" onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input className="input" type="email" value={createForm.email} placeholder="maria@email.com" onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Senha inicial (mín. 6 caracteres)</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="text" autoComplete="off" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
                  <button type="button" className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={() => setCreateForm({ ...createForm, password: generatePassword() })}>
                    🎲 Gerar
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Papel</label>
                <select className="input" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="user">Usuário comum</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                className="btn btn-primary"
                disabled={creatingUser || !createForm.name || !createForm.email || createForm.password.length < 6}
                onClick={createUser}
              >
                {creatingUser ? "Criando..." : "Criar usuário"}
              </button>
              <button className="btn btn-outline" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Gera uma senha legível e forte (12 caracteres). */
function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#%&*";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
}
