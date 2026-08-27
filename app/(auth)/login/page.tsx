"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
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
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Entrar no painel
      </h1>
      <p className="text-sm text-gray-500 mb-6">Acesse sua conta para gerenciar seu site e assinatura.</p>

      {!forgotMode ? (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0" htmlFor="password">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotError(null);
                    setForgotSuccess(null);
                    setForgotMode(true);
                  }}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--verde)" }}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <PasswordField
                id="password"
                required
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-semibold" style={{ color: "var(--verde)" }}>
              Criar conta
            </Link>
          </p>
        </>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Recuperar senha
          </h2>
          <p className="text-sm text-gray-500 mb-4">Informe seu e-mail cadastrado. Enviaremos um link para criar uma nova senha.</p>
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="label" htmlFor="forgot-email">E-mail cadastrado</label>
              <input
                id="forgot-email"
                type="email"
                required
                className="input"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            {forgotError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{forgotError}</p>}
            {forgotSuccess && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{forgotSuccess}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={forgotLoading}>
              {forgotLoading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setForgotError(null);
                setForgotSuccess(null);
              }}
              className="btn btn-outline w-full"
            >
              Voltar ao login
            </button>
          </form>
        </div>
      )}

      <div className="mt-8 relative rounded-xl border-2 border-[#1d5c3a] bg-gradient-to-br from-[#e5f4ea] via-[#faf8f2] to-[#fdf6e9] p-5 shadow-md overflow-hidden">
        <span
          aria-hidden
          className="absolute -right-4 -top-4 text-6xl opacity-10 select-none pointer-events-none"
        >
          🔓
        </span>

        <span className="inline-block mb-2 rounded-full bg-[#1d5c3a] px-3 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-white">
          Acesso rápido • Sem cadastro
        </span>

        <h2
          className="text-lg font-bold text-[#1d5c3a] leading-snug mb-1.5"
          style={{ fontFamily: "var(--font-display)" }}
        >
          👀 Acesse e veja por dentro tudo o que você poderá adquirir!
        </h2>

        <p className="text-xs text-gray-700 leading-relaxed mb-3">
          Entre com <strong>1 clique</strong> e explore o painel completo como se
          o site já fosse seu: edite seções, teste a IA, gerencie clientes no
          CRM e muito mais.
        </p>

        <ul className="text-xs text-gray-600 space-y-1 mb-4">
          <li>✅ Tudo liberado para você explorar</li>
          <li>🔒 Suas alterações ficam salvas apenas neste navegador/celular</li>
          <li>🛡️ Nada é alterado em nenhum site real</li>
        </ul>

        <button
          type="button"
          onClick={startDemo}
          disabled={demoStarting || loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1d5c3a] px-4 py-3 text-sm font-bold text-white shadow hover:bg-[#154730] transition-colors disabled:opacity-60"
        >
          ⚡{" "}
          {demoStarting ? "Preparando seu acesso..." : "Entrar agora — ver demonstração"}
        </button>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-100 flex justify-center">
        <button
          type="button"
          onClick={() => setShowAdminArea((v) => !v)}
          className="text-[0.65rem] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showAdminArea ? "Ocultar área de testes" : "Área de testes"}
        </button>
      </div>

      {showAdminArea && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={quickLogin}
            disabled={loading}
            className="w-full text-xs font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2"
          >
            Entrar como administrador de testes
          </button>
        </div>
      )}
    </div>
  );
}
