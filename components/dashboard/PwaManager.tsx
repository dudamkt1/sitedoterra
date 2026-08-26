"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaPicker } from "@/components/media/MediaPicker";
import {
  computePwaStatus,
  type PwaSettings,
} from "@/lib/pwa/config";

interface LoadResult {
  settings: PwaSettings;
  slug: string | null;
  customDomains: string[];
}

const LEVEL_STYLES: Record<string, string> = {
  configured: "bg-green-100 text-green-800 border-green-300",
  ready: "bg-blue-100 text-blue-800 border-blue-300",
  incomplete: "bg-amber-100 text-amber-900 border-amber-300",
};

export function PwaManager() {
  const [data, setData] = useState<LoadResult | null>(null);
  const [form, setForm] = useState<PwaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pwa");
        const json = await res.json();
        if (res.ok) {
          setData(json);
          setForm(json.settings);
        } else {
          setMsg({ ok: false, text: json.error || "Erro ao carregar." });
        }
      } catch {
        setMsg({ ok: false, text: "Falha de conexão." });
      }
      setLoading(false);
    })();
  }, []);

  const platformUrl = useMemo(() => {
    if (!data?.slug) return "";
    const base =
      process.env.NEXT_PUBLIC_HOME_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base.replace(/\/$/, "")}/${data.slug}`;
  }, [data]);

  const customUrl = useMemo(() => {
    if (!data?.customDomains?.length) return null;
    return `https://${data.customDomains[0]}/`;
  }, [data]);

  const canonicalUrl = useMemo(() => {
    if (!form) return "";
    return form.canonical === "custom" && customUrl ? customUrl : platformUrl;
  }, [form, customUrl, platformUrl]);

  // QR Code gerado no cliente (funciona também na demonstração)
  useEffect(() => {
    if (!canonicalUrl || !form?.enabled) {
      setQrDataUrl(null);
      return;
    }
    let alive = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(canonicalUrl, { width: 220, margin: 1, color: { dark: "#1a1a14", light: "#ffffff" } }))
      .then((url) => alive && setQrDataUrl(url))
      .catch(() => alive && setQrDataUrl(null));
    return () => {
      alive = false;
    };
  }, [canonicalUrl, form?.enabled]);

  const status = useMemo(
    () => (form ? computePwaStatus(form) : null),
    [form]
  );

  function patch(p: Partial<PwaSettings>) {
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pwa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: "Configurações do aplicativo salvas!" });
      } else {
        setMsg({ ok: false, text: json.error || "Erro ao salvar." });
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão." });
    }
    setSaving(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando configurações...</p>;
  if (!form) return <p className="text-sm text-red-600">{msg?.text || "Não foi possível carregar."}</p>;

  const statusStyle = status ? LEVEL_STYLES[status.level] : "";

  return (
    <div className="space-y-6">
      {/* ---------- Status ---------- */}
      <div className={`card flex items-center justify-between flex-wrap gap-3 border ${statusStyle}`}>
        <span className="font-bold text-sm tracking-wide">{status?.label}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
          {([
            ["Nome", status?.checks.nome],
            ["Logo", status?.checks.logo],
            ["Ícone", status?.checks.icone],
            ["Cores", status?.checks.cores],
            ["Manifest", status?.checks.manifest],
            ["Service Worker", status?.checks.serviceWorker],
          ] as [string, boolean | undefined][]).map(([label, ok]) => (
            <span key={label}>
              {ok ? "✓" : "○"} {label}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- URLs / QR ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">URL do aplicativo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Endereço que o visitante instala. Este é o link que abre o app após instalado.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-3">
            {platformUrl && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
                  URL da plataforma
                </p>
                <p className="text-sm break-all">{platformUrl}</p>
              </div>
            )}

            {customUrl && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
                  Domínio próprio
                </p>
                <p className="text-sm break-all">{customUrl}</p>
              </div>
            )}

            <div className="rounded-lg border-2 p-3" style={{ borderColor: form.theme_color }}>
              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: form.theme_color }}>
                ★ URL principal da PWA (canônica)
              </p>
              <p className="text-sm font-semibold break-all">{canonicalUrl}</p>
              {customUrl && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => patch({ canonical: "platform" })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                      form.canonical === "platform"
                        ? "bg-[#1d5c3a] text-white border-[#1d5c3a]"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Usar plataforma
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ canonical: "custom" })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                      form.canonical === "custom"
                        ? "bg-[#1d5c3a] text-white border-[#1d5c3a]"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Usar domínio próprio
                  </button>
                </div>
              )}
              {!customUrl && (
                <p className="mt-1 text-xs text-gray-400">
                  Vincule um domínio próprio em{" "}
                  <a href="/painel/dominio" className="underline">Domínio</a> para poder usá-lo como principal.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="btn btn-outline !py-2 !px-4 text-xs">
                {copied ? "✓ Copiado!" : "🔗 COPIAR LINK"}
              </button>
              <a href={canonicalUrl} target="_blank" rel="noreferrer" className="btn btn-outline !py-2 !px-4 text-xs">
                ↗ ABRIR APLICATIVO
              </a>
            </div>
          </div>

          {qrDataUrl && (
            <div className="justify-self-center md:justify-self-end text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Code do aplicativo" width={200} height={200} className="rounded-lg border border-gray-200" />
              <p className="text-[0.65rem] text-gray-400 mt-1">Aponte a câmera do celular</p>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Identidade ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Identidade do aplicativo</h2>
        <p className="text-sm text-gray-500 mb-4">Aparece na tela inicial do celular e na loja de apps do navegador.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome do aplicativo</label>
            <input className="input" value={form.app_name} placeholder="ex.: João Consultor"
              onChange={(e) => patch({ app_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Nome curto</label>
            <input className="input" value={form.short_name} placeholder="ex.: João"
              onChange={(e) => patch({ short_name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descrição</label>
            <textarea className="input min-h-[70px]" value={form.description}
              placeholder="Conheça meus produtos e entre em contato."
              onChange={(e) => patch({ description: e.target.value })} />
          </div>
          <div>
            <label className="label">Cor principal</label>
            <div className="flex items-center gap-2">
              <input type="color" className="h-10 w-12 rounded border border-gray-200" value={form.theme_color}
                onChange={(e) => patch({ theme_color: e.target.value })} />
              <input className="input" value={form.theme_color}
                onChange={(e) => patch({ theme_color: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Cor de fundo</label>
            <div className="flex items-center gap-2">
              <input type="color" className="h-10 w-12 rounded border border-gray-200" value={form.background_color}
                onChange={(e) => patch({ background_color: e.target.value })} />
              <input className="input" value={form.background_color}
                onChange={(e) => patch({ background_color: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Logo & Ícones ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Logo e ícone do aplicativo</h2>
        <p className="text-sm text-gray-500 mb-4">
          <strong>Ícone do app (quadrado 1:1):</strong> será usado na tela inicial do celular. Aceita PNG/JPG/WebP com ou sem fundo transparente.
          <br />
          <span className="text-gray-400">Logo (opcional):</span> para uso em outras áreas do painel.
        </p>

        <div className="space-y-5">
          {/* Ícone principal do App (1:1) */}
          <div>
            <label className="label">Ícone do aplicativo <span className="text-xs text-gray-400 font-normal">(quadrado 1:1, ex.: 512×512)</span></label>
            <div className="flex items-center gap-2">
              <input className="input flex-1" value={form.icon_192_url || ""} placeholder="URL ou escolha na biblioteca"
                onChange={(e) => patch({ icon_192_url: e.target.value, icon_512_url: e.target.value })} />
              <MediaPicker scope="tenant" value={form.icon_192_url || undefined}
                onChange={(url) => patch({ icon_192_url: url, icon_512_url: url })} />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Uma única imagem quadrada serve para todos os tamanhos (192×192, 512×512, máscaras adaptáveis).
              Fundo transparente é recomendado, mas não obrigatório.
            </p>
          </div>

          {/* Logo opcional */}
          <div>
            <label className="label">Logo (opcional)</label>
            <div className="flex items-center gap-2">
              <input className="input flex-1" value={form.logo_url || ""} placeholder="URL ou escolha na biblioteca"
                onChange={(e) => patch({ logo_url: e.target.value })} />
              <MediaPicker scope="tenant" value={form.logo_url || undefined}
                onChange={(url) => patch({ logo_url: url })} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Usado em outras áreas do painel. Não afeta o ícone do app no celular.</p>
          </div>

          {!form.icon_192_url && (
            <p className="text-xs text-gray-400">
              Sem ícone enviado, o sistema gera automaticamente um ícone com as cores do app.
            </p>
          )}
        </div>
      </div>

      {/* ---------- Preview ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Prévia</h2>
        <p className="text-sm text-gray-500 mb-4">Aparência aproximada do aplicativo instalado.</p>
        <div className="flex justify-center py-2">
          <div
            className="w-44 rounded-[2rem] border-8 border-gray-900 overflow-hidden shadow-xl"
            style={{ background: form.background_color }}
          >
            <div className="pt-3 pb-2 text-center text-[0.55rem] text-gray-400">9:41</div>
            <div className="mx-auto mt-1 w-20 h-20 rounded-2xl shadow-md overflow-hidden" style={{ background: form.theme_color }}>
              {form.icon_192_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.icon_192_url} alt="Ícone" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
                  {(form.short_name || form.app_name || "A").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="py-2 px-2 text-center">
              <p className="text-[0.7rem] font-semibold truncate" style={{ color: form.theme_color }}>
                {form.short_name || form.app_name || "Meu App"}
              </p>
            </div>
            <div className="pb-3 flex justify-center gap-3">
              <span className="w-8 h-1 rounded-full bg-gray-300 inline-block" />
              <span className="w-8 h-1 rounded-full bg-gray-300 inline-block" />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Ativação + salvar ---------- */}
      <div className="card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="card-title mb-0.5">PWA ativa</h2>
            <p className="text-xs text-gray-500">
              Quando ativa, o site passa a convidar visitantes a instalar o aplicativo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            onClick={() => patch({ enabled: !form.enabled })}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.enabled ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </div>

        {form.canonical === "custom" && !customUrl && (
          <p className="mt-3 text-xs rounded-lg bg-red-50 text-red-700 px-3 py-2">
            Nenhum domínio próprio verificado — a URL da plataforma será usada como principal.
          </p>
        )}

        {msg && (
          <p className={`mt-4 text-sm rounded-lg px-3 py-2 ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {msg.text}
          </p>
        )}

        <div className="mt-5">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
