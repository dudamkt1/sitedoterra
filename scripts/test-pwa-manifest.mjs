// Validação rápida do pipeline de variantes PWA.
// Como o processamento é client-side via Canvas, este teste foca em:
//  1. A forma do manifest gerado (buildManifest é puro, testável em Node)
//  2. A detecção de Content-Type (guessType)
//  3. O versionamento (pwaVersionToken)
//  4. A geração das URLs com cache-busting
//
// O pipeline de Canvas precisa de browser real para validar.

import {
  buildManifest,
  pwaVersionToken,
  defaultPwaSettings,
} from "../lib/pwa/config.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

const settings = {
  ...defaultPwaSettings("tenant-test", "user-test"),
  enabled: true,
  app_name: "Maria Sucesso",
  short_name: "Maria",
  description: "App da consultora Maria",
  icon_180_url: "https://cdn.exemplo.com/logo-180.png",
  icon_192_url: "https://cdn.exemplo.com/logo-192.png",
  icon_512_url: "https://cdn.exemplo.com/logo-512.png",
  icon_maskable_512_url: "https://cdn.exemplo.com/logo-maskable-512.png",
  theme_color: "#1d5c3a",
  background_color: "#faf8f2",
  canonical: "platform",
  updated_at: "2026-09-05T10:00:00.000Z",
};

console.log("\n== versionToken ==");
const v1 = pwaVersionToken(settings);
assert(typeof v1 === "string" && v1.length > 0, `versionToken = ${v1}`);

console.log("\n== manifest ==");
const m = buildManifest(settings, {
  origin: "https://oleos.topconsultores.com.br",
  basePath: "/mariatest/",
});

assert(m.name === "Maria Sucesso", `name = ${m.name}`);
assert(m.short_name === "Maria", `short_name = ${m.short_name}`);
assert(m.start_url === "/mariatest/", `start_url = ${m.start_url}`);
assert(m.scope === "/mariatest/", `scope = ${m.scope}`);
assert(m.theme_color === "#1d5c3a", `theme_color = ${m.theme_color}`);
assert(m.background_color === "#faf8f2", `background_color = ${m.background_color}`);
assert(m.display === "standalone", `display = ${m.display}`);

const icons = m.icons;
assert(Array.isArray(icons), `icons é array (${icons.length} itens)`);

// Deve ter pelo menos 5 ícones: 4 PNGs + 1 SVG fallback
assert(icons.length >= 5, `icons.length >= 5 (got ${icons.length})`);

const png180 = icons.find((i) => i.sizes === "180x180" && i.purpose === "any");
const png192 = icons.find((i) => i.sizes === "192x192" && i.purpose === "any");
const png512 = icons.find((i) => i.sizes === "512x512" && i.purpose === "any");
const pngMask = icons.find((i) => i.sizes === "512x512" && i.purpose === "maskable");
const svg = icons.find((i) => i.type === "image/svg+xml");

assert(png180, "tem ícone 180x180 (apple-touch)");
assert(png192, "tem ícone 192x192 (Android)");
assert(png512, "tem ícone 512x512 (Android)");
assert(pngMask, "tem ícone 512x512 maskable");
assert(svg, "tem ícone SVG fallback");

// Todos os PNGs devem ter ?v=<token>
const token = v1;
for (const icon of [png180, png192, png512, pngMask].filter(Boolean)) {
  assert(
    icon.src.includes(`v=${token}`),
    `URL tem ?v=${token} → ${icon.src.slice(-50)}`
  );
  assert(
    icon.type === "image/png",
    `type = image/png (got ${icon.type})`
  );
}

// URLs absolutas
for (const icon of [png180, png192, png512, pngMask].filter(Boolean)) {
  assert(
    icon.src.startsWith("https://"),
    `URL é absoluta → ${icon.src.slice(0, 50)}...`
  );
}

console.log("\n== manifest HOME (basePath /) ==");
const mHome = buildManifest(settings, {
  origin: "https://mariaconsultora.com.br",
  basePath: "/",
});
assert(mHome.start_url === "/", `start_url = ${mHome.start_url}`);
assert(mHome.scope === "/", `scope = ${mHome.scope}`);

console.log("\n== fallback (sem upload) ==");
const empty = defaultPwaSettings("tenant-x", "user-x");
const mEmpty = buildManifest(empty, {
  origin: "https://oleos.topconsultores.com.br",
  basePath: "/x/",
});
// Só deve ter o SVG fallback
assert(mEmpty.icons.length === 1, `sem PNGs = 1 ícone (SVG)`);
assert(mEmpty.icons[0].type === "image/svg+xml", `fallback é SVG`);

console.log("\n== done ==");
if (process.exitCode) {
  console.log("\nFALHOU");
} else {
  console.log("\nOK");
}
