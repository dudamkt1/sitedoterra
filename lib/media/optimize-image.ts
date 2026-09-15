import "server-only";
import sharp from "sharp";
import { MEDIA_OPTIMIZE_CONFIG } from "./optimize-config";

/**
 * SERVIDOR — otimização central de imagens com sharp (ANTES do PUT no R2).
 *
 * - Aplica a orientação EXIF e REMOVE metadados (privacidade + peso).
 * - Redimensiona para no máximo `maxImageDimension` no lado maior (sem ampliar).
 * - Converte para WebP (qualidade `imageQuality`); PNG COM transparência é
 *   mantido PNG (otimizado) para não quebrar logos com fundo transparente.
 * - Não animações: WebP/GIF animado passa ileso (não quebra o conteúdo).
 * - Arquivo já pequeno E dentro das dimensões: devolvido intacto (`skipped`).
 *
 * Nunca lança: em qualquer falha, devolve o buffer original (o upload segue).
 */
export interface OptimizedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  skipped: boolean;
  originalBytes: number;
  outputBytes: number;
}

export async function optimizeImage(input: Buffer): Promise<OptimizedImage> {
  const originalBytes = input.length;
  const passthrough = (
    width: number | null = null,
    height: number | null = null
  ): OptimizedImage => ({
    buffer: input,
    mimeType: "application/octet-stream",
    extension: "",
    width,
    height,
    skipped: true,
    originalBytes,
    outputBytes: originalBytes,
  });

  try {
    const meta = await sharp(input).metadata();
    const format = (meta.format || "").toLowerCase();
    if (format !== "jpeg" && format !== "jpg" && format !== "png" && format !== "webp") {
      return passthrough(meta.width || null, meta.height || null);
    }
    // Animado (ex.: webp animado): não mexer para não quebrar.
    if (meta.pages && meta.pages > 1) {
      return passthrough(meta.width || null, meta.height || null);
    }

    const width = meta.width || 0;
    const height = meta.height || 0;
    const maxSide = Math.max(width, height);
    const cfg = MEDIA_OPTIMIZE_CONFIG;
    const needsResize = maxSide > cfg.maxImageDimension;
    const needsWeight = originalBytes >= cfg.skipImageBelowBytes;

    // Já pequeno e dentro do tamanho: sobe direto.
    if (!needsResize && !needsWeight) {
      const mime =
        format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      return {
        ...passthrough(width || null, height || null),
        mimeType: mime,
        extension: format === "jpeg" ? "jpg" : format,
      };
    }

    const keepPng = format === "png" && meta.hasAlpha === true;

    let pipeline = sharp(input).rotate(); // aplica orientação EXIF antes de tudo
    if (needsResize) {
      pipeline = pipeline.resize({
        width: cfg.maxImageDimension,
        height: cfg.maxImageDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    // Sem .withMetadata() → EXIF e metadados descartados.
    const out = keepPng
      ? await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
      : await pipeline.webp({ quality: cfg.imageQuality }).toBuffer();

    // Se por azar saiu MAIOR que o original, mantém o original.
    if (out.length >= originalBytes) {
      return passthrough(width || null, height || null);
    }

    const outMeta = await sharp(out).metadata().catch(() => null);
    return {
      buffer: out,
      mimeType: keepPng ? "image/png" : "image/webp",
      extension: keepPng ? "png" : "webp",
      width: outMeta?.width || width || null,
      height: outMeta?.height || height || null,
      skipped: false,
      originalBytes,
      outputBytes: out.length,
    };
  } catch (e) {
    console.warn("[media] optimizeImage falhou — enviando original", e);
    return passthrough();
  }
}
