import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Política de Privacidade | TopConsultores",
  description:
    "Como a TopConsultores coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
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

export default function PrivacidadePage() {
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
          Política de Privacidade
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
          Esta Política explica como a <strong>TopConsultores</strong> — plataforma que
          disponibiliza sites profissionais para consultores independentes — coleta,
          utiliza, compartilha e protege dados pessoais, em conformidade com a{" "}
          <strong>Lei nº 13.709/2018 (LGPD)</strong>. Ao usar a plataforma ou qualquer
          site nela hospedado, você concorda com o tratamento descrito aqui.
        </p>

        <Section title="1. Dados que coletamos">
          <p>
            <strong>Cadastro e conta:</strong> nome, e-mail, telefone/WhatsApp, cidade e
            dados de acesso (login e senha criptografada).
          </p>
          <p>
            <strong>Conteúdo do seu site:</strong> textos, imagens, vídeos, produtos,
            preços e informações comerciais que você publica — você é o responsável por
            esse conteúdo e declara ter autorização para utilizá-lo.
          </p>
          <p>
            <strong>Pagamentos:</strong> processados por <strong>Mercado Pago</strong> e{" "}
            <strong>Stripe</strong>. Não armazenamos dados de cartão; guardamos apenas
            identificadores da transação, valor, status e datas para controle financeiro.
          </p>
          <p>
            <strong>Navegação:</strong> cookies e identificadores de atribuição de
            afiliados (ex.: token de visitante), páginas visitadas e dados técnicos
            básicos. Na demonstração pública, suas edições ficam salvas apenas no seu
            navegador (localStorage) e nunca chegam aos nossos servidores.
          </p>
        </Section>

        <Section title="2. Para que usamos seus dados">
          <ul className="list-disc space-y-2 pl-5">
            <li>Criar e manter sua conta e seu site profissional no ar;</li>
            <li>Processar pagamentos de ativação, mensalidades e saques de afiliados;</li>
            <li>Atribuir indicações do programa de afiliados (first-click);</li>
            <li>Enviar comunicações operacionais (confirmações, reembolsos, suporte);</li>
            <li>Prevenir fraudes e cumprir obrigações legais.</li>
          </ul>
          <p>
            Base legal (LGPD): execução de contrato, cumprimento de obrigação legal e
            legítimo interesse, conforme o caso. Marketing direto só com seu consentimento.
          </p>
        </Section>

        <Section title="3. Compartilhamento">
          <p>
            Compartilhamos dados apenas com: gateways de pagamento (Mercado Pago, Stripe),
            infraestrutura de hospedagem e banco de dados, e autoridades quando exigido
            por lei. <strong>Nunca vendemos seus dados.</strong>
          </p>
          <p>
            Cada site de consultor é operado pelo próprio consultor (independente); o
            conteúdo publicado em cada site é de responsabilidade de quem o publicou.
          </p>
        </Section>

        <Section title="4. Seus direitos (LGPD, art. 18)">
          <p>
            Você pode solicitar a qualquer momento: confirmação de tratamento, acesso,
            correção, anonimização, bloqueio, eliminação, portabilidade e revogação de
            consentimento. Para exercer seus direitos, fale com nosso suporte pelo
            WhatsApp indicado na página inicial ou pelo seu painel.
          </p>
        </Section>

        <Section title="5. Retenção e segurança">
          <p>
            Mantemos seus dados apenas pelo tempo necessário às finalidades acima e às
            obrigações legais (ex.: registros fiscais). Aplicamos controles de acesso,
            criptografia de senhas e isolamento por conta. O histórico financeiro
            (pagamentos e reembolsos) é preservado para auditoria, mesmo após
            cancelamentos.
          </p>
        </Section>

        <Section title="6. Cookies">
          <p>
            Usamos cookies estritamente necessários (sessão, segurança), de atribuição
            de afiliados e de preferências. Detalhes em nossa{" "}
            <Link href="/cookies" className="text-[#1d5c3a] underline">
              Política de Cookies
            </Link>
            .
          </p>
        </Section>

        <Section title="7. Alterações">
          <p>
            Podemos atualizar esta Política; a versão vigente estará sempre publicada
            nesta página, com a data de atualização no topo.
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
