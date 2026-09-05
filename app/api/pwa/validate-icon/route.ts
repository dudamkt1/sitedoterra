import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/pwa/validate-icon
 * Body: { urls: string[] }
 *
 * Faz HEAD em cada URL pública e devolve:
 *   { url, ok, status, contentType, contentLength, error? }
 *
 * Server-side fetch — necessário para checar CORS/headers que o browser
 * bloquearia (Content-Type, status HTTP, tamanho, redirecionamentos).
 * Sem isso, ícones quebrados só seriam descobertos na instalação do PWA,
 * tarde demais para o usuário.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { urls?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const raw = Array.isArray(body.urls) ? body.urls : [];
  const urls = raw
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .slice(0, 16); // limite saudável

  const out: Array<{
    url: string;
    ok: boolean;
    status?: number;
    contentType?: string;
    contentLength?: number;
    finalUrl?: string;
    error?: string;
  }> = [];

  for (const url of urls) {
    try {
      // HEAD primeiro (mais barato). Alguns CDNs não suportam HEAD — cai para GET com Range.
      let res: Response;
      try {
        res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          // cache: 'no-store' para não confiar em respostas antigas
          cache: "no-store",
        });
        if (!res.ok && res.status !== 405 && res.status !== 501) {
          // tenta GET com Range 0-0 como fallback
          throw new Error(`HEAD status ${res.status}`);
        }
      } catch {
        res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: { Range: "bytes=0-0" },
          cache: "no-store",
        });
      }

      const contentType = res.headers.get("content-type") || "";
      const contentLengthRaw =
        res.headers.get("content-length") ||
        // em Range, vem "bytes 0-0/TOTAL"
        (res.headers.get("content-range")?.split("/")[1]) ||
        "";
      const contentLength = Number(contentLengthRaw) || 0;

      // Aceita 2xx e 206 (partial content do Range). 404/403/etc = falha.
      const isOkStatus = res.ok || res.status === 206;
      const isImage =
        contentType.startsWith("image/") || /\.(png|jpe?g|webp|svg)($|\?)/i.test(url);

      out.push({
        url,
        ok: isOkStatus && isImage,
        status: res.status,
        contentType,
        contentLength,
        finalUrl: res.url !== url ? res.url : undefined,
        ...(isOkStatus && isImage
          ? {}
          : { error: !isOkStatus ? `HTTP ${res.status}` : `Content-Type inválido: ${contentType || "(vazio)"}` }),
      });
    } catch (err) {
      out.push({
        url,
        ok: false,
        error: err instanceof Error ? err.message : "Falha de rede",
      });
    }
  }

  return NextResponse.json({ results: out });
}
