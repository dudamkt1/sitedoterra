"use client";

import { useEffect } from "react";
import { handleDemoApi, type DemoApiResult } from "@/lib/demo/mock-api";

/**
 * Interceptor de fetch do MODO DEMONSTRAÇÃO.
 * Montado no layout do /painel (e no site /demonstracao) quando a sessão
 * demo está ativa. Todas as chamadas /api/* são respondidas localmente com
 * dados do localStorage — nada trafega ao servidor, sites reais ficam intactos.
 */
export function DemoFetchBridge() {
  useEffect(() => {
    const w = window as any;
    if (w.__demoFetchBridge) return;
    const original = window.fetch.bind(window);
    w.__demoFetchBridge = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        let url: URL;
        if (typeof input === "string") url = new URL(input, location.origin);
        else if (input instanceof URL) url = input;
        else url = new URL(input.url, location.origin);

        const method = (
          init?.method || (input instanceof Request ? input.method : "GET") || "GET"
        ).toUpperCase();

        // Upload binário simulado (presign → PUT)
        if (url.protocol === "demo-upload:") {
          return new Response(null, { status: 200 });
        }

        const isApi =
          url.origin === location.origin && url.pathname.startsWith("/api/");
        if (!isApi) return original(input as any, init);

        // Rotas de gestão da própria demonstração: passam direto.
        if (url.pathname.startsWith("/api/demo/")) {
          return original(input as any, init);
        }

        // Extrai o corpo (JSON ou multipart com arquivo)
        let body: any = null;
        const rawBody = init?.body ?? null;
        if (rawBody instanceof FormData) {
          body = {};
          const entries: [string, FormDataEntryValue][] = [];
          rawBody.forEach((v, k) => entries.push([k, v]));
          for (const pair of entries) {
            const k = pair[0];
            const v = pair[1];
            if (typeof File !== "undefined" && v instanceof File) {
              body[k] = await fileToPayload(v);
            } else {
              body[k] = v;
            }
          }
        } else if (typeof rawBody === "string" && rawBody) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        } else if (input instanceof Request && !init?.body) {
          try {
            const cloned = input.clone();
            const ct = input.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              body = await cloned.json().catch(() => null);
            }
          } catch {}
        }

        const result: DemoApiResult = await handleDemoApi(
          url.pathname,
          url.searchParams,
          method,
          body
        );

        return new Response(JSON.stringify(result.json), {
          status: result.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.warn("[demo-bridge]", e);
        return new Response(JSON.stringify({ error: "Falha na demonstração." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    };
  }, []);

  return null;
}

function fileToPayload(file: File): Promise<{ dataUrl: string; name: string; type: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      resolve({
        dataUrl: String(reader.result || ""),
        name: file.name,
        type: file.type,
        size: file.size,
      });
    reader.readAsDataURL(file);
  });
}
