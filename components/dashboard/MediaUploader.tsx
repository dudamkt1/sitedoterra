"use client";

import { useRef, useState } from "react";
import { uploadMedia, uploadVideoWithPoster, MEDIA_CATEGORIES_CLIENT } from "@/lib/media-client";
import type { MediaFile } from "@/types";

/**
 * Componente central de upload de mídia (Cloudflare R2).
 * Todos os uploads do sistema devem usar este componente.
 * Escopo:
 *   - "tenant" (padrão): arquivo vai para usuarios/{tenant_id}/... do usuário autenticado.
 *   - "system": arquivo vai para sistema/... (reservado ao Super Admin).
 *
 * Otimização automática antes do envio (sem ação do usuário):
 *   - Imagens: redimensionadas (máx. 1600px) + WebP q80 no navegador; sharp
 *     como rede de segurança no servidor.
 *   - Vídeos (quando `acceptVideo`): comprimidos no navegador via ffmpeg.wasm
 *     (720p H.264) com thumbnail/poster salva junto no R2.
 */
export function MediaUploader({
  scope = "tenant",
  category = "general",
  onUploaded,
  buttonLabel,
  className = "",
  acceptVideo = false,
  onPoster,
}: {
  scope?: "tenant" | "system";
  category?: string;
  onUploaded?: (media: MediaFile) => void;
  buttonLabel?: string;
  className?: string;
  /** Permite selecionar vídeos (MP4/WebM, até 100 MB → comprimido p/ 720p). */
  acceptVideo?: boolean;
  /** URL pública do poster gerado (quando vídeo). */
  onPoster?: (posterUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"optimizing" | "uploading" | null>(null);
  const [stageDetail, setStageDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cat = MEDIA_CATEGORIES_CLIENT.find((c) => c.code === category);
  const catLimitMb =
    category === "video" ? 100 : category === "banner" ? 15 : category === "logo" || category === "avatar" ? 5 : 10;
  // SVG (vetor, ideal p/ logo) é aceito nas categorias "logo" e "general" —
  // sobe intacto pelo servidor (com sanitização anti-XSS) e tem teto de 1 MB.
  const svgAllowed = category === "logo" || category === "general";
  const accept = acceptVideo || category === "video"
    ? "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
    : svgAllowed
      ? "image/jpeg,image/png,image/webp,image/svg+xml"
      : "image/jpeg,image/png,image/webp";

  function handleStage(s: "optimizing" | "uploading", detail?: string) {
    setStage(s);
    if (s === "uploading") setProgress(0);
    setStageDetail(detail || "");
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const list = Array.from(files);
    for (const file of list) {
      setUploading(true);
      setProgress(0);
      setStage(null);
      setStageDetail("");
      try {
        const isVideo = (file.type || "").toLowerCase().startsWith("video/");
        if (isVideo) {
          const { media, posterUrl } = await uploadVideoWithPoster({
            file,
            // Vídeo sempre na categoria "video" (validação do servidor).
            category: "video",
            scope,
            onProgress: setProgress,
            onStage: handleStage,
          });
          if (posterUrl && onPoster) onPoster(posterUrl);
          if (onUploaded) onUploaded(media);
        } else {
          const media = await uploadMedia({
            file,
            category,
            scope,
            onProgress: setProgress,
            onStage: handleStage,
          });
          if (onUploaded) onUploaded(media);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro no upload.");
        // se formos enviar vários e um falhar, interrompe
        break;
      } finally {
        setUploading(false);
        setProgress(0);
        setStage(null);
        setStageDetail("");
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  }

  const statusText = uploading
    ? stage === "optimizing"
      ? stageDetail || "Otimizando..."
      : `Enviando... ${progress}%`
    : buttonLabel || (acceptVideo || category === "video" ? "+ Enviar mídia" : "+ Enviar imagem");

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {statusText}
      </button>
      {uploading && stage === "optimizing" && (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-2">
          <div className="h-full rounded-full bg-[#1d5c3a] animate-pulse" style={{ width: "100%" }} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">
        {cat?.label || "Geral"} ·{" "}
        {acceptVideo || category === "video"
          ? "JPEG, PNG, WEBP, MP4 ou WebM · até 100 MB (vídeo sai em 720p otimizado)"
          : svgAllowed
            ? `JPEG, PNG, WEBP ou SVG · até ${catLimitMb} MB (SVG: até 1 MB, vetor nítido em qualquer tamanho)`
            : `JPEG, PNG ou WEBP · até ${catLimitMb} MB (imagem sai otimizada em WebP)`}
      </p>
    </div>
  );
}
