import { servePwaPng } from "@/lib/pwa/icon-route";

export const dynamic = "force-dynamic";

/** GET /pwa/icon-192.png (raiz — domínio próprio ou HOME do domínio principal). */
export async function GET() {
  return servePwaPng({ home: true }, "icon192");
}
