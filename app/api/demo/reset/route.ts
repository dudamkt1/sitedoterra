import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/auth";

export const runtime = "nodejs";

/**
 * POST /api/demo/reset
 * Confirma que o caller está em modo DEMO e devolve um sinal para o
 * frontend limpar o localStorage. NUNCA toca Supabase/R2/Stripe.
 */
export async function POST() {
  if (!(await isDemoMode())) {
    return NextResponse.json({ error: "Modo demonstração não ativo." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, clearLocalStorage: true });
}
