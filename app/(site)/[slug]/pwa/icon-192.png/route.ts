import { servePwaPng } from "@/lib/pwa/icon-route";

export const dynamic = "force-dynamic";

/** GET /{slug}/pwa/icon-192.png — PNG 192 garantido (proxy normalizado ou tile gerado). */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  return servePwaPng({ slugParam: params.slug }, "icon192");
}
