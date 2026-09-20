import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { buildManifest } from "@/lib/pwa/config";
import { pwaIconPaths } from "@/lib/pwa/config";

export const runtime = "nodejs";

/**
 * GET /api/debug/pwa-check?slug=afiliado1&secret=xxx
 * Endpoint de diagnóstico para verificar instalabilidade da PWA.
 * Simula o que o Google WebAPK fetcher faz: busca manifest e ícones,
 * reporta status HTTP, content-type, tamanho e valida assinatura PNG.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.PWA_DEBUG_SECRET || "dev-secret-change-in-production";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!slug) {
    return NextResponse.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.topconsultores.com.br";
  const manifestUrl = `${baseUrl}/${slug}/manifest.webmanifest`;

  // 1. Buscar manifest
  const manifestResult = await fetchUrl(manifestUrl);
  let manifestJson = null;
  if (manifestResult.ok) {
    try {
      manifestJson = await manifestResult.json();
    } catch {
      manifestResult.error = "Invalid JSON";
    }
  }

  // 2. Para cada ícone no manifest, validar
  const iconResults: Record<string, any> = {};
  if (manifestJson?.icons) {
    for (const icon of manifestJson.icons) {
      const iconUrl = icon.src || icon.url;
      if (!iconUrl) continue;

      // Resolver URL absoluta se relativa
      const absoluteUrl = iconUrl.startsWith("http") ? iconUrl : `${baseUrl}${iconUrl}`;
      iconResults[iconUrl] = await fetchAndValidateImage(absoluteUrl);
    }
  }

  // 3. Também verificar os ícones padrão do config (fallback)
  const pwa = await resolvePwaForRequest({ slugParam: slug });
  if (pwa?.settings.enabled) {
    const paths = pwaIconPaths(pwa.basePath);
    const v = pwa.settings.logo_url ? `?v=${pwa.settings.updated_at}` : "";
    const standardIcons = {
      "icon-192": `${baseUrl}${paths.icon192}${v}`,
      "icon-512": `${baseUrl}${paths.icon512}${v}`,
      "apple-touch-icon": `${baseUrl}${paths.apple}${v}`,
    };
    for (const [name, url] of Object.entries(standardIcons)) {
      if (!iconResults[url]) {
        iconResults[url] = await fetchAndValidateImage(url);
      }
    }
  }

  return NextResponse.json({
    slug,
    manifest: {
      url: manifestUrl,
      status: manifestResult.status,
      headers: Object.fromEntries(manifestResult.headers.entries()),
      body: manifestJson,
      error: manifestResult.error,
    },
    icons: iconResults,
    summary: {
      manifestOk: manifestResult.ok && !!manifestJson,
      iconsTotal: Object.keys(iconResults).length,
      iconsOk: Object.values(iconResults).filter(r => r.ok).length,
      iconsFailed: Object.values(iconResults).filter(r => !r.ok).length,
    },
  });
}

async function fetchUrl(url: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "PWA-Debug/1.0" },
      cache: "no-store",
      redirect: "follow",
    });
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      json: async () => res.json(),
      text: async () => res.text(),
      blob: async () => res.blob(),
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      json: async () => { throw new Error("Fetch failed"); },
      text: async () => { throw new Error("Fetch failed"); },
      blob: async () => { throw new Error("Fetch failed"); },
      error: e instanceof Error ? e.message : "Fetch failed",
    };
  }
}

async function fetchAndValidateImage(url: string) {
  const res = await fetchUrl(url);
  if (!res.ok) {
    return { ok: false, url, status: res.status, error: res.error };
  }

  const contentType = res.headers.get("content-type") || "";
  const contentLength = res.headers.get("content-length");
  let blob: Blob | null = null;
  let pngValid = false;
  let pngError: string | null = null;

  try {
    blob = await res.blob();
    if (contentType.startsWith("image/png")) {
      // Ler primeiros 8 bytes para validar assinatura PNG (89 50 4E 47 0D 0A 1A 0A)
      const arrayBuffer = await blob.slice(0, 8).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      pngValid = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
                 bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
    }
  } catch (e) {
    pngError = e instanceof Error ? e.message : "Blob read failed";
  }

  return {
    ok: res.ok,
    url,
    status: res.status,
    contentType,
    contentLength: contentLength ? parseInt(contentLength) : blob?.size || 0,
    pngValid,
    pngError,
    cacheControl: res.headers.get("cache-control"),
  };
}