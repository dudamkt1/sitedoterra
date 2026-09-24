// Auditoria de ISOLAMENTO multi-tenant do PWA (item 0 do plano de correção).
//
// Objetivo: provar (ou derrubar) a hipótese de que o Android recebe o MESMO
// ícone para tenants DIFERENTES (cache compartilhado sem chave por tenant,
// resolução de tenant errada ou fallback genérico universal).
//
// Por tenant com logotipo configurado no banco:
//   1. busca o manifest servido em produção (/{slug}/manifest.webmanifest);
//   2. baixa cada ícone PNG listado no manifest (server-to-server, sem
//      navegador, sem cookies);
//   3. calcula SHA-256 dos bytes servidos;
//   4. baixa as 5 URLs de origem configuradas NO BANCO para esse tenant e
//      monta o conjunto "owned" = hashes brutos + hashes reproduzidos com o
//      mesmo pipeline Sharp do servidor (lib/pwa/icon-png.ts);
//   5. acusa: (a) colisão de hash entre tenants; (b) ícone servido que NÃO
//      pertence ao tenant; (c) maskable idêntico ao any (safe zone ausente);
//      (d) fonte compartilhada entre tenants (dado, não servidor).
//
// Uso:
//   node scripts/pwa-isolation-audit.mjs [--base=URL] [--limit=6]
//
// Sai com código 2 quando o isolamento falha.

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------- env ----
try {
  const txt = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {}

const args = process.argv.slice(2);
function arg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}

const BASE = (
  arg("base", process.env.PWA_AUDIT_BASE || "https://oleos.topconsultores.com.br") || ""
).replace(/\/$/, "");
const LIMIT = Number(arg("limit", "6"));

// ------------------------------------------------------------ helpers ----
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function fetchBytes(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "pwa-isolation-audit/1.0", accept: "*/*" },
      cache: "no-store",
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      cacheControl: res.headers.get("cache-control") || "",
      source: res.headers.get("x-pwa-icon-source") || "",
      bytes: buf,
    };
  } finally {
    clearTimeout(t);
  }
}

const looksLikePng = (b) =>
  b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

