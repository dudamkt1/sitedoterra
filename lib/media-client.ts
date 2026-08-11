"use client";

import type { MediaFile } from "@/types";
import { formatBytes } from "@/lib/utils";

export { formatBytes };

export interface PresignResponse {
  id: string;
  storageKey: string;
  uploadUrl: string;
  publicUrl: string;
  category: string;
  limitMb: number;
}

export const MEDIA_CATEGORIES_CLIENT = [
  { code: "general", label: "Geral" },
  { code: "logo", label: "Logo" },
  { code: "avatar", label: "Avatar / Perfil" },
  { code: "hero", label: "Hero / Capa" },
  { code: "story", label: "História" },
  { code: "products", label: "Produtos" },
  { code: "gallery", label: "Galeria" },
  { code: "banner", label: "Banner" },
];

export function categoryLabel(code?: string | null): string {
  return MEDIA_CATEGORIES_CLIENT.find((c) => c.code === code)?.label || "Geral";
}

async function json(url: string, init?: RequestInit): Promise<{ res: Response; data: any }> {
  const res = await fetch(url, init);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

/** Solicita URL pré-assinada no servidor. */
export async function requestPresign(args: {
  scope: "tenant" | "system";
  category: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
}): Promise<PresignResponse> {
  const { res, data } = await json("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(data?.error || "Não foi possível iniciar o upload.");
  return data as PresignResponse;
}

/** Envia o binário DIRETAMENTE ao R2 via PUT (sem passar pelo servidor). */
export async function putBlobToR2(uploadUrl: string, blob: Blob, mimeType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });
  if (!res.ok) {
    throw new Error("Falha ao enviar o arquivo ao armazenamento. Tente novamente.");
  }
}

/** Confirma o upload no servidor (marca metadado como 'uploaded'). */
export async function confirmUpload(id: string): Promise<MediaFile> {
  const { res, data } = await json("/api/media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(data?.error || "Erro ao confirmar o upload.");
  return data.media as MediaFile;
}

/**
 * Pipeline completo de upload (R2): presign → PUT direto → confirmar.
 * Use `onProgress` para exibir % de envio (PUT para R2 dispara upload progress).
 */
export async function uploadMedia(args: {
  file: File;
  category: string;
  scope?: "tenant" | "system";
  onProgress?: (pct: number) => void;
}): Promise<MediaFile> {
  const scope = args.scope || "tenant";
  const file = args.file;
  const mimeType = file.type || "application/octet-stream";

  const presign = await requestPresign({
    scope,
    category: args.category,
    mimeType,
    fileName: file.name,
    fileSize: file.size,
  });

  // PUT ao R2 via XHR para progresso real.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presign.uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && args.onProgress) {
        args.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no upload para o armazenamento."));
    xhr.onerror = () => reject(new Error("Falha de rede no upload."));
    xhr.send(file);
  });

  return confirmUpload(presign.id);
}

/** Lista mídias de um tenant/sistema/admin. */
export async function listMedia(params: {
  scope: "tenant" | "system" | "admin";
  category?: string;
  q?: string;
  sort?: string;
  tenantId?: string;
}): Promise<MediaFile[]> {
  const q = new URLSearchParams({
    scope: params.scope,
    ...(params.category ? { category: params.category } : {}),
    ...(params.q ? { q: params.q } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.tenantId ? { tenant_id: params.tenantId } : {}),
  });
  const { res, data } = await json(`/api/media?${q.toString()}`);
  if (!res.ok) throw new Error(data?.error || "Erro ao listar mídias.");
  return (data.items || []) as MediaFile[];
}

/** Exclui uma mídia. Lança erro (409) se estiver sendo usada. */
export async function deleteMedia(id: string): Promise<void> {
  const { res, data } = await json(`/api/media/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = new Error(data?.error || "Erro ao excluir.");
    (err as any).status = res.status;
    (err as any).references = data?.references || [];
    throw err;
  }
}

/** Estatísticas de armazenamento (usuário ou plataforma). */
export async function fetchStorageStats(all = false): Promise<{
  totalBytes: number;
  totalFiles: number;
  quotaBytes: number;
  byTenant?: any[];
}> {
  const { res, data } = await json(`/api/media/stats${all ? "?all=1" : ""}`);
  if (!res.ok) throw new Error(data?.error || "Erro ao obter estatísticas.");
  return data;
}