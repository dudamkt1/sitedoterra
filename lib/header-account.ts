import type { User } from "@supabase/supabase-js";
import { getProfile } from "@/lib/auth";

/**
 * Dados exibidos no menu de conta do NAV público quando o usuário está logado.
 * Substitui o antigo link "Painel": o nome do usuário vira o rótulo e o menu
 * suspenso oferece "Painel" e "Sair".
 */
export interface HeaderAccount {
  name: string;
  email?: string;
  panelHref: string;
  signOutHref: string;
}

/** `next=` só aceita caminhos internos (bloqueia `//evil.com` e URLs externas). */
function safeNext(returnTo?: string) {
  return returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}

/**
 * Monta o menu de conta a partir do usuário da sessão.
 * Prioriza o nome editado em /painel/conta (profiles.name), cai para o
 * metadata do cadastro e, por último, para o prefixo do e-mail.
 * Retorna null para visitantes não logados (o link "Painel" continua como era).
 */
export async function buildHeaderAccount(
  user: User | null | undefined,
  returnTo?: string,
): Promise<HeaderAccount | null> {
  if (!user) return null;

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const fromMeta = [meta.name, meta.full_name].find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  let name = "";
  try {
    name = ((await getProfile(user.id))?.name || "").trim();
  } catch {
    // sem Supabase/profile — segue pelo metadata
  }
  if (!name) name = (fromMeta || "").trim();

  const email = user.email || "";
  if (!name && email) name = email.split("@")[0];

  return {
    name: name || "Minha conta",
    email: email || undefined,
    panelHref: "/painel",
    signOutHref: `/auth/signout?next=${encodeURIComponent(safeNext(returnTo))}`,
  };
}
