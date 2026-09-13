/**
 * Teste unitário do cálculo de crédito de afiliado (seção 6 do escopo).
 *
 * Compila lib/affiliate-credit-math.ts (módulo puro, zero imports) para JS
 * temporário e valida todos os cenários de valores. Rode com:
 *   node scripts/test-affiliate-credit.mjs
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = mkdtempSync(path.join(tmpdir(), "aff-credit-"));

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`      esperado: ${JSON.stringify(expected)}`);
    console.log(`      obtido:   ${JSON.stringify(actual)}`);
    failures += 1;
  }
}

try {
  execSync(
    `npx tsc "${path.join(root, "lib", "affiliate-credit-math.ts")}" --outDir "${tmp}" --module commonjs --target es2020 --skipLibCheck --declaration false --sourceMap false`,
    { cwd: root, stdio: "pipe" }
  );
  const require = createRequire(import.meta.url);
  const { calcAffiliateCredit } = require(path.join(tmp, "affiliate-credit-math.js"));

  // Cenários do escopo (valores em centavos)
  check("afiliado sem saldo (ativação 297)", calcAffiliateCredit(29700, 0), {
    originalCents: 29700, creditCents: 0, totalCents: 29700,
  });
  check("afiliado com R$ 10 (ativação 297)", calcAffiliateCredit(29700, 1000), {
    originalCents: 29700, creditCents: 1000, totalCents: 28700,
  });
  check("afiliado com R$ 50 (ativação 297 → total 247)", calcAffiliateCredit(29700, 5000), {
    originalCents: 29700, creditCents: 5000, totalCents: 24700,
  });
  check("saldo maior que a compra (mensalidade 47, saldo 500)", calcAffiliateCredit(4700, 50000), {
    originalCents: 4700, creditCents: 4700, totalCents: 0,
  });
  check("crédito cobre 100% (47 de 47)", calcAffiliateCredit(4700, 4700), {
    originalCents: 4700, creditCents: 4700, totalCents: 0,
  });
  check("compra zerada", calcAffiliateCredit(0, 5000), {
    originalCents: 0, creditCents: 0, totalCents: 0,
  });
  check("valores negativos saneados", calcAffiliateCredit(-100, -50), {
    originalCents: 0, creditCents: 0, totalCents: 0,
  });
  check("NaN saneado", calcAffiliateCredit(NaN, NaN), {
    originalCents: 0, creditCents: 0, totalCents: 0,
  });
  check("centavos fracionados arredondados p/ baixo", calcAffiliateCredit(29700.9, 5000.9), {
    originalCents: 29700, creditCents: 5000, totalCents: 24700,
  });
  check("crédito nunca supera o original", calcAffiliateCredit(100, 999999), {
    originalCents: 100, creditCents: 100, totalCents: 0,
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} cenário(s) FALHARAM`);
  process.exit(1);
}
console.log("\nTodos os cenários de crédito passaram.");
