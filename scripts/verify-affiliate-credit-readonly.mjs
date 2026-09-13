/**
 * Verificação somente-leitura da infra de crédito de afiliado (não altera nada).
 * Uso: node scripts/verify-affiliate-credit-readonly.mjs
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

let failures = 0;
function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// 1) Migration 0045 aplicada? (tabela existe?)
{
  const { error } = await admin.from("affiliate_credit_usages").select("id", { head: true, count: "exact" });
  report("tabela affiliate_credit_usages existe (migration 0045)", !error, error?.message || "");
}

// 2) RPCs de crédito existem?
for (const fn of ["get_affiliate_balance", "reserve_affiliate_credit", "apply_affiliate_credit", "release_affiliate_credit"]) {
  const args =
    fn === "get_affiliate_balance"
      ? { p_user_id: "00000000-0000-0000-0000-000000000000" }
      : fn === "reserve_affiliate_credit"
        ? { p_user_id: "00000000-0000-0000-0000-000000000000", p_amount: 0, p_tenant_id: null, p_kind: "activation" }
        : { p_usage_id: "00000000-0000-0000-0000-000000000000" };
  const { error } = await admin.rpc(fn, args);
  const missing = error && /does not exist|undefined_function|42883|could not find the function/i.test(error.message);
  // Qualquer erro DIFERENTE de "função inexistente" indica que a função existe
  // (ex.: saldo insuficiente, uuid inválido, reserva zerada).
  report(`RPC ${fn} existe`, !missing, error?.message?.slice(0, 120) || "ok");
}

// 3) Texto novo da home (migration 0046)?
{
  const { data, error } = await admin
    .from("site_sections")
    .select("content")
    .eq("type", "affiliates")
    .limit(1)
    .maybeSingle();
  const eyebrow = data?.content?.eyebrow || "";
  report("faixa da home com texto novo (0046)", !error && eyebrow === "Sem condições de ativar agora?", `eyebrow="${eyebrow}"`);
}

if (failures > 0) {
  console.log(`\n${failures} verificação(ões) FALHARAM (infra ainda não aplicada ou texto antigo).`);
  process.exit(1);
}
console.log("\nInfra de crédito verificada no banco.");
