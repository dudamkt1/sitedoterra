import { resolvePwaForRequest } from "./resolver";
import { renderPwaPng, type PwaPngKind } from "./icon-png";
import { pwaVersionToken } from "./config";

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
  const tenantId = resolved.settings.tenant_id;
  const versionToken = pwaVersionToken(resolved.settings);
  try {
    const { buffer, generated } = await renderPwaPng(
      resolved.settings,
      kind,
      resolved.ref.origin,
      tenantId,
      versionToken
    );
    if (generated) {
      // Sinal vital de diagnóstico: nenhum upload pôde ser usado e o tile
      // genérico foi servido. O painel lê este header no "Verificar se
      // instala" para dizer a verdade (antes, fallback e logo real eram
      // indistinguíveis — ambos 200 image/png — e o check "batia ok").
      console.error(
        `[pwa/icon] FALLBACK genérico servido: slug=${resolved.ref.slug} kind=${kind} ` +
          `fontes=${JSON.stringify([resolved.settings.icon_512_url, resolved.settings.icon_maskable_512_url, resolved.settings.icon_192_url, resolved.settings.icon_180_url, resolved.settings.logo_url])}`
      );
    }
    // Cópia com ArrayBuffer próprio (tipagem BodyInit do Response).
    const copy = new Uint8Array(buffer.length);
    copy.set(buffer);
    return new Response(copy.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // Origem real do PNG: "upload" (logotipo do usuário) ou "generated"
        // (tile genérico — reenvie o logo e salve). Lido pelo diagnóstico do
        // painel; same-origin, sem necessidade de CORS extra.
        "X-PWA-Icon-Source": generated ? "generated" : "upload",
        // Versionado por ?v=<token> no manifest/<head> (muda a cada save).
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
