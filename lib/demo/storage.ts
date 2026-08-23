"use client";

import { DEMO_NAMESPACE, buildDemoSeed } from "./seed";
import type { DemoData } from "./types";

const STORAGE_KEY = `${DEMO_NAMESPACE}data`;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
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
    return JSON.parse(raw) as DemoData;
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
