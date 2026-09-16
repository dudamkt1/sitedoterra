import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Política de Cookies | TopConsultores",
  description: "Quais cookies a TopConsultores utiliza, para que servem e como gerenciá-los.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2
        className="text-xl font-semibold text-[#1d5c3a]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function CookieRow({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-mono text-sm font-semibold text-gray-800">{name}</p>
      <p className="mt-1 text-sm text-gray-600">{purpose}</p>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#faf8f2]">
      <header className="border-b border-emerald-950/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="text-lg font-semibold text-[#1d5c3a]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            TopConsultores
          </Link>
          <Link href="/" className="text-sm font-medium text-[#1d5c3a] underline">
            ← Voltar à página inicial
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Última atualização: setembro de 2026
        </p>
        <h1
          className="mt-2 text-3xl font-semibold text-gray-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Política de Cookies
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
          Cookies são pequenos arquivos salvos no seu navegador para que a{" "}
          <strong>TopConsultores</strong> funcione corretamente, lembre suas
          preferências e atribua indicações de afiliados. Abaixo explicamos cada uso.
        </p>

        <Section title="1. Cookies estritamente necessários">
          <div className="space-y-3">
            <CookieRow
              name="Sessão e autenticação"
              purpose="Mantêm você logado no painel e protegem sua conta. Sem eles, o login e o checkout não funcionam."
            />
            <CookieRow
              name="Segurança"
              purpose="Ajudam a prevenir fraudes e acessos indevidos durante pagamentos e alterações de conta."
            />
          </div>
        </Section>

        <Section title="2. Atribuição de afiliados">
          <div className="space-y-3">
            <CookieRow
              name="tc_visitor_token"
              purpose="Registra por qual link de afiliado você chegou (first-click), para que a comissão seja atribuída corretamente quando houver uma ativação. Duração de até 180 dias."
            />
          </div>
        </Section>

        <Section title="3. Preferências e demonstração">
          <div className="space-y-3">
            <CookieRow
              name="Preferências locais (localStorage)"
              purpose="Na demonstração pública, suas edições de teste ficam salvas apenas no seu navegador e nunca são enviadas aos nossos servidores. Você pode apagá-las limpando os dados do site."
            />
          </div>
        </Section>

        <Section title="4. Terceiros">
          <p>
            Vídeos incorporados (ex.: YouTube), botões de pagamento (Mercado Pago,
            Stripe) e ferramentas de mídia podem definir cookies próprios ao serem
            carregados. O uso desses cookies segue as políticas de cada fornecedor.
          </p>
        </Section>

        <Section title="5. Como gerenciar">
          <p>
            Você pode bloquear ou apagar cookies nas configurações do seu navegador
            (Chrome, Safari, Firefox, Edge). Atenção: desativar os cookies necessários
            pode impedir o login, o checkout e a atribuição correta de indicações.
            Mais detalhes sobre o tratamento de dados na nossa{" "}
            <Link href="/privacidade" className="text-[#1d5c3a] underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </Section>
      </main>

      <footer className="border-t border-emerald-950/10 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-gray-500">
          <p>© 2026 TopConsultores | Feito com ♥ pela TopConsultores</p>
          <p className="mt-1">
            Consultor Independente — as opiniões expressas são pessoais e não representam
            qualquer empresa.
          </p>
        </div>
      </footer>
    </div>
  );
}
