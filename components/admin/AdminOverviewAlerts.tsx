"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SEEN_KEY = "admin_seen_notifications";

interface Item {
  id: string;
  kind: "refund" | "feedback" | "new_user";
  title: string;
  detail: string;
  created_at: string;
  href: string;
}

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function markSeen(ids: string[]) {
  try {
    const prev = new Set(readSeen());
    for (const id of ids) prev.add(id);
    // Limita o histórico para não crescer sem fim.
    const arr = Array.from(prev).slice(-500);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
  try {
    window.dispatchEvent(new Event("admin-notifications-seen"));
  } catch {}
}

function kindIcon(kind: Item["kind"]) {
  if (kind === "refund") return "💸";
  if (kind === "feedback") return "💬";
  return "🆕";
}

/**
 * Alerta vermelho no topo da "Visão geral" (/admin).
 * Mostra O QUE acabou de acontecer (pedido de reembolso, mensagem de
 * usuário, novo cadastro). Após o admin VER, marca como visto e o aviso
 * some (a badge vermelha da sidebar apaga junto) — só volta com evento NOVO.
 *
 * Não altera nada do fluxo de reembolso: o painel "Pedidos de Reembolso"
 * abaixo continua intacto.
 */
export function AdminOverviewAlerts() {
  const [fresh, setFresh] = useState<Item[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    let seenTimer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      try {
        const res = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const seen = new Set(readSeen());
        const items = ((j.items || []) as Item[]).filter((i) => !seen.has(i.id));
        if (!alive) return;
        setFresh(items);
        // Após VER o alerta, ele pode sumir: marca como visto sozinho.
        if (items.length > 0) {
          if (seenTimer) clearTimeout(seenTimer);
          seenTimer = setTimeout(() => {
            markSeen(items.map((i) => i.id));
          }, 5000);
        }
      } catch {
        // silencioso
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
      if (seenTimer) clearTimeout(seenTimer);
    };
  }, []);

  if (dismissed || fresh.length === 0) return null;

  function dismiss() {
    markSeen(fresh.map((i) => i.id));
    setDismissed(true);
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-red-500 bg-red-50 shadow-[0_8px_30px_rgba(220,38,38,0.15)]">
      <div className="flex items-center justify-between gap-3 bg-red-600 px-5 py-3 text-white">
        <p className="text-sm font-bold">
          🔔 {fresh.length} novidade{fresh.length > 1 ? "s" : ""} para você ver
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
        >
          Entendi, dispensar
        </button>
      </div>
      <ul className="divide-y divide-red-100">
        {fresh.slice(0, 10).map((i) => (
          <li key={i.id} className="px-5 py-3">
            <p className="text-sm font-semibold text-red-900">
              {kindIcon(i.kind)} {i.title}
            </p>
            {i.detail && <p className="mt-0.5 text-xs text-red-800/80">{i.detail}</p>}
            <p className="mt-1 text-[11px] text-red-700/60">
              {new Date(i.created_at).toLocaleString("pt-BR")} ·{" "}
              <Link href={i.href} className="font-semibold underline">
                Ver →
              </Link>
            </p>
          </li>
        ))}
      </ul>
      {fresh.length > 10 && (
        <p className="px-5 py-2 text-xs text-red-700">+ {fresh.length - 10} outras novidades…</p>
      )}
    </div>
  );
}
