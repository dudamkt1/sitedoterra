/**
 * Aplica a migration 0046 (texto novo da faixa de afiliados na home).
 * DML simples via service_role — equivale a rodar o SQL da migration.
 * Uso: node scripts/apply-0046-home-copy.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  readFileSync(path.join(root, ".env"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const content = {
  eyebrow: "Sem condições de ativar agora?",
  title: "Indique. Acumule saldo. Ative de graça.",
  subtitle:
    "Cada indicação confirmada gera 10% de comissão — use o saldo para ativar seu site ou zerar sua mensalidade.",
  buttonText: "Ver como funciona",
  buttonUrl: "/afiliados",
};

const { data, error } = await admin
  .from("site_sections")
  .update({ content })
  .eq("type", "affiliates")
  .select("key");

if (error) {
  console.error("FAIL", error.message);
  process.exit(1);
}
console.log(`OK — ${data?.length || 0} seção(ões) atualizadas:`, (data || []).map((r) => r.key).join(", "));
