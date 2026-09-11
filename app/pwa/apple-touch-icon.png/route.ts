import { servePwaPng } from "@/lib/pwa/icon-route";

export const dynamic = "force-dynamic";

/** GET /pwa/apple-touch-icon.png (raiz — domínio próprio ou HOME do domínio principal). */
export async function GET() {
  return servePwaPng({ home: true }, "apple");
}
