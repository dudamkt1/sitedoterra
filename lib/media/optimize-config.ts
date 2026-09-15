/**
 * CONFIG CENTRAL DA OTIMIZAÇÃO DE MÍDIA (imagens + vídeos).
 *
 * Tudo que é número mágico da compressão mora aqui — para ajustar depois
 * (ex.: qualidade ou tamanho máximo) basta mudar este arquivo.
 *
 * - Imagens: redimensionadas para no máximo MAX_IMAGE_DIMENSION no lado maior
 *   e convertidas para WebP (qualidade IMAGE_QUALITY), exceto PNG com
 *   transparência (mantido PNG, mas otimizado). Metadados EXIF removidos.
 * - Vídeos: comprimidos NO NAVEGADOR (ffmpeg.wasm, @ffmpeg/core-st
 *   single-thread — sem COOP/COEP) para no máximo MAX_VIDEO_WIDTH de largura,
 *   H.264 (CRF VIDEO_CRF) + thumbnail do frame do meio.
 */
export const MEDIA_OPTIMIZE_CONFIG = {
  // ---- Imagens ----
  /** Maior lado permitido (px). Suficiente p/ hero/banners do site. */
  maxImageDimension: 1600,
  /** Qualidade WebP/JPEG (0-100). 80 = bom equilíbrio qualidade/peso. */
  imageQuality: 80,
  /** Abaixo disso (bytes) E dentro das dimensões, pula a compressão. */
  skipImageBelowBytes: 200 * 1024,
  /** Teto de segurança ANTES de comprimir (evita travar o browser/servidor). */
  maxImageInputBytes: 20 * 1024 * 1024,

  // ---- Vídeos ----
  /** Largura máxima (px) — 720p é suficiente p/ os usos do site. */
  maxVideoWidth: 1280,
  /** Altura máxima (px). */
  maxVideoHeight: 720,
  /** CRF do H.264 (18-28 útil; maior = mais leve). ~28 = bom equilíbrio. */
  videoCrf: 28,
  /** Preset x264. `veryfast` comprime rápido sem pesar o navegador. */
  videoPreset: "veryfast" as const,
  /** Abaixo disso (bytes), sobe o original sem comprimir. */
  skipVideoBelowBytes: 8 * 1024 * 1024,
  /** Teto de segurança ANTES de comprimir (evita travar o navegador). */
  maxVideoInputBytes: 100 * 1024 * 1024,
  /** Largura do thumbnail/poster do vídeo (px). */
  videoPosterWidth: 640,
  /** Versão do núcleo single-thread do ffmpeg.wasm (via CDN, sem COOP/COEP). */
  ffmpegCoreStVersion: "0.11.0",
} as const;

export type MediaOptimizeConfig = typeof MEDIA_OPTIMIZE_CONFIG;
