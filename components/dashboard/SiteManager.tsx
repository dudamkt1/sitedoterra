"use client";

import { useEffect, useState } from "react";
import { MediaPicker } from "@/components/media/MediaPicker";

interface SiteManagerProps {
  slug: string;
  pendingSlug: boolean;
  siteData: Record<string, any>;
  siteStatus: string;
  appUrl: string;
  hasSubscription: boolean;
}

const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram", placeholder: "ex.: https://instagram.com/seuperfil" },
  { key: "facebook", label: "Facebook", placeholder: "ex.: https://facebook.com/seuperfil" },
  { key: "youtube", label: "YouTube", placeholder: "ex.: https://youtube.com/@seucanal" },
] as const;

type SocialState = Record<"instagram" | "facebook" | "youtube", { enabled: boolean; url: string }>;

function normalizeSocial(raw: Record<string, any> | null | undefined): SocialState {
  const s = raw || {};
  const read = (key: "instagram" | "facebook" | "youtube") => {
    const v = s[key];
    if (v && typeof v === "object") return { enabled: v.enabled !== false, url: v.url || "" };
    return { enabled: v === true, url: "" };
  };
  return { instagram: read("instagram"), facebook: read("facebook"), youtube: read("youtube") };
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
    badgeTitle: siteData?.badgeTitle || "",
    badgeSubtitle: siteData?.badgeSubtitle || "",
    whatsapp: siteData?.whatsapp || "",
    email: siteData?.email || "",
    instagram: siteData?.instagram || "",
    instagramHandle: siteData?.instagramHandle || "",
    logoMode: siteData?.logoMode || (siteData?.logoUrl ? "image" : ""),
    logoUrl: siteData?.logoUrl || "",
    logoText: siteData?.logoText || "",
    statYears: siteData?.stats?.years || "",
    statClients: siteData?.stats?.clients || "",
    statSatisfaction: siteData?.stats?.satisfaction || "",
    social: normalizeSocial(siteData?.social),
  });
  const [logoTouched, setLogoTouched] = useState(false);
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

  function updateLogo(patch: Partial<typeof form>) {
    setLogoTouched(true);
    setForm({ ...form, ...patch });
  }

  async function saveSite() {
    setSavingSite(true);
    setSiteMsg(null);
    const payload: Record<string, unknown> = {
      name: form.name,
      surname: form.surname,
      fullName: `${form.name} ${form.surname}`.trim() || undefined,
      role: form.role,
      eyebrow: form.eyebrow,
      description: form.description,
      badgeTitle: form.badgeTitle,
      badgeSubtitle: form.badgeSubtitle,
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
      social: {
        instagram: { enabled: form.social.instagram.enabled, url: form.social.instagram.url },
        facebook: { enabled: form.social.facebook.enabled, url: form.social.facebook.url },
        youtube: { enabled: form.social.youtube.enabled, url: form.social.youtube.url },
      },
    };
    // Só envia a logo se o usuário mexeu no card — assim quem não configura
    // continua herdando a logo padrão definida no template global (Super Admin).
    if (logoTouched) {
      payload.logoMode = form.logoMode;
      payload.logoUrl = form.logoUrl || undefined;
      payload.logoText = form.logoText || undefined;
    }
    const res = await fetch("/api/site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

      {/* ---------- Logo do site ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Logo do site</h2>
        <p className="text-sm text-gray-500 mb-4">
          A logo aparece no menu superior do seu site. Escolha uma <strong>imagem</strong> ou use o <strong>texto</strong>.
        </p>

        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-semibold text-gray-500">Exibir como:</span>
          {(["text", "image"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn !py-1.5 !px-4 !text-sm ${form.logoMode === mode ? "btn-primary" : "btn-outline"}`}
              onClick={() => updateLogo({ logoMode: mode })}
            >
              {mode === "image" ? "🖼️ Imagem" : "🔤 Texto"}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          {form.logoMode
            ? "Sua escolha substitui a logo da plataforma no seu site."
            : "Sem logo própria: seu site usa a logo padrão da plataforma."}
        </p>

        {form.logoMode === "image" && (
          <div className="mb-4">
            <label className="label">Imagem da logo</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input flex-1"
                value={form.logoUrl}
                placeholder="URL da imagem ou escolha na biblioteca"
                onChange={(e) => updateLogo({ logoUrl: e.target.value })}
              />
              <MediaPicker
                scope="tenant"
                value={form.logoUrl || undefined}
                onChange={(url) => updateLogo({ logoUrl: url })}
              />
            </div>
            {form.logoUrl && (
              <div className="mt-2 rounded-lg bg-gray-50 p-3 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logoUrl} alt="Logo" className="h-10 w-auto max-w-56 object-contain" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500">
              <strong className="text-gray-700">Dica:</strong> envie um arquivo <strong>PNG ou SVG</strong> com fundo
              transparente, em formato horizontal (ex.: <strong>200×48px</strong>). O logo será exibido com até{" "}
              <strong>220px de largura e 44px de altura</strong>.
            </div>
          </div>
        )}

        <div>
          <label className="label">Nome / Texto do logo</label>
          <input
            type="text"
            className="input"
            value={form.logoText}
            placeholder="ex.: Ana Beatriz"
            onChange={(e) => updateLogo({ logoText: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">
            Usado quando a exibição é por texto (e como texto alternativo da imagem).
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button className="btn btn-primary" onClick={saveSite} disabled={savingSite}>
            {savingSite ? "Salvando..." : "Salvar logo"}
          </button>
          {siteMsg && (
            <span className={`text-sm ${siteMsg.ok ? "text-green-600" : "text-red-600"}`}>{siteMsg.text}</span>
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
          <button className="btn btn-primary" onClick={saveSite} disabled={savingSite}>
            {savingSite ? "Salvando..." : "Salvar conteúdo"}
          </button>
          {siteMsg && (
            <span className={`text-sm ${siteMsg.ok ? "text-green-600" : "text-red-600"}`}>{siteMsg.text}</span>
          )}
        </div>
      </div>

      {/* ---------- Redes sociais ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Redes sociais</h2>
        <p className="text-sm text-gray-500 mb-5">
          Ative as redes que aparecem no rodapé do seu site e informe o endereço. Os links abrem sempre em uma nova aba.
        </p>

        <div className="space-y-3">
          {SOCIAL_NETWORKS.map((net) => {
            const item = form.social[net.key];
            return (
              <div key={net.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{net.label}</p>
                    <p className="text-xs text-gray-400 break-all">{net.placeholder}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, social: { ...form.social, [net.key]: { ...item, enabled: !item.enabled } } })}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${item.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                    title={item.enabled ? "Desativar" : "Ativar"}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${item.enabled ? "left-[1.4rem]" : "left-0.5"}`} />
                  </button>
                </div>
                {item.enabled && (
                  <input
                    type="url"
                    className="input mt-3"
                    value={item.url}
                    placeholder={net.placeholder}
                    onChange={(e) => setForm({ ...form, social: { ...form.social, [net.key]: { ...item, url: e.target.value } } })}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button className="btn btn-primary" onClick={saveSite} disabled={savingSite}>
            {savingSite ? "Salvando..." : "Salvar redes sociais"}
          </button>
          {siteMsg && (
            <span className={`text-sm ${siteMsg.ok ? "text-green-600" : "text-red-600"}`}>{siteMsg.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}
