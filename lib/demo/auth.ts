import { cookies } from "next/headers";

export const DEMO_COOKIE_NAME = "sitedoterra_demo";
export const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function getSecret(): string {
  const s =
    process.env.DEMO_SECRET ||
    process.env.TEST_USER_PASSWORD ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "sitedoterra-demo-fallback-secret";
  return s;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(new Uint8Array(sig));
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function createDemoCookieValue(): Promise<{ value: string; nonce: string; startedAt: string }> {
  const nonce = randomNonce();
  const startedAt = new Date().toISOString();
  const payload = `${nonce}.${startedAt}`;
  const sig = await hmacHex(getSecret(), payload);
  return { value: `${payload}.${sig}`, nonce, startedAt };
}

export async function isDemoCookieValid(raw: string | undefined | null): Promise<boolean> {
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [nonce, startedAt, sig] = parts;
  if (!nonce || !startedAt || !sig) return false;
  const expected = await hmacHex(getSecret(), `${nonce}.${startedAt}`);
  return timingSafeEqual(sig, expected);
}

export async function isDemoMode(): Promise<boolean> {
  try {
    const c = cookies().get(DEMO_COOKIE_NAME);
    return await isDemoCookieValid(c?.value);
  } catch {
    return false;
  }
}

export async function getDemoSessionInfo(): Promise<{
  active: true;
  nonce: string;
  startedAt: string;
} | null> {
  try {
    const c = cookies().get(DEMO_COOKIE_NAME);
    if (!(await isDemoCookieValid(c?.value))) return null;
    const [nonce, startedAt] = c!.value.split(".");
    return { active: true, nonce, startedAt };
  } catch {
    return null;
  }
}

/**
 * Utilizado pelas APIs para impedir escrita/demo. Retorna true se o request
 * está em modo demonstração. NUNCA confiar em dados do body para ativar o
 * modo DEMO — somente no cookie httpOnly validado por HMAC.
 */
export async function blockIfDemo(): Promise<{ blocked: true; response: Response } | null> {
  if (await isDemoMode()) {
    return {
      blocked: true,
      response: new Response(
        JSON.stringify({
          error:
            "Operação bloqueada: ambiente de demonstração. Suas alterações ficam somente neste dispositivo.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return null;
}
