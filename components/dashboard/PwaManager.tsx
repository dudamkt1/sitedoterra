"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// Limites para o ícone PWA. PWA exige imagens quadradas ≥ 192px; Android
// 512+ é altamente recomendado para a tela inicial. Aceitamos PNG (com ou
// sem fundo transparente), JPEG e WebP — SVG não (risco de XSS e Chrome não
// aceita SVG como purpose=any no manifest).
const ICON_MIME = /^image\/(png|jpe?g|webp)$/i;
const ICON_MIN = 192;
const ICON_RECOMMENDED = 512;

async function probeImage(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function PwaManager() {
  const [data, setData] = useState<LoadResult | null>(null);
  const [form, setForm] = useState<PwaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [iconInfo, setIconInfo] = useState<{ width: number; height: number; isSquare: boolean; isPngLike: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Quando o ícone mudar, valida dimensões e formato
  const iconUrl = form?.icon_512_url || form?.icon_192_url || form?.icon_180_url || form?.icon_maskable_512_url;
  useEffect(() => {
    if (!iconUrl) {
      setIconInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const probe = await probeImage(iconUrl);
      if (cancelled || !probe) return;
      const isPngLike = ICON_MIME.test(iconUrl) || /\.(png|jpe?g|webp)($|\?)/i.test(iconUrl);
      setIconInfo({
        width: probe.width,
        height: probe.height,
        isSquare: probe.width === probe.height,
        isPngLike,
      });
    })();
    return () => { cancelled = true; };
  }, [iconUrl]);

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

  // --- Gera variantes de ícone (Canvas) e faz upload de todas ---
  async function processAndUploadIconVariants(file: File) {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
        setMsg({ ok: false, text: `Formato "${file.type || "desconhecido"}}" não suportado. Use PNG (com ou sem fundo), JPG ou WebP.` });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMsg({ ok: false, text: "Arquivo muito grande. Limite de 5 MB para o ícone do PWA." });
        return;
      }

      // Carrega a imagem em um Image bitmap para processamento no Canvas
      const localUrl = URL.createObjectURL(file);
      const img = await createImageBitmap(await fetch(localUrl).then(r => r.blob()));
      URL.revokeObjectURL(localUrl);

      const width = img.width;
      const height = img.height;

      if (width < ICON_MIN || height < ICON_MIN) {
        setMsg({
          ok: false,
          text: `A imagem tem ${width}×${height}px. O ícone do PWA precisa ter no mínimo ${ICON_MIN}×${ICON_MIN}px. Use uma imagem quadrada maior (recomendado ${ICON_RECOMMENDED}×${ICON_RECOMMENDED}px).`,
        });
        return;
      }
      if (width !== height) {
        setMsg({
          ok: false,
          text: `A imagem tem ${width}×${height}px (não é quadrada). O ícone do PWA precisa ser quadrado (ex.: 512×512). Recorte a imagem antes de enviar.`,
        });
        return;
      }

      // Gera as variantes usando Canvas
      const variants = await generateIconVariants(img);
      
      // Upload de todas as variantes em paralelo
      setMsg({ ok: true, text: "Enviando variantes do ícone..." });
      const uploadedUrls = await Promise.all(
        Object.entries(variants).map(async ([key, blob]) => {
          const fd = new FormData();
          fd.append("file", blob, `icon-${key}.png`);
          fd.append("category", "logo"); // categoria "logo" (limite 5 MB, pasta logo)
          const res = await fetch("/api/media/upload", { method: "POST", body: fd });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || `Erro ao enviar ${key}`);
          return { key, url: json.file?.public_url };
        })
      );

      // Mapeia URLs de volta para os campos
      const urlMap = Object.fromEntries(uploadedUrls.map(({ key, url }) => [key, url]));
      patch({
        icon_192_url: urlMap.icon_192,
        icon_512_url: urlMap.icon_512,
        icon_180_url: urlMap.icon_180,
        icon_maskable_512_url: urlMap.icon_maskable_512,
      });

      setMsg({ ok: true, text: "✓ Ícone enviado e variantes geradas! Clique em \"Salvar configurações\" para aplicar." });
    } catch (err) {
      console.error("Erro ao processar/upload ícone:", err);
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Falha ao processar ou enviar imagem." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Gera 4 variantes a partir da imagem original (ImageBitmap):
  // - 180x180 (apple-touch-icon iOS)
  // - 192x192 (Android legacy)
  // - 512x512 (Android splash/home)
  // - 512x512 maskable (com safe zone ~10% padding, fundo preenchido)
  async function generateIconVariants(source: ImageBitmap): Promise<Record<string, Blob>> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const variants: Record<string, Blob> = {};

    // Helper: desenha imagem redimensionada mantendo proporção (já é quadrada)
    async function drawResized(targetSize: number, backgroundColor?: string): Promise<Blob> {
      canvas.width = targetSize;
      canvas.height = targetSize;
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetSize, targetSize);
      }
      ctx.drawImage(source, 0, 0, targetSize, targetSize);
      return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    }

    // Helper: gera versão maskable com safe zone (padding 10% = 10% de cada lado livre)
    // A máscara do Android corta para squircle/círculo; precisamos que o conteúdo
    // principal caiba dentro de 80% (safe zone). Desenhamos a imagem original
    // em 80% do canvas (centralizada) e preenchemos o resto com a cor de fundo.
    async function drawMaskable(targetSize: number, backgroundColor: string): Promise<Blob> {
      canvas.width = targetSize;
      canvas.height = targetSize;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, targetSize, targetSize);
      const safeSize = Math.floor(targetSize * 0.8); // 80% = safe zone
      const offset = (targetSize - safeSize) / 2;
      ctx.drawImage(source, offset, offset, safeSize, safeSize);
      return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    }

    // 1) 180x180 — Apple Touch Icon (iOS)
    variants.icon_180 = await drawResized(180);

    // 2) 192x192 — Android legacy minimum
    variants.icon_192 = await drawResized(192);

    // 3) 512x512 — Android splash/home screen (alta densidade)
    variants.icon_512 = await drawResized(512);

    // 4) 512x512 maskable — com safe zone e fundo da PWA
    // Usa background_color do formulário (ou tema padrão)
    const bgColor = form?.background_color || "#faf8f2";
    variants.icon_maskable_512 = await drawMaskable(512, bgColor);

    return variants;
  }

  async function uploadPwaIcon(file: File) {
    // Redireciona para o novo fluxo de variantes
    return processAndUploadIconVariants(file);
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
        setMsg({ ok: true, text: "✓ Logo atualizado com sucesso! O ícone aparecerá na próxima vez que os usuários abrirem o app instalado." });
        if (json.settings) {
          setForm(json.settings);
        }
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
  const currentIcon = form.icon_512_url || form.icon_192_url;

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
        <h2 className="card-title mb-1">Logo do PWA</h2>
        <p className="text-sm text-gray-500 mb-4">
          <strong>Envie o logotipo que aparecerá no aplicativo instalado no celular.</strong>
          <br />
          Use uma imagem <b>quadrada</b> (mesma largura e altura) de pelo menos <b>512×512 px</b> para melhor qualidade na tela inicial (mínimo 192×192 px).
          Aceita <b>PNG com ou sem fundo transparente</b>, JPG ou WebP.
        </p>

        <div className="space-y-5">
          {/* Ícone principal do App (1:1) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="label">Ícone do aplicativo <span className="text-xs text-gray-400 font-normal">(quadrado 1:1)</span></label>
                <div className="flex items-center gap-2">
                  <input className="input flex-1" value={form.icon_512_url || ""} placeholder="URL do ícone (envie ou escolha na biblioteca)"
                    onChange={(e) => patch({ icon_192_url: e.target.value, icon_512_url: e.target.value, icon_180_url: e.target.value, icon_maskable_512_url: e.target.value })} />
                  <MediaPicker scope="tenant" value={form.icon_512_url || undefined}
                    onChange={(url) => patch({ icon_192_url: url, icon_512_url: url, icon_180_url: url, icon_maskable_512_url: url })} />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Recomendado 512×512 px (mínimo 192×192). PNG transparente é suportado.
                  <br />Ao enviar, o sistema gera automaticamente: 180×180 (iOS), 192×192, 512×512 e 512×512 maskable.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <label className="label">Subir novo ícone</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPwaIcon(f);
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#1d5c3a]/30 bg-[#eaf6ec] hover:bg-[#d8efe1] text-[#103d28] text-[13px] font-semibold px-4 py-2.5 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-[#103d28]/30 border-t-[#103d28] animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>📤 Enviar / Substituir</>
                  )}
                </button>
              </div>
            </div>

            {/* Status do ícone atual */}
            {currentIcon && (
              <div className="mt-3 rounded-[12px] border border-[#e2e8e0] bg-white p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentIcon} alt="Ícone atual" className="w-14 h-14 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <p className="text-[#0d3320] font-semibold">Ícone atual</p>
                  {iconInfo ? (
                    <p className="text-[#4a5a52] mt-0.5">
                      {iconInfo.width}×{iconInfo.height}px
                      {" · "}
                      <span className={iconInfo.isSquare ? "text-emerald-700" : "text-amber-700"}>
                        {iconInfo.isSquare ? "quadrada" : "⚠️ não é quadrada"}
                      </span>
                      {" · "}
                      <span className={iconInfo.isPngLike ? "text-emerald-700" : "text-slate-500"}>
                        {iconInfo.isPngLike ? "formato suportado" : "formato razoável (PNG/JPG/WebP recomendado)"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[#8a9a8e] mt-0.5">verificando…</p>
                  )}
                  <p className="text-[#8a9a8e] mt-0.5 truncate">{currentIcon}</p>
                </div>
                <button
                  type="button"
                  onClick={() => patch({ icon_192_url: null, icon_512_url: null, icon_180_url: null, icon_maskable_512_url: null })}
                  className="shrink-0 text-[11.5px] font-semibold text-red-600 hover:text-red-800"
                >
                  Remover
                </button>
              </div>
            )}

            {/* Status das variantes geradas */}
            {(form.icon_192_url || form.icon_512_url || form.icon_180_url || form.icon_maskable_512_url) && (
              <details className="mt-3 group">
                <summary className="cursor-pointer text-xs font-medium text-[#4a5a52] hover:text-[#103d28] flex items-center gap-1">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  Variantes geradas automaticamente
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[#6a7a72]">
                  <div className="flex items-center gap-1.5">
                    <span className={form.icon_180_url ? "text-emerald-600" : "text-slate-400"}>●</span>
                    <span>180×180 (iOS)</span>
                    {form.icon_180_url && <span className="text-emerald-600">✓</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={form.icon_192_url ? "text-emerald-600" : "text-slate-400"}>●</span>
                    <span>192×192 (Android)</span>
                    {form.icon_192_url && <span className="text-emerald-600">✓</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={form.icon_512_url ? "text-emerald-600" : "text-slate-400"}>●</span>
                    <span>512×512 (Android)</span>
                    {form.icon_512_url && <span className="text-emerald-600">✓</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={form.icon_maskable_512_url ? "text-emerald-600" : "text-slate-400"}>●</span>
                    <span>512×512 maskable</span>
                    {form.icon_maskable_512_url && <span className="text-emerald-600">✓</span>}
                  </div>
                </div>
              </details>
            )}

            {!currentIcon && (
              <p className="mt-2 text-xs text-amber-700">
                Sem ícone enviado, o sistema gera automaticamente um ícone com as cores do app.
              </p>
            )}
          </div>

          {/* Logo opcional */}
          <div>
            <label className="label">Logo (opcional, para uso no painel)</label>
            <div className="flex items-center gap-2">
              <input className="input flex-1" value={form.logo_url || ""} placeholder="URL ou escolha na biblioteca"
                onChange={(e) => patch({ logo_url: e.target.value })} />
              <MediaPicker scope="tenant" value={form.logo_url || undefined}
                onChange={(url) => patch({ logo_url: url })} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Usado em outras áreas do painel. Não afeta o ícone do app no celular.</p>
          </div>
        </div>
      </div>

      {/* ---------- Preview ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Prévia</h2>
        <p className="text-sm text-gray-500 mb-4">Aparência aproximada do aplicativo instalado no celular.</p>
        <div className="flex justify-center py-2">
          <div
            className="w-44 rounded-[2rem] border-8 border-gray-900 overflow-hidden shadow-xl"
            style={{ background: form.background_color }}
          >
            <div className="pt-3 pb-2 text-center text-[0.55rem] text-gray-400">9:41</div>
            <div className="mx-auto mt-1 w-20 h-20 rounded-2xl shadow-md overflow-hidden flex items-center justify-center" style={{ background: form.theme_color }}>
              {currentIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentIcon} alt="Ícone" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
        <p className="text-[11px] text-center text-slate-400 mt-2">
          Aparência ilustrativa. O Android aplica máscara automática (squircle/círculo) no ícone.
        </p>
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

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
          <p className="text-[11.5px] text-slate-500">
            Após salvar, o novo ícone aparece no app instalado na próxima abertura (cache invalidado automaticamente).
          </p>
        </div>
      </div>
    </div>
  );
}
