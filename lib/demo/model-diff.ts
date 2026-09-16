"use client";

import type { DemoData } from "./types";

/**
 * Diferença local vs. HOME MODELO para a demonstração pública.
 *
 * A página /demonstracao usa a HOME MODELO viva (/admin/editor-home) como
 * base e aplica por cima SOMENTE as edições reais do visitante (diff contra
 * o seed estático). Sem edição local, a demo espelha o modelo atual; com
 * edição, o valor local vence — e nada é gravado no banco (tudo localStorage).
 */

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (isPlainRecord(v)) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) o[k] = sortDeep(v[k]);
    return o;
  }
  return v;
}

/**
 * Diferença real do visitante em relação ao seed estático: só o que ele
 * alterou de verdade. Tudo que continua igual ao seed é considerado
 * "não personalizado" e cai para a HOME MODELO viva (quando houver).
 */
export function diffAgainstSeed(
  local: Record<string, unknown>,
  seed: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(local || {})) {
    const s = (seed || {})[k];
    if (isPlainRecord(v) && isPlainRecord(s)) {
      const nested = diffAgainstSeed(v, s);
      if (Object.keys(nested).length > 0) out[k] = nested;
    } else if (JSON.stringify(sortDeep(v)) !== JSON.stringify(sortDeep(s))) {
      out[k] = v;
    }
  }
  return out;
}

/** Campos de identidade do site vindos do modelo (mesmas chaves de site_settings). */
export const MODEL_SITE_KEYS = [
  "name",
  "surname",
  "fullName",
  "role",
  "eyebrow",
  "description",
  "badgeTitle",
  "badgeSubtitle",
  "whatsapp",
  "whatsapp_floating_enabled",
  "email",
  "instagram",
  "instagramHandle",
  "logoMode",
  "logoText",
  "logoUrl",
  "logoLightUrl",
  "stats",
  "social",
] as const;

function mergeRecords(
  base: Record<string, unknown>,
  saved?: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  if (!saved) return out;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) continue;
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = mergeRecords(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Identidade efetiva do site da demonstração: edição local do visitante
 * vence; sem edição, vale a HOME MODELO viva; sem modelo, o seed estático.
 * Valores vazios do modelo não apagam o seed.
 */
export function buildDemoSite(
  demo: DemoData,
  seed: DemoData,
  modelSite?: Record<string, unknown> | null
): DemoData["site"] {
  const src = (modelSite || {}) as Record<string, unknown>;
  const modelPick: Record<string, unknown> = {};
  for (const k of MODEL_SITE_KEYS) {
    const v = src[k];
    if (v !== undefined && v !== null && v !== "") modelPick[k] = v;
  }
  const siteDiff = diffAgainstSeed(
    demo.site as unknown as Record<string, unknown>,
    seed.site as unknown as Record<string, unknown>
  );
  return mergeRecords(
    mergeRecords({ ...(seed.site as unknown as Record<string, unknown>) }, modelPick),
    siteDiff
  ) as unknown as DemoData["site"];
}
