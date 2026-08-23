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

export function useDemoStore() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<DemoData | null>(null);

  useEffect(() => {
    // Os componentes de demonstração só são renderizados quando o servidor
    // valida o cookie DEMO (httpOnly, invisível para document.cookie).
    // Portanto basta carregar os dados locais do dispositivo.
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
