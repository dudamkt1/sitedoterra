"use client";

import { useRef, useState } from "react";
import { uploadMedia, MEDIA_CATEGORIES_CLIENT } from "@/lib/media-client";
import type { MediaFile } from "@/types";

/**
 * Componente central de upload de mídia (Cloudflare R2).
 * Todos os uploads do sistema devem usar este componente.
 * Escopo:
 *   - "tenant" (padrão): arquivo vai para usuarios/{tenant_id}/... do usuário autenticado.
 *   - "system": arquivo vai para sistema/... (reservado ao Super Admin).
 */
export function MediaUploader({
  scope = "tenant",
  category = "general",
  onUploaded,
  buttonLabel,
  className = "",
}: {
  scope?: "tenant" | "system";
  category?: string;
  onUploaded?: (media: MediaFile) => void;
  buttonLabel?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cat = MEDIA_CATEGORIES_CLIENT.find((c) => c.code === category);
  const catLimitMb = category === "banner" ? 15 : category === "logo" || category === "avatar" ? 5 : 10;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    for (const file of Array.from(files)) {
      setUploading(true);
      setProgress(0);
      try {
        const media = await uploadMedia({
          file,
          category,
          scope,
          onProgress: setProgress,
        });
        if (onUploaded) onUploaded(media);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro no upload.");
        // se formos enviar vários e um falhar, interrompe
        break;
      } finally {
        setUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
        {uploading ? `Enviando... ${progress}%` : buttonLabel || "+ Enviar imagem"}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">
        {cat?.label || "Geral"} · JPEG, PNG ou WEBP · até {catLimitMb} MB
      </p>
    </div>
  );
}