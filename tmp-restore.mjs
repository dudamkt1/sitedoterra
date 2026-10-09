import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const OUT = "C:/Users/Carlos/AppData/Local/Temp/opencode/catalog-backup.json";

const html = await (await fetch("http://localhost:3000/catalogo")).text();
const marker = '\\"products\\":[';
const at = html.indexOf(marker);
if (at < 0) {
  console.log("NÃO achou products no HTML — saindo");
  process.exit(1);
}
const start = at + marker.length - 1;
let depth = 0, inStr = false, end = -1;
for (let i = start; i < html.length - 1; i++) {
  const c = html[i];
  if (c === "\\") {
    const n = html[i + 1];
    if (n === '"') inStr = !inStr;
    i++;
    continue;
  }
  if (c === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (c === "[") depth++;
  else if (c === "]") {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) { console.log("parse falhou"); process.exit(1); }
const jsonText = html.slice(start, end).replace(/\\"/g, '"');
let products;
try {
  products = JSON.parse(jsonText);
} catch (e) {
  console.log("JSON.parse falhou:", e.message);
  console.log(jsonText.slice(0, 400));
  process.exit(1);
}
fs.writeFileSync(OUT, JSON.stringify(products, null, 2), "utf8");
console.log("snapshot:", products.map((p) => `${p.order} ${p.id} ${p.name}`).join(" | "));

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: row } = await admin.from("platform_config").select("value").eq("key", "main_catalog").maybeSingle();
const catalog = row?.value || {};
const existing = catalog.products || [];
console.log("atuais:", existing.map((p) => `${p.order} ${p.id} ${p.name}`).join(" | "));

for (const p of products) {
  if (!existing.some((e) => e.id === p.id)) {
    existing.push(p);
    console.log("RESTAURANDO:", p.id, p.name);
  }
}
existing.sort((a, b) => a.order - b.order || String(a.name).localeCompare(String(b.name), "pt-BR"));
existing.forEach((p, i) => (p.order = i));
catalog.products = existing;

const { error } = await admin
  .from("platform_config")
  .upsert({ key: "main_catalog", value: catalog }, { onConflict: "key" });
if (error) { console.log("ERRO upsert:", error.message); process.exit(1); }
const { data: after } = await admin.from("platform_config").select("value").eq("key", "main_catalog").maybeSingle();
console.log("depois:", (after.value.products || []).map((p) => `${p.order} ${p.id} ${p.name} R$${p.price_cents} ${p.active}`).join(" | "));
