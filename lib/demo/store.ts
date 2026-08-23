"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadDemoData,
  saveDemoData,
  resetDemoData,
  clearAllDemoStorage,
  genId,
} from "./storage";
import type { DemoData } from "./types";

const DEMO_FLAG = "sitedoterra_demo_active";

function detectDemoActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith("sitedoterra_demo="));
}

export function useDemoStore() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<DemoData | null>(null);

  useEffect(() => {
    if (!detectDemoActive()) {
      setReady(true);
      return;
    }
    setData(loadDemoData());
    setReady(true);
  }, []);

  const update = useCallback((mutator: (draft: DemoData) => DemoData) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = mutator({ ...prev });
      saveDemoData(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const seed = resetDemoData();
    setData(seed);
  }, []);

  const clearAll = useCallback(() => {
    clearAllDemoStorage();
    setData(null);
  }, []);

  return {
    ready,
    isDemo: Boolean(data),
    data,
    update,
    reset,
    clearAll,
    genId,
  };
}

export { DEMO_FLAG };