function pngSize(buf) {
  if (!looksLikePng(buf) || buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const KINDS = [
  ["180x180|any", 180, false],
  ["192x192|any", 192, false],
  ["512x512|any", 512, false],
  ["512x512|maskable", 512, true],
];

// Pipeline idêntico a lib/pwa/icon-png.ts (processWithSharpCached).
async function sharpVariant(sharp, input, size, theme, maskableSafeZone) {
  if (maskableSafeZone) {
    const inner = Math.round(size * 0.8);
    const art = await sharp(input, { failOn: "none" })
      .flatten({ background: theme })
      .resize(inner, inner, { fit: "contain", background: theme })
      .toBuffer();
    return sharp({
      create: { width: size, height: size, channels: 4, background: theme },
    })
      .composite([{ input: art, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return sharp(input, { failOn: "none" })
    .flatten({ background: theme })
    .resize(size, size, { fit: "contain", background: theme })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// --------------------------------------------------------------- main ----
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await db
    .from("pwa_settings")
    .select(
      "tenant_id,enabled,logo_url,icon_192_url,icon_512_url,icon_180_url,icon_maskable_512_url,app_name,theme_color,updated_at"
    )
    .limit(100);
  if (error) {
    console.error("Erro query pwa_settings:", error.message);
    process.exit(1);
  }

  const { data: tenants, error: tErr } = await db.from("tenants").select("id,slug,site_status");
  if (tErr) {
    console.error("Erro query tenants:", tErr.message);
    process.exit(1);
  }
  const byId = new Map((tenants || []).map((t) => [t.id, t]));

  const FIELDS = [
    "icon_180_url",
    "icon_192_url",
    "icon_512_url",
    "icon_maskable_512_url",
    "logo_url",
  ];
  const candidates = (rows || [])
    .filter((r) => FIELDS.some((f) => typeof r[f] === "string" && r[f].trim()))
    .map((r) => ({ ...r, tenant: byId.get(r.tenant_id) }))
    .filter((r) => r.tenant && r.tenant.slug)
    .slice(0, LIMIT);

  console.log(`Base: ${BASE}`);
  console.log(`Tenants candidatos (com logo/ícone no banco): ${candidates.length}\n`);
  if (candidates.length === 0) {
    console.log("NENHUM tenant com logotipo configurado — nada a auditar.");
    process.exit(0);
  }

  const sharp = (await import("sharp")).default;
  const results = [];

  for (const row of candidates) {
    const slug = row.tenant.slug;
    const entry = {
      slug,
      app: row.app_name || "",
      status: row.tenant.site_status,
      enabled: row.enabled,
      theme: /^#[0-9a-fA-F]{6}$/.test(row.theme_color || "") ? row.theme_color : "#1d5c3a",
      sources: {},
      owned: new Map(), // hash -> descrição
      errors: [],
      served: [],
    };

    // ---- 4a. fontes configuradas NO BANCO para este tenant
    for (const field of FIELDS) {
      const u = row[field];
      if (!u || typeof u !== "string" || !u.trim()) continue;
      try {
        const r = await fetchBytes(u);
        if (!r.ok) {
          entry.errors.push(`${field}: HTTP ${r.status}`);
          continue;
        }
        const h = sha256(r.bytes);
        entry.sources[field] = {
          url: u,
          hash: h,
          dim: pngSize(r.bytes),
          bytes: r.bytes.length,
          png: looksLikePng(r.bytes),
        };
        entry.owned.set(h, `raw ${field}`);
        // reproduz o pipeline Sharp do servidor a partir DESTA fonte
        for (const [key2, size, safe] of KINDS) {
          try {
            const buf = await sharpVariant(sharp, r.bytes, size, entry.theme, safe);
            entry.owned.set(sha256(buf), `sharp(${size}${safe ? ",maskable" : ""}) de ${field}`);
          } catch {
            /* fonte ilegível para sharp — ignora */
          }
        }
      } catch (e) {
        entry.errors.push(`${field}: ${e.message}`);
      }
    }

    // ---- 4b. manifest servido + ícones servidos
    const manifestUrl = `${BASE}/${slug}/manifest.webmanifest`;
    const mf = await fetchBytes(manifestUrl);
    entry.manifestStatus = mf.status;
    if (!mf.ok) {
      entry.errors.push(`manifest HTTP ${mf.status}`);
      results.push(entry);
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(mf.bytes.toString("utf8"));
    } catch {
      entry.errors.push("manifest inválido (JSON)");
      results.push(entry);
      continue;
    }
    entry.manifestName = manifest.name;
    entry.startUrl = manifest.start_url;
    entry.scope = manifest.scope;

    for (const icon of manifest.icons || []) {
      const u = String(icon.src || "");
      if (!/\.png(\?|$)/i.test(u)) continue;
      try {
        const r = await fetchBytes(u);
        const full = r.ok ? sha256(r.bytes) : null;
        const kindKey = `${icon.sizes}|${icon.purpose || "any"}`;
        let owned = "desconhecido";
        if (full) {
          const where = entry.owned.get(full);
          owned = where ? `SIM (${where})` : "NAO-DO-TENANT";
        }
        // ---- item 2: validação técnica do PNG servido
        const problems = [];
        let fmt = "-";
        let opaque = true;
        let hasAlpha = false;
        if (r.ok) {
          if (!looksLikePng(r.bytes)) problems.push("assinatura PNG inválida");
          try {
            const meta = await sharp(r.bytes, { failOn: "none" }).metadata();
            fmt = meta.format || "-";
            hasAlpha = !!meta.hasAlpha;
            if (fmt !== "png") problems.push(`formato real=${fmt}`);
            const declared = String(icon.sizes || "").trim();
            const dim = pngSize(r.bytes);
            if (declared && declared !== "any" && dim) {
              const want = declared.split(/\s+/)[0];
              if (`${dim.w}x${dim.h}` !== want) {
                problems.push(`dimensão ${dim.w}x${dim.h} != sizes ${want}`);
              }
            }
          } catch (e) {
            problems.push(`ilegível: ${e.message}`);
          }
          try {
            const stats = await sharp(r.bytes, { failOn: "none" }).stats();
            opaque = stats.isOpaque;
            if (!opaque) problems.push("TRANSPARENTE (risco de ícone fantasma no Android)");
          } catch {
            problems.push("stats() falhou");
          }
          if (r.bytes.length < 1024) problems.push("arquivo < 1KB");
          if (r.bytes.length > 500 * 1024) problems.push("arquivo > 500KB");
          if (!/^image\/png/.test(r.contentType || "")) {
            problems.push(`content-type=${r.contentType || "(ausente)"}`);
          }
        } else {
          problems.push(`HTTP ${r.status}`);
        }
        entry.served.push({
          kind: kindKey,
          sizes: icon.sizes,
          purpose: icon.purpose || "any",
          status: r.status,
          contentType: r.contentType,
          header: r.source,
          bytes: r.bytes.length,
          png: looksLikePng(r.bytes),
          dim: pngSize(r.bytes),
          hash16: full ? full.slice(0, 16) : `HTTP ${r.status}`,
          fullHash: full,
          owned,
          fmt,
          opaque,
          hasAlpha,
          problems,
        });
      } catch (e) {
        entry.served.push({ kind: kindKeyOf(icon), status: "ERR", owned: e.message });
      }
    }
    results.push(entry);
  }

  function kindKeyOf(icon) {
    return `${icon.sizes}|${icon.purpose || "any"}`;
  }

  // --------------------------------------------------------- relatório ----
  console.log("=".repeat(140));
  console.log("0) FONTES CONFIGURADAS NO BANCO (URL + SHA-256 dos bytes)");
  console.log("=".repeat(140));
  for (const r of results) {
    console.log(`\n[${r.slug}] app="${r.app}" status=${r.status} enabled=${r.enabled} theme=${r.theme}`);
    const fields = Object.entries(r.sources);
    if (fields.length === 0) console.log("   (nenhuma fonte acessível)");
    for (const [f, s] of fields) {
      console.log(
        `   ${f.padEnd(24)} ${String(s.dim ? `${s.dim.w}x${s.dim.h}` : "-").padEnd(10)} ${String(s.bytes).padEnd(8)}B png=${s.png ? "sim" : "NAO"} ${s.hash.slice(0, 16)} ${s.url}`
      );
    }
    if (r.errors.length) console.log(`   erros: ${r.errors.join(" | ")}`);
  }

  console.log("\n" + "=".repeat(140));
  console.log("1) ÍCONES SERVIDOS EM PRODUÇÃO (server-to-server, hash SHA-256)");
  console.log("=".repeat(140));
  const header = [
    "tenant".padEnd(16),
    "mf".padEnd(4),
    "kind".padEnd(16),
    "dim".padEnd(10),
    "bytes".padEnd(7),
    "png".padEnd(4),
    "hash".padEnd(17),
    "pertence ao tenant?".padEnd(34),
    "hdr".padEnd(8),
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

  const servedByHash = new Map(); // hash -> Set(slug)
  const rawByHash = new Map(); // hash de FONTE -> Set(slug)
  let notOwned = 0;

  for (const r of results) {
    for (const s of r.served) {
      if (s.owned === "NAO-DO-TENANT") notOwned++;
      console.log(
        [
          r.slug.padEnd(16),
          String(r.manifestStatus).padEnd(4),
          String(s.kind).padEnd(16),
          String(s.dim ? `${s.dim.w}x${s.dim.h}` : "-").padEnd(10),
          String(s.bytes ?? "-").padEnd(7),
          (s.png ? "sim" : "NAO").padEnd(4),
          String(s.hash16).padEnd(17),
          String(s.owned).padEnd(34),
          String(s.header || "-").padEnd(8),
        ].join(" | ")
      );
      if (s.fullHash) {
        if (!servedByHash.has(s.fullHash)) servedByHash.set(s.fullHash, new Set());
        servedByHash.get(s.fullHash).add(r.slug);
      }
    }
    if (r.served.length === 0) {
      console.log(`${r.slug.padEnd(16)} | ${String(r.manifestStatus).padEnd(4)} | (sem PNG no manifest) ${r.errors.join(" ")}`);
    }
    // maskable x any: safe zone
    const any512 = r.served.find((s) => s.kind === "512x512|any");
    const mask512 = r.served.find((s) => s.kind === "512x512|maskable");
    if (any512 && mask512 && any512.fullHash && any512.fullHash === mask512.fullHash) {
      console.log(
        `   !! ${r.slug}: icon-maskable-512.png é IDÊNTICO a icon-512.png (safe zone de 80% AUSENTE)`
      );
      r.maskableSameAsAny = true;
    }
    console.log("");
  }

  // ------------------------------------------- item 2: validação técnica ----
  console.log("=".repeat(140));
  console.log("1b) VALIDAÇÃO TÉCNICA DOS PNGs (item 2) — assinatura, dimensão exata,");
  console.log("    formato, tamanho e opacidade (alfa) de cada ícone servido");
  console.log("=".repeat(140));
  let techIssues = 0;
  const techHeader = [
    "tenant".padEnd(16),
    "kind".padEnd(16),
    "dim".padEnd(10),
    "declarado".padEnd(10),
    "fmt".padEnd(5),
    "bytes".padEnd(7),
    "alfa".padEnd(8),
    "opaco".padEnd(6),
    "problemas".padEnd(40),
  ].join(" | ");
  console.log(techHeader);
  console.log("-".repeat(techHeader.length));
  for (const r of results) {
    for (const s of r.served) {
      if (!s.problems) continue;
      if (s.problems.length) techIssues++;
      console.log(
        [
          r.slug.padEnd(16),
          String(s.kind).padEnd(16),
          String(s.dim ? `${s.dim.w}x${s.dim.h}` : "-").padEnd(10),
          String(s.sizes).padEnd(10),
          String(s.fmt).padEnd(5),
          String(s.bytes).padEnd(7),
          (s.hasAlpha ? "sim" : "nao").padEnd(8),
          (s.opaque ? "sim" : "NAO").padEnd(6),
          (s.problems.length ? s.problems.join("; ") : "ok").padEnd(40),
        ].join(" | ")
      );
    }
  }
  if (techIssues === 0) console.log("OK — todos os PNGs servidos passam na validação técnica.");
  console.log("");

  for (const r of results) {
    for (const src of Object.values(r.sources)) {
      if (!rawByHash.has(src.hash)) rawByHash.set(src.hash, new Set());
      rawByHash.get(src.hash).add(r.slug);
    }
  }

  // -------------------------------------------------- teste de colisão ----
  console.log("=".repeat(140));
  console.log("2) TESTE DE COLISÃO — mesmo hash SERVIDO para tenants diferentes");
  console.log("=".repeat(140));
  const servedCollisions = [...servedByHash.entries()].filter(([, set]) => set.size > 1);
  if (servedCollisions.length === 0) {
    console.log("OK — nenhum hash de ícone servido é compartilhado entre tenants.");
  } else {
    for (const [h, set] of servedCollisions) {
      console.log(`COLISAO SERVIDA: ${h.slice(0, 16)} -> ${[...set].join(", ")}`);
    }
  }

  console.log("\n" + "=".repeat(140));
  console.log("3) FONTE COMPARTILHADA (mesmo arquivo no R2 configurado por 2 tenants)");
  console.log("=".repeat(140));
  const rawCollisions = [...rawByHash.entries()].filter(([, set]) => set.size > 1);
  if (rawCollisions.length === 0) {
    console.log("OK — nenhum arquivo de origem é compartilhado entre tenants.");
  } else {
    for (const [h, set] of rawCollisions) {
      console.log(
        `FONTE COMPARTILHADA: ${h.slice(0, 16)} -> ${[...set].join(", ")}  (dado igual no banco, não é bug de cache do servidor)`
      );
    }
  }

  // Uma colisão SERVIDA só é bug de isolamento se os tenants envolvidos não
  // compartilharem a MESMA fonte no banco (aí a igualdade seria esperada).
  const sharedGroups = rawCollisions.map(([, set]) => set);
  const isDataOnly = (slugs) => sharedGroups.some((g) => slugs.every((s) => g.has(s)));
  const realServedCollisions = servedCollisions.filter(([, set]) => !isDataOnly([...set]));

  console.log("\n" + "=".repeat(140));
  console.log("4) CLASSIFICAÇÃO DAS COLISÕES SERVIDAS");
  console.log("=".repeat(140));
  if (servedCollisions.length === 0) {
    console.log("(nenhuma)");
  }
  for (const [h, set] of servedCollisions) {
    const dataOnly = isDataOnly([...set]);
    console.log(
      `${h.slice(0, 16)} -> ${[...set].join(", ")} : ${
        dataOnly
          ? "DADO (mesmo arquivo configurado no banco pelos dois tenants) — isolamento do SERVIDOR OK"
          : "BUG DE ISOLAMENTO DO SERVIDOR (fontes diferentes, ícone idêntico)"
      }`
    );
  }

  // -------------------------------------------------------- veredito ----
  console.log("\n" + "=".repeat(140));
  const maskableIssues = results.filter((r) => r.maskableSameAsAny).map((r) => r.slug);
  const okServe = realServedCollisions.length === 0 && notOwned === 0;
  console.log(`Ícones servidos que NÃO pertencem ao tenant:        ${notOwned}`);
  console.log(`Colisões servidas com fontes DIFERENTES (bug real): ${realServedCollisions.length}`);
  console.log(`Colisões servidas por FONTE igual no banco (dado):   ${servedCollisions.length - realServedCollisions.length}`);
  console.log(`Fontes idênicas no banco entre tenants:             ${rawCollisions.length}`);
  console.log(`Problemas técnicos de PNG (item 2):                 ${techIssues}`);
  console.log(`Maskable idêntico ao any (sem safe zone):           ${maskableIssues.length ? maskableIssues.join(", ") : "nenhum"}`);
  console.log(
    okServe
      ? "VEREDITO ISOLAMENTO DE SERVIÇO: OK — cada tenant recebe o ícone derivado do próprio upload."
      : "VEREDITO ISOLAMENTO DE SERVIÇO: QUEBRADO — ver itens acima."
  );
  console.log("=".repeat(140));
  process.exit(okServe ? 0 : 2);
}

main().catch((e) => {
  console.error("Falha na auditoria:", e);
  process.exit(1);
});
