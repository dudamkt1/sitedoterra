/**
 * URL pública canônica da plataforma — SEMPRE o domínio direcionado
 * (ex.: https://oleos.topconsultores.com.br), nunca o domínio *.vercel.app.
 *
 * Prioridade:
 *   1. NEXT_PUBLIC_HOME_URL (definida na Vercel com o domínio principal)
 *   2. NEXT_PUBLIC_APP_URL
 *   3. http://localhost:3000 (dev)
 */
export function getPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_HOME_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
