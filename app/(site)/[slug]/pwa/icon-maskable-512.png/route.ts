import { servePwaPng } from "@/lib/pwa/icon-route";

export const dynamic = "force-dynamic";

/** GET /{slug}/pwa/icon-maskable-512.png — maskable com safe zone de 80%. */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  return servePwaPng({ slugParam: params.slug }, "maskable");
}
