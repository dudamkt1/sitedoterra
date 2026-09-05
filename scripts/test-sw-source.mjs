// Valida que o template do Service Worker é JavaScript válido.
import { buildServiceWorkerSource } from "../lib/pwa/sw-source.ts";

const js = buildServiceWorkerSource({
  cacheName: "maria",
  scope: "/",
  cacheVersion: "v123",
});

console.log(js);

// Validação simples de parênteses
const opens = (js.match(/\(/g) || []).length;
const closes = (js.match(/\)/g) || []).length;
if (opens !== closes) {
  console.error(`✗ Parênteses não balanceados: ${opens} ( vs ${closes} )`);
  process.exit(1);
}

// Validação de chaves
const oBraces = (js.match(/{/g) || []).length;
const cBraces = (js.match(/}/g) || []).length;
if (oBraces !== cBraces) {
  console.error(`✗ Chaves não balanceadas: ${oBraces} { vs ${cBraces} }`);
  process.exit(1);
}

// Verifica que contém os elementos essenciais
const checks = [
  { needle: "self.skipWaiting()", label: "skipWaiting()" },
  { needle: "caches.keys()", label: "caches.keys()" },
  { needle: "self.clients.claim()", label: "clients.claim()" },
  { needle: "CACHE = ", label: "const CACHE" },
  { needle: "EXCLUDED_PREFIXES", label: "EXCLUDED_PREFIXES" },
  { needle: "addEventListener(\"install\"", label: "install handler" },
  { needle: "addEventListener(\"activate\"", label: "activate handler" },
  { needle: "addEventListener(\"fetch\"", label: "fetch handler" },
  { needle: "pwa-maria-v", label: "cache versionada com slug" },
];

let failures = 0;
for (const c of checks) {
  if (js.includes(c.needle)) {
    console.log(`✓ contém: ${c.label}`);
  } else {
    console.error(`✗ NÃO contém: ${c.label}`);
    failures++;
  }
}

if (failures) {
  console.error(`\nFALHOU (${failures})`);
  process.exit(1);
}
console.log("\nOK — Service Worker gerado é válido.");
