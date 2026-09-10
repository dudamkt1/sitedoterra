"use client";

import { useEffect, useState } from "react";

/**
 * "Informações do site" do SITE OFICIAL (Super Admin → /admin/editor-home).
 *
 * Espelha 1:1 o card "Informações do site" do painel (SiteManager) — mesmos
 * campos, rótulos e placeholders — mas lê/grava via /api/admin/home-site no
 * tenant oficial exibido na HOME `/`.
 */

interface HomeSiteForm {
  name: string;
  surname: string;
  role: string;
  eyebrow: string;
  description: string;
  badgeTitle: string;
  badgeSubtitle: string;
  whatsapp: string;
  whatsapp_floating_enabled: boolean;
  email: string;
  instagram: string;
  instagramHandle: string;
  statYears: string;
  statClients: string;
  statSatisfaction: string;
}

const EMPTY_FORM: HomeSiteForm = {
  name: "",
  surname: "",
  role: "",
  eyebrow: "",
  description: "",
  badgeTitle: "",
  badgeSubtitle: "",
  whatsapp: "",
  whatsapp_floating_enabled: false,
  email: "",
  instagram: "",
  instagramHandle: "",
  statYears: "",
  statClients: "",
  statSatisfaction: "",
};

function fromSiteData(siteData: Record<string, any>): HomeSiteForm {
  return {
    name: siteData?.name || "",
    surname: siteData?.surname || "",
    role: siteData?.role || "",
    eyebrow: siteData?.eyebrow || "",
    description: siteData?.description || "",
    badgeTitle: siteData?.badgeTitle || "",
    badgeSubtitle: siteData?.badgeSubtitle || "",
    whatsapp: siteData?.whatsapp || "",
    whatsapp_floating_enabled: siteData?.whatsapp_floating_enabled ?? false,
    email: siteData?.email || "",
    instagram: siteData?.instagram || "",
    instagramHandle: siteData?.instagramHandle || "",
    statYears: siteData?.stats?.years || "",
    statClients: siteData?.stats?.clients || "",
    statSatisfaction: siteData?.stats?.satisfaction || "",
  };
}

export function HomeSiteInfo() {
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [form, setForm] = useState<HomeSiteForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/home-site");
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || "Não foi possível carregar as informações do site oficial.");
          return;
        }
        setTenantSlug(data.tenant?.slug || null);
        setForm(fromSiteData((data.siteData as Record<string, any>) || {}));
      } catch {
        setLoadError("Falha de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/home-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          surname: form.surname,
          fullName: `${form.name} ${form.surname}`.trim() || undefined,
          role: form.role,
          eyebrow: form.eyebrow,
          description: form.description,
          badgeTitle: form.badgeTitle,
          badgeSubtitle: form.badgeSubtitle,
          whatsapp: form.whatsapp,
          whatsapp_floating_enabled: form.whatsapp_floating_enabled,
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
      setMsg(
        res.ok && data.success
          ? { ok: true, text: "Informações do site oficial salvas com sucesso!" }
          : { ok: false, text: data.error || "Erro ao salvar." }
      );
    } catch {
      setMsg({ ok: false, text: "Falha de conexão com o servidor." });
    }
    setSaving(false);
  }

  const field = (key: keyof HomeSiteForm, label: string, placeholder: string, type = "text") => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={form[key] as string}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        <h2 className="card-title mb-1">Informações do site</h2>
        <p className="text-sm text-gray-500">Carregando informações do site oficial...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card">
        <h2 className="card-title mb-1">Informações do site</h2>
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title mb-1">Informações do site</h2>
      <p className="text-sm text-gray-500 mb-5">
        Estas informações aparecem na HOME oficial do site
        {tenantSlug ? (
          <>
            {" "}(<strong>{tenantSlug}</strong>)
          </>
        ) : null}
        . Os mesmos campos do painel do usuário.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field("name", "Nome", "ex.: Ana")}
        {field("surname", "Sobrenome", "ex.: Beatriz")}
        {field("role", "Título / Cargo", "ex.: Consultora Wellness Diamond · doTERRA")}
        {field("eyebrow", "Subtítulo do topo", "ex.: Consultora Certificada doTERRA")}
        {field("whatsapp", "WhatsApp (com DDI)", "ex.: 5511999999999")}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">Botão flutuante de WhatsApp</p>
              <p className="text-xs text-gray-400">Exibe um botão fixo no canto inferior direito do site para contato direto.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, whatsapp_floating_enabled: !form.whatsapp_floating_enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.whatsapp_floating_enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
              title={form.whatsapp_floating_enabled ? "Desativar" : "Ativar"}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.whatsapp_floating_enabled ? "left-[1.4rem]" : "left-0.5"}`} />
            </button>
          </div>
          {form.whatsapp_floating_enabled && !form.whatsapp && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ O botão flutuante está ativado, mas não há WhatsApp cadastrado. Preencha o campo WhatsApp acima para que o botão funcione.
            </p>
          )}
        </div>
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
        <div className="sm:col-span-2">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Selo sobre a foto</p>
          <p className="text-xs text-gray-400 mb-2">Aparece flutuando sobre a foto no topo do seu site (ex.: &quot;Certified Wellness&quot;).</p>
        </div>
        {field("badgeTitle", "Título do selo", "ex.: Certified Wellness")}
        {field("badgeSubtitle", "Subtítulo do selo", "ex.: Expert em bem-estar")}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field("statYears", "Anos de experiência", "7+")}
          {field("statClients", "Clientes atendidas", "850+")}
          {field("statSatisfaction", "Satisfação", "98%")}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar conteúdo"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
