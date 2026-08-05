"use client";

import { useEffect, useState } from "react";

interface SiteManagerProps {
  slug: string;
  pendingSlug: boolean;
  siteData: Record<string, any>;
  siteStatus: string;
  appUrl: string;
  hasSubscription: boolean;
}

export function SiteManager({ slug, pendingSlug, siteData, appUrl, hasSubscription }: SiteManagerProps) {
  const [newSlug, setNewSlug] = useState(pendingSlug ? "" : slug);
  const [slugCheck, setSlugCheck] = useState<null | { slug: string; valid: boolean; available: boolean; reason?: string }>(null);
  const [checking, setChecking] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    name: siteData?.name || "",
    surname: siteData?.surname || "",
    role: siteData?.role || "",
    eyebrow: siteData?.eyebrow || "",
    description: siteData?.description || "",
    whatsapp: siteData?.whatsapp || "",
    email: siteData?.email || "",
    instagram: siteData?.instagram || "",
    instagramHandle: siteData?.instagramHandle || "",
    statYears: siteData?.stats?.years || "",
    statClients: siteData?.stats?.clients || "",
    statSatisfaction: siteData?.stats?.satisfaction || "",
  });
  const [savingSite, setSavingSite] = useState(false);
  const [siteMsg, setSiteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const publicUrl = newSlug || slug;

  useEffect(() => {
    if (!newSlug) {
      setSlugCheck(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(newSlug)}`);
      const data = await res.json();
      setSlugCheck(data);
      setChecking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [newSlug]);

  async function saveSlug() {
    setSavingSlug(true);
    setSlugMsg(null);
    const res = await fetch("/api/slug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug }),
    });
    const data = await res.json();
    if (res.ok) {
      setSlugMsg({ ok: true, text: "Nome de usuário salvo! Sua URL foi atualizada." });
    } else {
      setSlugMsg({ ok: false, text: data.error || "Erro ao salvar." });
    }
    setSavingSlug(false);
  }

  async function saveSite() {
    setSavingSite(true);
    setSiteMsg(null);
    const res = await fetch("/api/site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        surname: form.surname,
        fullName: `${form.name} ${form.surname}`.trim() || undefined,
        role: form.role,
        eyebrow: form.eyebrow,
        description: form.description,
        whatsapp: form.whatsapp.replace(/[^\d]/g, ""),
        email: form.email,
        instagram: form.instagram,
        instagramHandle: form.instagramHandle,
        stats: {
          years: form.statYears,
          labelYears: "Anos de experiência",
          clients: form.statClients,
          labelClients: "Clientes atendidas",
          satisfaction: form.statSatisfaction,
          labelSatisfaction: "Satisfação",
        },
      }),
    });
    const data = await res.json();
    setSiteMsg(data.success ? { ok: true, text: "Conteúdo do site salvo com sucesso!" } : { ok: false, text: "Erro ao salvar." });
    setSavingSite(false);
  }

  const field = (key: keyof typeof form, label: string, placeholder: string, type = "text") => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ---------- Nome de usuário / URL ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Nome de usuário e URL</h2>
        <p className="text-sm text-gray-500 mb-4">
          Seu site público ficará disponível em <strong>{appUrl}/{publicUrl || "seu-usuario"}</strong>.
          Use letras, números e hífens. Não pode ter espaços nem duplicar outro usuário.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Nome de usuário</label>
            <input
              className="input"
              value={newSlug}
              placeholder="ex.: joao, maria, anabeatriz"
              onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            />
          </div>
          <button className="btn btn-primary" disabled={!slugCheck?.available || savingSlug} onClick={saveSlug}>
            {savingSlug ? "Salvando..." : "Salvar"}
          </button>
        </div>

        <div className="mt-2 min-h-6 text-sm">
          {checking && newSlug && <span className="text-gray-400">Verificando...</span>}
          {!checking && slugCheck && (
            <span className={slugCheck.available ? "text-green-600" : "text-red-600"}>
              {slugCheck.available ? "✓ Disponível! URL: " + appUrl + "/" + slugCheck.slug : slugCheck.reason}
            </span>
          )}
        </div>

        {slugMsg && (
          <p className={`mt-2 text-sm rounded-lg px-3 py-2 ${slugMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {slugMsg.text}
          </p>
        )}

        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">URL pública atual</p>
          <a href={`/${publicUrl}`} target="_blank" className="text-sm text-[#1d5c3a] underline break-all">
            {appUrl}/{publicUrl} ↗
          </a>
          {!hasSubscription && (
            <p className="mt-2 text-xs text-gray-400">O site entra no ar após a ativação da assinatura.</p>
          )}
        </div>
      </div>

      {/* ---------- Conteúdo do site ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Informações do site</h2>
        <p className="text-sm text-gray-500 mb-5">Estas informações aparecem no seu site público.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("name", "Nome", "ex.: Ana")}
          {field("surname", "Sobrenome", "ex.: Beatriz")}
          {field("role", "Título / Cargo", "ex.: Consultora Wellness Diamond · doTERRA")}
          {field("eyebrow", "Subtítulo do topo", "ex.: Consultora Certificada doTERRA")}
          {field("whatsapp", "WhatsApp (com DDI)", "ex.: 5511999999999")}
          {field("email", "E-mail", "voce@email.com", "email")}
          {field("instagram", "Usuário do Instagram (sem @)", "anabeatriz.doterra")}
          {field("instagramHandle", "Mostrar como (com @)", "@anabeatriz.doterra")}
          <div className="sm:col-span-2">
            <label className="label">Descrição principal</label>
            <textarea
              className="input min-h-24"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Fale sobre você e seu trabalho com óleos essenciais..."
            />
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {field("statYears", "Anos de experiência", "7+")}
            {field("statClients", "Clientes atendidas", "850+")}
            {field("statSatisfaction", "Satisfação", "98%")}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button className="btn btn-primary" onClick={saveSite} disabled={savingSite}>
            {savingSite ? "Salvando..." : "Salvar conteúdo"}
          </button>
          {siteMsg && (
            <span className={`text-sm ${siteMsg.ok ? "text-green-600" : "text-red-600"}`}>{siteMsg.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}
