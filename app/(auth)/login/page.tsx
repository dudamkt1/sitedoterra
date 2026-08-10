"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

  async function quickLogin(account: "superadmin" | "client") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Não foi possível entrar com a conta de teste.");
        setLoading(false);
        return;
      }
      router.push(json.redirect || "/painel");
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor. Tente novamente.");
      setLoading(false);
    }
  }

  // O fallback usa a flag compilada no build; a configuração é confirmada no
  // servidor em tempo de execução (ambas as flags precisam estar ativas).
  const [quickLoginEnabled, setQuickLoginEnabled] = useState(
    process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === "true"
  );

  useEffect(() => {
    let active = true;
    fetch("/api/test-login")
      .then((r) => r.json())
      .then((json) => {
        if (active && json && typeof json.enabled === "boolean") {
          setQuickLoginEnabled(json.enabled);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Entrar no painel
      </h1>
      <p className="text-sm text-gray-500 mb-6">Acesse sua conta para gerenciar seu site e assinatura.</p>

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
          <label className="label" htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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

      {quickLoginEnabled && (
        <div className="mt-8 rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-amber-700 mb-3">
            Acesso rápido — Testes
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => quickLogin("superadmin")}
              disabled={loading}
              className="w-full btn border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 !shadow-none"
            >
              🛡️ Entrar como Super Admin
            </button>
            <button
              type="button"
              onClick={() => quickLogin("client")}
              disabled={loading}
              className="w-full btn border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 !shadow-none"
            >
              🧪 Entrar como Cliente Teste
            </button>
          </div>
          <p className="mt-3 text-[0.65rem] text-amber-600">
            Contas de TESTE. Disponível somente quando a flag de ambiente
            <code className="mx-1 font-mono text-amber-700">ENABLE_TEST_ACCOUNTS=true</code>
            está ativa.
          </p>
        </div>
      )}
    </div>
  );
}
