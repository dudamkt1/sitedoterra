import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
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

/**
 * Envia um objeto ao R2 PELO SERVIDOR (sem CORS/preflight do browser).
 * Usado como fallback quando o upload direto do browser falha.
 */
export async function r2PutObject(params: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
}): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType || "application/octet-stream",
    })
  );
}

/**
 * AUTO-HEALING DE CORS NO BUCKET R2.
 *
 * O browser envia o binário DIRETO ao R2 (PUT pré-assinado). Para isso, o
 * bucket precisa aceitar a origem (CORS) — senão o navegador bloqueia a
 * requisição e o usuário vê "Falha de rede no upload."
 *
 * Em vez de depender de configuração manual (que quebra a cada preview/domínio
 * novo), este método atualiza o CORS do bucket automaticamente com a origem da
 * requisição + origens padrão conhecidas. Idempotente e best-effort.
 */
export async function ensureR2BucketCors(extraOrigins: string[] = []): Promise<void> {
  const env = r2Env();
  if (!env.accountId) return;

  const defaultOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://sitedoterra-psi.vercel.app",
    "https://www.sitedoterra.com.br",
    "https://sitedoterra.com.br",
  ];

  const origins = Array.from(
    new Set(
      [...defaultOrigins, ...extraOrigins]
        .map((o) => (o || "").replace(/\/+$/, ""))
        .filter((o) => o.startsWith("http://") || o.startsWith("https://"))
    )
  );

  try {
    await getR2Client().send(
      new PutBucketCorsCommand({
        Bucket: getR2Bucket(),
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["Content-Type"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
  } catch (err) {
    console.error("Erro ao atualizar CORS do bucket R2 (best-effort)", err);
  }
}