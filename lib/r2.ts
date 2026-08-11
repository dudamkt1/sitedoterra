import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — ARMAZENAMENTO CENTRAL DE MÍDIA.
 *
 * Regra do projeto:
 *   R2  = arquivos/mídia
 *   Supabase = banco/autenticação/**metadados** (NUNCA binário)
 *   Vercel/Hostinger = aplicação (NUNCA guarda arquivos no filesystem)
 *
 * Este módulo é **server-only**. As credenciais (R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID) NUNCA podem ser expostas ao browser.
 */

export function r2Env() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET_NAME || "site-doterra-media",
    publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
    endpoint: process.env.R2_ENDPOINT || "",
  };
}

/** O R2 está totalmente configurado para operar? */
export function isR2Configured(): boolean {
  const env = r2Env();
  return Boolean(env.accountId && env.accessKeyId && env.secretAccessKey);
}

export function getR2Bucket(): string {
  return r2Env().bucket;
}

let client: S3Client | null = null;

/** Cliente S3 apontando para o endpoint do R2 (S3-compatible). Server-only. */
export function getR2Client(): S3Client {
  const env = r2Env();
  if (!env.accountId) throw new Error("R2_ACCOUNT_ID não configurada");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: env.endpoint || `https://${env.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });
  }
  return client;
}

/**
 * URL pública/CDN de um objeto. Usa R2_PUBLIC_URL (domínio de mídia, ex.:
 * https://media.seudominio.com.br). Sem a variável, devolve caminho relativo
 * (imagens só serão servidas quando o domínio for configurado).
 */
export function r2PublicUrl(storageKey: string): string {
  const env = r2Env();
  const normalized = storageKey.replace(/^\/+/, "");
  if (env.publicUrl) return `${env.publicUrl}/${normalized}`;
  return `https://${env.bucket}.r2.dev/${normalized}`;
}

/**
 * Gera uma URL pré-assinada (PUT) para o browser enviar o arquivo DIRETAMENTE
 * ao R2, sem passar pela aplicação (reduz carga da Vercel/Hostinger).
 */
export async function createPresignedPutUrl(params: {
  key: string;
  contentType?: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: params.key,
    ContentType: params.contentType || "application/octet-stream",
  });
  return getSignedUrl(getR2Client(), command, {
    expiresIn: params.expiresIn || 900,
  });
}

export interface R2ObjectMeta {
  size: number;
  etag?: string;
  contentType?: string;
}

/** Consulta metadados de um objeto existente no R2 (ou null se não existir). */
export async function r2HeadObject(key: string): Promise<R2ObjectMeta | null> {
  try {
    const res = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key })
    );
    return {
      size: Number(res.ContentLength || 0),
      etag: res.ETag,
      contentType: res.ContentType,
    };
  } catch {
    return null;
  }
}

/** Exclui um objeto do R2. Idempotente (não lança se não existir). */
export async function r2DeleteObject(key: string): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key })
    );
  } catch (err) {
    console.error("Erro ao excluir objeto do R2", key, err);
  }
}