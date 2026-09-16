"use client";

import { MEDIA_OPTIMIZE_CONFIG } from "./optimize-config";

/**
 * NAVEGADOR — compressão ANTES do upload (o PUT direto ao R2 nunca passa pelo
 * servidor, então a otimização desse caminho acontece aqui).
 *
 * - Imagens: canvas (resize p/ `maxImageDimension` + WebP q`imageQuality`).
 *   Canvas re-encoda sem EXIF → metadados removidos de graça.
 * - Vídeos: ffmpeg.wasm single-thread (`@ffmpeg/core-st`, sem COOP/COEP),
 *   lazy-load SÓ quando um vídeo é enviado + thumbnail (poster) do frame do
 *   meio via <video> + canvas.
 * - Qualquer falha → fallback: envia o ORIGINAL (nunca trava o upload), com
 *   `console.warn` para sabermos que aconteceu.
 */

export type PreparedKind = "image" | "video" | "other";

export interface PreparedFile {
  blob: Blob;
  fileName: string;
  mimeType: string;
  kind: PreparedKind;
  optimized: boolean;
  /** Thumbnail do vídeo (jpeg), quando gerado. */
  poster?: Blob;
}

export type OptimizeStageHandler = (
  stage: "optimizing" | "uploading",
  detail?: string
) => void;

