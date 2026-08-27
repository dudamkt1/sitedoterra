"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setHasSession(true);
        setUserEmail(data.user.email || null);
      } else {
        setHasSession(false);
      }
      setChecking(false);
      setLoading(false);
    });
    // Listener for recovery session (when coming from email link)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session?.user) {
        setHasSession(true);
        setUserEmail(session?.user?.email || null);
        setChecking(false);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess("Senha atualizada com sucesso! Você já pode entrar com a nova senha.");
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1800);
  }

  if (checking) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">Verificando link...</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Link inválido ou expirado
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Este link de recuperação já expirou ou não é válido. Solicite um novo link na tela de login.
        </p>
        <Link href="/login" className="btn btn-primary w-full text-center">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Criar nova senha
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {userEmail ? `Definindo nova senha para ${userEmail}` : "Defina sua nova senha abaixo."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="new-password">
            Nova senha
          </label>
          <PasswordField
            id="new-password"
            required
            minLength={6}
            value={password}
            onChange={setPassword}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">
            Confirmar nova senha
          </label>
          <PasswordField
            id="confirm-password"
            required
            minLength={6}
            value={confirm}
            onChange={setConfirm}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-500 text-center">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-semibold" style={{ color: "var(--verde)" }}>
          Entrar
        </Link>
      </p>
    </div>
  );
}
