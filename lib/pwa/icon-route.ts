import { resolvePwaForRequest } from "./resolver";
import { renderPwaPng, type PwaPngKind } from "./icon-png";

// Handler compartilhado das rotas `/pwa/*.png` (raiz e `/{slug}/pwa/*.png`).
// Serve o PNG garantido (proxy do upload normalizado ou tile gerado) no
// MESMO domínio — o celular nunca sofre CORS nem URL quebrada.
export async function servePwaPng(
  opts: { slugParam?: string | null; home?: boolean },
  kind: PwaPngKind
): Promise<Response> {
  const resolved = await resolvePwaForRequest(opts);
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }
  try {
    const { buffer } = await renderPwaPng(resolved.settings, kind, resolved.ref.origin);
    // Cópia com ArrayBuffer próprio (tipagem BodyInit do Response).
    const copy = new Uint8Array(buffer.length);
    copy.set(buffer);
    return new Response(copy.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // Versionado por ?v=<token> no manifest/<head> (muda a cada save).
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
