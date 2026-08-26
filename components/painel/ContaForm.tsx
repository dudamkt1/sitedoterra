"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/dashboard/ui";
import { formatDate } from "@/lib/utils";

type Props = {
  profile: {
    user_id: string;
    name: string | null;
    email: string;
    phone: string | null;
    status: string;
    created_at: string;
    activated_at: string | null;
    cancelled_at: string | null;
    suspended_at?: string | null;
    blocked_at?: string | null;
  };
  isDemo?: boolean;
};

export default function ContaForm({ profile, isDemo }: Props) {
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [msgProfile, setMsgProfile] = useState<{ ok: boolean; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [msgPass, setMsgPass] = useState<{ ok: boolean; text: string } | null>(null);

  const hasProfileChanges =
    name.trim() !== (profile.name || "") ||
    email.trim().toLowerCase() !== (profile.email || "").toLowerCase() ||
    phone.trim() !== (profile.phone || "");

  async function saveProfile() {
    if (!name.trim()) {
      setMsgProfile({ ok: false, text: "Informe seu nome." });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setMsgProfile({ ok: false, text: "E-mail inválido." });
      return;
    }
    setSavingProfile(true);
    setMsgProfile(null);
    try {
      const res = await fetch("/api/conta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_profile", name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgProfile({ ok: false, text: json.error || "Erro ao salvar." });
        return;
      }
      setMsgProfile({ ok: true, text: "Dados atualizados com sucesso!" });
      setTimeout(() => window.location.reload(), 700);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      setMsgPass({ ok: false, text: "A nova senha precisa ter ao menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsgPass({ ok: false, text: "As senhas não coincidem." });
      return;
    }
    setSavingPass(true);
    setMsgPass(null);
    try {
      const res = await fetch("/api/conta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", password: newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgPass({ ok: false, text: json.error || "Erro ao trocar senha." });
        return;
      }
      setMsgPass({ ok: true, text: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Dados editáveis */}
      <div className="card">
        <h2 className="card-title mb-1">Dados da conta</h2>
        <p className="text-xs text-gray-400 mb-4">Atualize seu nome, e-mail e telefone. As alterações são aplicadas imediatamente.</p>

        {isDemo && (
          <p className="mb-4 text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2 border border-amber-100">
            Demonstração: as alterações ficam salvas apenas neste dispositivo (localStorage) e não afetam contas reais.
          </p>
        )}

        {msgProfile && (
          <p className={`mb-4 text-sm rounded-lg px-3 py-2 ${msgProfile.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {msgProfile.text}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Nome completo</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <label className="label">E-mail de acesso</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            <p className="text-[0.7rem] text-gray-400 mt-1">Ao trocar o e-mail você passará a usar o novo para entrar.</p>
          </div>
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={savingProfile || !hasProfileChanges}
            onClick={saveProfile}
          >
            {savingProfile ? "Salvando..." : "Salvar alterações"}
          </button>
          {hasProfileChanges && <span className="text-xs text-amber-600">Há alterações não salvas</span>}
        </div>
      </div>

      {/* Informações gerais (somente leitura) */}
      <div className="card">
        <h2 className="card-title mb-4">Informações gerais</h2>
        <dl className="divide-y divide-gray-100 text-sm">
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Status da conta</dt>
            <dd className="font-medium"><StatusBadge status={profile.status} /></dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Cadastro</dt>
            <dd className="font-medium text-gray-800">{formatDate(profile.created_at)}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Ativação</dt>
            <dd className="font-medium text-gray-800">{formatDate(profile.activated_at)}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Cancelamento</dt>
            <dd className="font-medium text-gray-800">{formatDate(profile.cancelled_at)}</dd>
          </div>
          {(profile as any).suspended_at !== undefined && (
            <div className="flex justify-between py-3">
              <dt className="text-gray-500">Suspensão</dt>
              <dd className="font-medium text-gray-800">{formatDate((profile as any).suspended_at)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-gray-400">
          Os dados da conta são preservados mesmo após cancelamento ou suspensão. Em caso de bloqueio, entre em contato com o suporte.
        </p>
      </div>

      {/* Trocar senha */}
      <div className="card">
        <h2 className="card-title mb-1">Trocar senha</h2>
        <p className="text-xs text-gray-400 mb-4">Defina uma nova senha de acesso. Você continuará logado neste dispositivo.</p>

        {msgPass && (
          <p className={`mb-4 text-sm rounded-lg px-3 py-2 ${msgPass.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {msgPass.text}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nova senha (mín. 6 caracteres)</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            className="btn btn-outline"
            disabled={savingPass || !newPassword || !confirmPassword}
            onClick={changePassword}
          >
            {savingPass ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </div>
    </div>
  );
}
