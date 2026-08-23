"use client";

import { DEMO_NAMESPACE, buildDemoSeed } from "./seed";
import type { DemoData, DemoSectionState } from "./types";

const STORAGE_KEY = `${DEMO_NAMESPACE}data`;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Une dados salvos (formatos antigos incluídos) com o seed atual, garantindo
 * que campos/seções novos existam mesmo para quem já tinha demo no navegador.
 */
function normalizeDemoData(raw: unknown): DemoData {
  const seed = buildDemoSeed();
  if (!raw || typeof raw !== "object") return seed;
  const saved = raw as Partial<DemoData> & { sections?: Record<string, unknown> };

  const merged: DemoData = {
    ...seed,
    ...saved,
    site: { ...seed.site, ...(saved.site || {}) },
  } as DemoData;

  const stats = (merged.site as { stats?: unknown }).stats;
  merged.site.stats =
    stats && typeof stats === "object"
      ? { ...seed.site.stats, ...(stats as Record<string, string>) }
      : seed.site.stats;

  const social = (merged.site as { social?: unknown }).social;
  if (!social || typeof social !== "object") {
    merged.site.social = seed.site.social;
  } else {
    const s: DemoData["site"]["social"] = { ...seed.site.social };
    for (const key of Object.keys(s) as Array<keyof DemoData["site"]["social"]>) {
      s[key] = { ...s[key], ...((social as Record<string, object>)[key] || {}) };
    }
    merged.site.social = s;
  }

  const sections: Record<string, DemoSectionState> = {};
  for (const [key, def] of Object.entries(seed.sections)) {
    const savedSection = (saved.sections || {})[key];
    if (typeof savedSection === "boolean") {
      sections[key] = { enabled: savedSection, content: def.content };
    } else if (savedSection && typeof savedSection === "object") {
      const obj = savedSection as { enabled?: boolean; content?: Record<string, unknown> };
      // Descarta valores nulos salvos para que melhorias futuras nos padrões
      // (ex.: novas imagens padrão) alcancem demonstrações já iniciadas.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj.content || {})) {
        if (v !== null) cleaned[k] = v;
      }
      sections[key] = {
        enabled: obj.enabled !== false,
        content: { ...def.content, ...cleaned },
      };
    } else {
      sections[key] = def;
    }
  }
  merged.sections = sections;

  return merged;
}

export function loadDemoData(): DemoData {
  if (!isBrowser()) return buildDemoSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = buildDemoSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return normalizeDemoData(JSON.parse(raw));
  } catch {
    const seed = buildDemoSeed();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {}
    return seed;
  }
}

export function saveDemoData(data: DemoData): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function resetDemoData(): DemoData {
  if (!isBrowser()) return buildDemoSeed();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return loadDemoData();
}

export function clearAllDemoStorage(): void {
  if (!isBrowser()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DEMO_NAMESPACE)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
    if (typeof sessionStorage !== "undefined") {
      const sessionKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(DEMO_NAMESPACE)) sessionKeys.push(k);
      }
      for (const k of sessionKeys) sessionStorage.removeItem(k);
    }
  } catch {}
}

export function genId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}
