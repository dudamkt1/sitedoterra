import crypto from "crypto";

/**
 * Criptografia AES-256-GCM para chaves de API.
 * A chave mestra vem de AI_ENCRYPTION_KEY (32 bytes em base64). Em dev,
 * usa um fallback estável para não quebrar o fluxo local.
 * Nunca exponha a chave descriptografada no frontend.
 */

function masterKey(): Buffer {
  const env = process.env.AI_ENCRYPTION_KEY;
  if (env) {
    try {
      return Buffer.from(env, "base64");
    } catch {
      // ignora e usa fallback
    }
  }
  return crypto.createHash("sha256").update("site-doterra-dev-ai-key-fallback").digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const enc = Buffer.from(parts[4], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function keyHint(payload: string | null | undefined): string | null {
  const plain = decryptSecret(payload);
  if (!plain) return null;
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}
