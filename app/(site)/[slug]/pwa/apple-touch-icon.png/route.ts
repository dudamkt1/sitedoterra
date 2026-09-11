import { servePwaPng } from "@/lib/pwa/icon-route";

export const dynamic = "force-dynamic";

/** GET /{slug}/pwa/apple-touch-icon.png — PNG 180 para iOS "Adicionar à Tela de Início". */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  return servePwaPng({ slugParam: params.slug }, "apple");
}
