import Link from "next/link";

/**
 * Aviso discreto exibido nas páginas PÚBLICAS quando o usuário está logado.
 * Não bloqueia a navegação: apenas indica a sessão e dá acesso rápido ao
 * painel. Adequado para servidor (sem estado).
 */
export function LoggedInNotice({ email }: { email?: string }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 9999,
        background: "#0e3b28",
        color: "#fff",
        fontSize: 12,
        padding: "8px 14px",
        borderRadius: 999,
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        fontFamily: "var(--font-body)",
      }}
    >
      ✓ Você está logado{email ? ` (${email})` : ""} ·{" "}
      <Link href="/painel" style={{ color: "#a7e0c0", textDecoration: "underline" }}>
        Painel
      </Link>{" "}
      ·{" "}
      <a href="/auth/signout" style={{ color: "#a7e0c0", textDecoration: "underline" }}>
        Sair
      </a>
    </div>
  );
}