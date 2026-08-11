import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { r2PublicUrl } from "@/lib/r2";

/**
 * SERVIDOR — regras de mídia (categorias, limites, quota, isolamento por tenant).
 * Todo upload passa por aqui: o tenant é SEMPRE resolvido do usuário autenticado
 * (nunca aceito do frontend).
 */

export const DEFAULT_MEDIA_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB

export interface MediaCategory {
  code: string;
  label: string;
  /** Limite por arquivo nesta categoria. */
  maxBytes: number;
  /** Pastas dentro de usuarios/{tenant_id}/. */
  folder: string;
}

export const MEDIA_CATEGORIES: MediaCategory[] = [
  { code: "general", label: "Geral", maxBytes: 10 * 1024 * 1024, folder: "general" },
  { code: "logo", label: "Logo", maxBytes: 5 * 1024 * 1024, folder: "logo" },
  { code: "avatar", label: "Avatar / Perfil", maxBytes: 5 * 1024 * 1024, folder: "avatar" },
  { code: "hero", label: "Hero / Capa", maxBytes: 10 * 1024 * 1024, folder: "hero" },
  { code: "story", label: "História", maxBytes: 10 * 1024 * 1024, folder: "story" },
  { code: "products", label: "Produtos", maxBytes: 10 * 1024 * 1024, folder: "produtos" },
  { code: "gallery", label: "Galeria", maxBytes: 10 * 1024 * 1024, folder: "galeria" },
  { code: "banner", label: "Banner", maxBytes: 15 * 1024 * 1024, folder: "banners" },
];

export function getMediaCategory(code?: string | null): MediaCategory {
  return MEDIA_CATEGORIES.find((c) => c.code === code) || MEDIA_CATEGORIES[0];
}

/** Formatos aceitos (sem SVG — risco de XSS). Preferir WEBP. */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export class MediaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Contexto de mídia do usuário autenticado (sessão + perfil + tenant). */
export async function mediaContext() {
  const user = await getCurrentUser();
  if (!user) throw new MediaError(401, "Não autenticado");
  const profile = await getProfile(user.id);
  if (!profile) throw new MediaError(403, "Perfil não encontrado");
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) throw new MediaError(403, "Nenhum site encontrado para este usuário");
  return {
    user,
    profile,
    tenant,
    isSuperAdmin: profile.role === "superadmin",
  };
}

/** Normaliza/sanatiza o nome original do arquivo (remove path e caracteres perigosos). */
export function sanitizeOriginalName(name?: string | null): string {
  const base = (name || "arquivo").replace(/\\/g, "/").split("/").pop() || "arquivo";
  return base.replace(/[^\w.\- ]/g, "").slice(0, 200) || "arquivo";
}

export function extFromName(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : null;
}

/** Valida categoria + MIME + extensão + tamanho. Devolve erro tipado quando inválido. */
export function validateUpload(args: {
  category?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}): { category: MediaCategory; extension: string; cleanName: string } {
  const category = getMediaCategory(args.category || "general");
  const mime = (args.mimeType || "").toLowerCase();
  const name = sanitizeOriginalName(args.fileName);

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new MediaError(400, "Formato não permitido. Use JPEG, PNG ou WEBP (imagens de até " + (category.maxBytes / 1024 / 1024).toFixed(0) + " MB).");
  }

  const ext = extFromName(name) || mime.split("/")[1];
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new MediaError(400, `Extensão "${ext || "desconhecida"}" não permitida. Use .jpg, .jpeg, .png ou .webp`);
  }

  const size = Number(args.fileSize);
  if (!(size > 0) || Number.isNaN(size)) {
    throw new MediaError(400, "Tamanho do arquivo inválido.");
  }
  if (size > category.maxBytes) {
    throw new MediaError(
      400,
      `Arquivo muito grande. O limite para "${category.label}" é ${(category.maxBytes / 1024 / 1024).toFixed(0)} MB.`
    );
  }

  return { category, extension: ext, cleanName: name };
}

/** Chave única dentro do bucket (path). tenant → usuarios/{tenant_id}/...; sistema → sistema/... */
export function makeStorageKey(args: {
  scope: "tenant" | "system";
  tenantId?: string | null;
  category: MediaCategory;
  extension: string;
}): string {
  const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 12)}`;
  const file = `${id}.${args.extension}`;
  if (args.scope === "system") return `sistema/${args.category.folder}/${file}`;
  return `usuarios/${args.tenantId || "sem-tenant"}/${args.category.folder}/${file}`;
}

/** Quota de armazenamento do plano vigente do tenant (default 500 MB). */
export async function getMediaQuotaBytes(tenantId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan:plan_id(media_quota_bytes)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const quota = (sub?.plan as { media_quota_bytes?: number } | null)?.media_quota_bytes;
    if (quota && Number(quota) > 0) return Number(quota);
  } catch {
    // fallback abaixo
  }
  return DEFAULT_MEDIA_QUOTA_BYTES;
}

/** Bytes em uso pelo tenant (só arquivos confirmados). */
export async function getTenantStorageUsed(tenantId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("media_files")
    .select("file_size")
    .eq("tenant_id", tenantId)
    .eq("status", "uploaded");
  return (data || []).reduce((acc, r) => acc + (Number(r.file_size) || 0), 0);
}

/** Verifica se um arquivo está sendo referenciado em conteúdo (seções/settings/avatar). */
export async function findMediaReferences(args: {
  storageKey: string;
  publicUrl: string;
  scope: "tenant" | "system";
  tenantId?: string | null;
}): Promise<{ area: string; label: string }[]> {
  const admin = createAdminClient();
  const refs: { area: string; label: string }[] = [];

  const includes = (value: unknown, sub: string) =>
    typeof value === "string" && (value.includes(sub) || value.includes(args.publicUrl));

  if (args.scope === "system") {
    const { data: sections } = await admin.from("site_sections").select("id, key, content");
    for (const s of sections || []) {
      if (includes(JSON.stringify(s.content), args.storageKey)) {
        refs.push({ area: "site_sections", label: `Seção "${s.key}" da HOME (global)` });
      }
    }
  } else if (args.tenantId) {
    const { data: sections } = await admin.from("tenant_sections").select("id, section_id, content").eq("tenant_id", args.tenantId);
    for (const s of sections || []) {
      if (includes(JSON.stringify(s.content), args.storageKey)) {
        refs.push({ area: "tenant_sections", label: "Seção personalizada do seu site" });
      }
    }
    const { data: settings } = await admin.from("site_settings").select("data").eq("tenant_id", args.tenantId).maybeSingle();
    if (settings && includes(JSON.stringify(settings.data), args.storageKey)) {
      refs.push({ area: "site_settings", label: "Configurações do site" });
    }
  }

  return refs;
}

/** Constrói a view de um registro de mídia para o frontend. */
export function toMediaView(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    storage_key: row.storage_key,
    public_url: row.public_url || r2PublicUrl(row.storage_key),
    original_name: row.original_name,
    mime_type: row.mime_type,
    file_size: Number(row.file_size) || 0,
    category: row.category,
    folder: row.folder,
    status: row.status,
    created_at: row.created_at,
  };
}