function swapExtension(name: string, ext: string): string {
  const base = (name || "arquivo").replace(/\.[a-z0-9]+$/i, "");
  return `${base || "arquivo"}.${ext}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

function loadImageEl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      if (ok) resolve(img);
      else reject(new Error("decode"));
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
    setTimeout(() => done(false), 15000);
  });
}

/** Compressão de imagem via canvas. Nunca lança (retorna o original). */
async function compressImageBrowser(
  file: File
): Promise<{ blob: Blob; ext: string; mime: string; skipped: boolean }> {
  const cfg = MEDIA_OPTIMIZE_CONFIG;
  const asIs = { blob: file as unknown as Blob, ext: "", mime: file.type, skipped: true };
  try {
    if (file.size < cfg.skipImageBelowBytes) return asIs;

    let w = 0;
    let h = 0;
    let bmp: ImageBitmap | null = null;
    let img: HTMLImageElement | null = null;
    try {
      if (typeof createImageBitmap === "function") {
        bmp = await createImageBitmap(file);
        w = bmp.width;
        h = bmp.height;
      } else {
        throw new Error("no-bitmap");
      }
    } catch {
      img = await loadImageEl(file);
      w = img.naturalWidth || (img as HTMLImageElement).width;
      h = img.naturalHeight || (img as HTMLImageElement).height;
    }
    if (!w || !h) return asIs;

    const scale = Math.min(1, cfg.maxImageDimension / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return asIs;
    if (bmp) {
      ctx2d.drawImage(bmp, 0, 0, tw, th);
      try { bmp.close(); } catch { /* noop */ }
    } else if (img) {
      ctx2d.drawImage(img, 0, 0, tw, th);
    }

    const q = cfg.imageQuality / 100;
    let out = await canvasToBlob(canvas, "image/webp", q);
    let mime = "image/webp";
    let ext = "webp";
    if (!out) {
      out = await canvasToBlob(canvas, "image/jpeg", q);
      mime = "image/jpeg";
      ext = "jpg";
    }
    if (!out || out.size >= file.size) return asIs;
    return { blob: out, ext, mime, skipped: false };
  } catch (e) {
    console.warn("[media] compressão de imagem no browser falhou — enviando original", e);
    return asIs;
  }
}

// ============================ VÍDEO (ffmpeg.wasm) ============================

// Instância única (o core pesa ~30MB — carrega 1x por sessão).
let ffmpegInstance: any = null;
let ffmpegLoading: Promise<any> | null = null;

function wasmSupported(): boolean {
  try {
    return typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  } catch {
    return false;
  }
}

async function getFFmpeg(): Promise<any> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoading) {
    ffmpegLoading = (async () => {
      const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
      const v = MEDIA_OPTIMIZE_CONFIG.ffmpegCoreStVersion;
      const inst = createFFmpeg({
        corePath: `https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@${v}/dist/ffmpeg-core.js`,
        log: false,
      });
      await inst.load();
      ffmpegInstance = inst;
      return inst;
    })().catch((e) => {
      ffmpegLoading = null;
      throw e;
    });
  }
  return ffmpegLoading;
}

function probeVideo(file: File): Promise<{ w: number; h: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("probe-timeout"));
    }, 15000);
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      const out = {
        w: v.videoWidth || 0,
        h: v.videoHeight || 0,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
      };
      URL.revokeObjectURL(url);
      if (!out.w || !out.h) reject(new Error("probe-dims"));
      else resolve(out);
    };
    v.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("probe-error"));
    };
    v.src = url;
  });
}

function even(n: number): number {
  const r = Math.round(n);
  return r % 2 === 0 ? Math.max(2, r) : Math.max(2, r - 1);
}

/** Thumbnail/poster do vídeo (frame do meio) via <video> + canvas. */
export async function makeVideoPoster(file: File): Promise<Blob | null> {
  try {
    const cfg = MEDIA_OPTIMIZE_CONFIG;
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    const poster: Blob | null = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 15000);
      v.onloadedmetadata = () => {
        try {
          v.currentTime = v.duration && Number.isFinite(v.duration) && v.duration > 1
            ? v.duration / 2
            : 0.1;
        } catch {
          clearTimeout(timer);
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      v.onseeked = () => {
        clearTimeout(timer);
        try {
          const scale = Math.min(1, cfg.videoPosterWidth / (v.videoWidth || cfg.videoPosterWidth));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round((v.videoWidth || 0) * scale)) || cfg.videoPosterWidth;
          canvas.height = Math.max(1, Math.round((v.videoHeight || 0) * scale)) || 360;
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          ctx2d.drawImage(v, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvasToBlob(canvas, "image/jpeg", 0.7).then(resolve);
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      v.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      v.src = url;
    });
    return poster;
  } catch (e) {
    console.warn("[media] thumbnail do vídeo falhou", e);
    return null;
  }
}

/** Compressão de vídeo via ffmpeg.wasm. Lança em falha (chamador faz fallback). */
async function compressVideoBrowser(
  file: File,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (!wasmSupported()) throw new Error("WebAssembly indisponível");
  const cfg = MEDIA_OPTIMIZE_CONFIG;
  const probe = await probeVideo(file);

  const scale = Math.min(1, cfg.maxVideoWidth / probe.w, cfg.maxVideoHeight / probe.h);
  const tw = even(probe.w * scale);
  const th = even(probe.h * scale);

  const { fetchFile } = await import("@ffmpeg/ffmpeg");
  const ff = await getFFmpeg();
  const inName = `input${/\.webm$/i.test(file.name) ? ".webm" : ".mp4"}`;
  const outName = "output.mp4";
  try {
    ff.setProgress(({ ratio }: { ratio: number }) => {
      if (onProgress && Number.isFinite(ratio)) {
        onProgress(Math.max(0, Math.min(99, Math.round(ratio * 100))));
      }
    });
  } catch { /* versões sem setProgress */ }
  try {
    ff.FS("writeFile", inName, await fetchFile(file));
    await ff.run(
      "-i", inName,
      "-vf", `scale=${tw}:${th}`,
      "-c:v", "libx264",
      "-preset", cfg.videoPreset,
      "-crf", String(cfg.videoCrf),
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outName
    );
    const data = ff.FS("readFile", outName);
    const blob = new Blob([data.buffer ? data.slice(0) : data] as BlobPart[], { type: "video/mp4" });
    if (!blob.size) throw new Error("saída vazia");
    return blob;
  } finally {
    try { ff.FS("unlink", inName); } catch { /* noop */ }
    try { ff.FS("unlink", outName); } catch { /* noop */ }
    try { ff.setProgress(() => {}); } catch { /* noop */ }
  }
}

// ============================ ORQUESTRADOR ============================

/**
 * Prepara um arquivo para upload: valida tetos, comprime (ou pula) e ajusta
 * nome/extensão/MIME para o resultado. Nunca lança por causa da COMPRESSÃO
 * (fallback = original); lança apenas se passar dos tetos de segurança.
 */
export async function prepareFileForUpload(
  file: File,
  opts?: { onStage?: OptimizeStageHandler }
): Promise<PreparedFile> {
  const cfg = MEDIA_OPTIMIZE_CONFIG;
  const mime = (file.type || "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const plain = {
    blob: file as unknown as Blob,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    optimized: false,
  };

  const isSvg = mime === "image/svg+xml" || /\.svg$/i.test(file.name || "");
  // SVG é vetorial: viaja INTACTO (sem rasterizar no canvas) para preservar
  // nitidez infinita — e sobe pelo servidor, que sanitiza antes do R2.
  if (isSvg) {
    if (file.size > 1024 * 1024) {
      throw new Error("SVG muito grande (máximo 1 MB). Otimize o vetor e tente de novo.");
    }
    return { ...plain, kind: "image" as const };
  }

  if (isImage) {
    if (file.size > cfg.maxImageInputBytes) {
      throw new Error("Imagem muito grande (máximo 20 MB). Reduza o arquivo e tente de novo.");
    }
    opts?.onStage?.("optimizing", "Otimizando imagem...");
    const r = await compressImageBrowser(file);
    if (r.skipped) return { ...plain, kind: "image" as const };
    return {
      blob: r.blob,
      fileName: swapExtension(file.name, r.ext),
      mimeType: r.mime,
      kind: "image",
      optimized: true,
    };
  }

  if (isVideo) {
    if (file.size > cfg.maxVideoInputBytes) {
      throw new Error("Vídeo muito grande (máximo 100 MB). Corte o vídeo e tente de novo.");
    }
    let poster: Blob | undefined;
    try {
      const p = await makeVideoPoster(file);
      if (p) poster = p;
    } catch (e) {
      console.warn("[media] poster do vídeo falhou", e);
    }
    if (file.size < cfg.skipVideoBelowBytes) {
      return { ...plain, kind: "video" as const, poster };
    }
    opts?.onStage?.("optimizing", "Otimizando vídeo... 0%");
    try {
      const blob = await compressVideoBrowser(file, (pct) =>
        opts?.onStage?.("optimizing", `Otimizando vídeo... ${pct}%`)
      );
      if (blob.size >= file.size) {
        return { ...plain, kind: "video" as const, optimized: false, poster };
      }
      return {
        blob,
        fileName: swapExtension(file.name, "mp4"),
        mimeType: "video/mp4",
        kind: "video",
        optimized: true,
        poster,
      };
    } catch (e) {
      console.warn("[media] ffmpeg.wasm falhou — enviando vídeo original", e);
      return { ...plain, kind: "video" as const, poster };
    }
  }

  return { ...plain, kind: "other" as const };
}
