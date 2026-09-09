"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";

/** Inputs altos, borda suave e foco elegante (padrão da página de login). */
const FIELD_CLS =
  "w-full h-[52px] rounded-xl border border-[#dbe3db] bg-white pl-11 pr-4 text-[15px] text-[#0f1a2a] placeholder:text-[#9aa8b5] outline-none transition focus:border-[#1d5c3a] focus:ring-4 focus:ring-[#1d5c3a]/10";

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa8b5]">
      {children}
    </span>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdminArea, setShowAdminArea] = useState(false);
  const [demoStarting, setDemoStarting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      setLoading(false);
      return;
    }

    const next = searchParams.get("next");
    router.push(next && next.startsWith("/") ? next : "/painel");
    router.refresh();
  }

  async function quickLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Não foi possível entrar com a conta de teste.");
        setLoading(false);
        return;
      }
      router.push(json.redirect || "/admin");
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor. Tente novamente.");
      setLoading(false);
    }
  }

  async function startDemo() {
    setError(null);
    setDemoStarting(true);
    try {
      const res = await fetch("/api/demo/start", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Não foi possível iniciar a demonstração.");
        setDemoStarting(false);
        return;
      }
      router.push(json.redirect || "/painel");
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor. Tente novamente.");
      setDemoStarting(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    const targetEmail = (forgotEmail || email).trim().toLowerCase();
    if (!targetEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
      setForgotError("Informe um e-mail válido.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setForgotError(json.error || "Não foi possível enviar o e-mail.");
        setForgotLoading(false);
        return;
      }
      setForgotSuccess(json.message || "Enviamos um e-mail com instruções para criar uma nova senha.");
    } catch {
      setForgotError("Falha de conexão. Tente novamente.");
    }
    setForgotLoading(false);
  }

  return (
    <div className="w-full">
      {/* ============ CARD DE LOGIN ============ */}
      <section aria-label="Entrar na conta" className="rounded-[24px] bg-white border border-[#e7ece8] shadow-[0_16px_48px_rgba(16,61,45,0.08)] p-7 sm:p-9">
        {!forgotMode ? (
          <>
            <header className="text-center">
              <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f1a2a] leading-tight">
                Bem-vindo(a)!
              </h1>
              <p className="text-[14px] leading-6 text-[#6b7a89] mt-2.5">
                Entre na sua conta para acessar seu painel.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
              <div>
                <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2" htmlFor="email">
                  E-mail
                </label>
                <div className="relative">
                  <FieldIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </FieldIcon>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={FIELD_CLS}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[13px] font-semibold text-[#0f1a2a]" htmlFor="password">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotError(null);
                      setForgotSuccess(null);
                      setForgotMode(true);
                    }}
                    className="text-[13px] font-semibold text-[#1d5c3a] hover:underline underline-offset-2 rounded focus-visible:outline-2 focus-visible:outline-[#1d5c3a]"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <FieldIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="11" width="14" height="10" rx="2.5" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </FieldIcon>
                  <PasswordField
                    id="password"
                    required
                    value={password}
                    onChange={setPassword}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    className={`${FIELD_CLS} pr-12`}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm leading-5 text-[#991b1b]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-xl bg-[#1d5c3a] px-6 text-[15px] font-bold tracking-wide text-white shadow-[0_10px_28px_rgba(29,92,58,0.28)] hover:bg-[#154730] active:bg-[#103d2d] transition disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2.5"
              >
                {loading ? (
                  <>
                    <span className="w-[18px] h-[18px] rounded-full border-[2.5px] border-white/30 border-t-white animate-spin" aria-hidden />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            <div className="mt-7 pt-6 border-t border-[#eef2ee] text-center">
              <p className="text-[13.5px] text-[#6b7a89] leading-5">Ainda não possui uma conta?</p>
              <Link
                href="/cadastro"
                className="mt-3 flex items-center justify-center w-full h-[50px] rounded-xl border-[1.5px] border-[#dbe3db] bg-white px-6 text-[14.5px] font-bold text-[#1d5c3a] hover:border-[#1d5c3a] hover:bg-[#f2f8f3] active:bg-[#e9f2ea] transition"
              >
                Criar conta
              </Link>
            </div>
          </>
        ) : (
          <>
            <header className="text-center">
              <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-[#0f1a2a] leading-tight">
                Recuperar senha
              </h1>
              <p className="text-[14px] leading-6 text-[#6b7a89] mt-2.5">
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </p>
            </header>

            <form onSubmit={handleForgot} className="mt-8 space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-[#0f1a2a] mb-2" htmlFor="forgot-email">
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <FieldIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </FieldIcon>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    className={FIELD_CLS}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
              </div>

              {forgotError && (
                <p role="alert" className="rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm leading-5 text-[#991b1b]">
                  {forgotError}
                </p>
              )}
              {forgotSuccess && (
                <p role="status" className="rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-3 text-sm leading-5 text-[#166534]">
                  {forgotSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full h-[52px] rounded-xl bg-[#1d5c3a] px-6 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(29,92,58,0.28)] hover:bg-[#154730] active:bg-[#103d2d] transition disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2.5"
              >
                {forgotLoading ? (
                  <>
                    <span className="w-[18px] h-[18px] rounded-full border-[2.5px] border-white/30 border-t-white animate-spin" aria-hidden />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="w-full h-[50px] rounded-xl border-[1.5px] border-[#dbe3db] bg-white px-6 text-[14.5px] font-bold text-[#334155] hover:border-[#1d5c3a] hover:text-[#1d5c3a] transition"
              >
                Voltar ao login
              </button>
            </form>
          </>
        )}
      </section>

      {/* ============ CARD DEMONSTRAÇÃO ============ */}
      <section aria-label="Experimente a demonstração" className="mt-6 rounded-[24px] border border-[#cfe6d4] bg-gradient-to-br from-[#eef7ef] via-[#f7fbf4] to-white shadow-[0_12px_36px_rgba(29,92,58,0.10)] p-7 sm:p-8">
        <span className="inline-flex items-center rounded-full bg-[#1d5c3a] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white">
          Acesso rápido • Sem cadastro
        </span>
        <h2 className="mt-3.5 text-[20px] sm:text-[21px] font-bold tracking-tight text-[#0f1a2a] leading-snug">
          ⚡ Experimente antes de começar
        </h2>
        <p className="mt-2 text-[13.5px] leading-6 text-[#4b5a48]">
          Acesse a demonstração e explore tudo o que você poderá ter no seu próprio site.
        </p>

        <ul className="mt-5 space-y-2.5">
          {[
            "Explore o painel completo",
            "Teste ferramentas e recursos",
            "Personalize e veja como funciona",
            "Alterações ficam somente neste dispositivo",
            "Nada é alterado em sites reais",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-5 text-[#334155]">
              <span aria-hidden className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1d5c3a]/10">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d5c3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={startDemo}
          disabled={demoStarting || loading}
          className="mt-6 flex items-center justify-center gap-2 w-full h-[52px] rounded-xl bg-[#1d5c3a] px-6 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(29,92,58,0.28)] hover:bg-[#154730] active:bg-[#103d2d] transition disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {demoStarting ? (
            <>
              <span className="w-[18px] h-[18px] rounded-full border-[2.5px] border-white/30 border-t-white animate-spin" aria-hidden />
              Preparando seu acesso...
            </>
          ) : (
            "⚡ Entrar na demonstração"
          )}
        </button>
        <p className="mt-3.5 text-center text-[11.5px] leading-4 text-[#8a9aa8]">
          Área de testes • sem cadastro
        </p>
      </section>

      {/* Acesso de testes (utilidade de desenvolvimento, discreto) */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setShowAdminArea((v) => !v)}
          className="text-[11.5px] text-[#a4b3ad] hover:text-[#6b7a89] transition-colors rounded focus-visible:outline-2 focus-visible:outline-[#1d5c3a]"
        >
          {showAdminArea ? "Ocultar área de testes" : "Área de testes"}
        </button>
        {showAdminArea && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white/70 p-3">
            <button
              type="button"
              onClick={quickLogin}
              disabled={loading}
              className="w-full min-h-[44px] text-xs font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2 rounded"
            >
              Entrar como administrador de testes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
