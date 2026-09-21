// Testa as regras puras do programa de fidelidade (lib/crm-loyalty.ts):
// régua de níveis, progresso, alertas de subida e rótulos de desconto.
// Sem banco, sem rede — roda com `node scripts/test-loyalty.mjs`.
import {
  sortedLevels,
  levelPosition,
  levelNameForPoints,
  isCloseToNextLevel,
  levelDiscountLabel,
} from "../lib/crm-loyalty.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

const LEVELS = [
  { name: "Bronze", min_points: 0, benefits: ["Participação no programa"] },
  { name: "Prata", min_points: 100, benefits: ["5% de desconto"], discount_percent: 5, gifts: ["Brinde especial"] },
  { name: "Ouro", min_points: 300, benefits: ["10% de desconto"], discount_percent: 10 },
  { name: "VIP", min_points: 600, benefits: ["Benefícios especiais"], discount_percent: 15 },
];

console.log("\n== ordenação ==");
const shuffled = [LEVELS[3], LEVELS[0], LEVELS[2], LEVELS[1]];
assert(sortedLevels(shuffled).map((l) => l.name).join(",") === "Bronze,Prata,Ouro,VIP", "ordena por min_points");

console.log("\n== posição ==");
let p = levelPosition(LEVELS, 100);
assert(p.level.name === "Prata" && p.next.name === "Ouro", `100pts → Prata, próximo Ouro (got ${p.level.name}/${p.next?.name})`);
assert(p.missing === 200, `faltam 200 (got ${p.missing})`);
assert(p.progress === 0, `progresso 0% na base da faixa (got ${p.progress})`);

p = levelPosition(LEVELS, 250);
assert(p.level.name === "Prata" && p.missing === 50, `250pts → Prata, faltam 50 (got ${p.missing})`);
assert(p.progress === 75, `progresso 75% (got ${p.progress})`);

p = levelPosition(LEVELS, 0);
assert(p.level.name === "Bronze" && p.next.name === "Prata" && p.missing === 100, "0pts → Bronze, faltam 100 p/ Prata");

p = levelPosition(LEVELS, 900);
assert(p.level.name === "VIP" && p.next === null && p.missing === 0 && p.progress === 100, "900pts → VIP máximo");

p = levelPosition([], 50);
assert(p.level === null && p.progress === 100, "sem níveis → nível null, progresso 100");

console.log("\n== nomes ==");
assert(levelNameForPoints(LEVELS, 100) === "Prata", "levelName 100 → Prata");
assert(levelNameForPoints(LEVELS, 599) === "Ouro", "levelName 599 → Ouro");
assert(levelNameForPoints([], 10) === "Bronze", "sem níveis → fallback Bronze");

console.log("\n== alertas ==");
assert(isCloseToNextLevel(50, 75) === true, "faltam 50 → perto");
assert(isCloseToNextLevel(200, 0) === false, "faltam 200 (0%) → longe");
assert(isCloseToNextLevel(60, 85) === true, "60 faltando mas 85% → perto");
assert(isCloseToNextLevel(0, 100) === false, "no máximo → sem alerta");

console.log("\n== desconto ==");
assert(levelDiscountLabel(LEVELS[1]) === "5% de desconto", "Prata → 5% de desconto");
assert(levelDiscountLabel(LEVELS[0]) === null, "Bronze sem desconto → null");
assert(levelDiscountLabel(null) === null, "nível null → null");

console.log("\n== done ==");
console.log(process.exitCode ? "\nFALHOU" : "\nOK");
