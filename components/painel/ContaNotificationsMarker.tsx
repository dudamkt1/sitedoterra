"use client";

import { useEffect } from "react";

/** Marca as notificações de "Minha Conta" como lidas quando o usuário abre a página. */
export function MarkContaNotificationsRead() {
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/user/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readAll: true }),
        });
      } catch {
        // silencioso: não quebra a página
      }
    })();
  }, []);
  return null;
}
