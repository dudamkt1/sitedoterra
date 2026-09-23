import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Termos de Uso | TopConsultores",
  description:
    "Condições de utilização da plataforma TopConsultores: ativação, mensalidade, garantia, cancelamento e responsabilidades.",
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

export default function TermosPage() {
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
          Termos de Uso
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
          Estes Termos regulam o uso da plataforma <strong>TopConsultores</strong>, que
          disponibiliza sites profissionais, CRM, agendamento e ferramentas de IA para{" "}
          <strong>consultores independentes</strong>. Ao criar uma conta ou ativar um
          site, você declara que leu, compreendeu e concorda com estas condições.
        </p>

        <Section title="1. Objeto">
          <p>
            A ativação disponibiliza o acesso ao site profissional e às ferramentas da
            plataforma, conforme os recursos existentes e as condições apresentadas no
            momento da contratação. A plataforma fornece a estrutura tecnológica; cada
            consultor opera seu próprio site de forma independente.
          </p>
        </Section>

        <Section title="2. Responsabilidade pelo conteúdo">
          <p>
            Cada usuário é <strong>integralmente responsável</strong> pelos conteúdos que
            inserir, publicar ou disponibilizar em seu site — textos, imagens, vídeos,
            produtos, serviços, preços, informações comerciais e dados de contato.
            É proibido utilizar a plataforma para atividades ilícitas, fraudulentas ou
            que violem direitos de terceiros. As opiniões expressas nos sites dos
            consultores são pessoais e não representam a TopConsultores nem qualquer
            outra empresa.
          </p>
        </Section>

        <Section title="3. Ativação e mensalidade">
          <p>
            A ativação ocorre após a confirmação do pagamento da taxa de ativação e
            inclui um período inicial sem cobrança de mensalidade, conforme a oferta
            vigente. Após esse período, aplica-se a mensalidade informada no checkout,
            sem fidelidade — você pode cancelar quando desejar, observadas as condições
            aplicáveis e eventuais valores já vencidos.
          </p>
        </Section>

        <Section title="4. Garantia de 7 dias">
          <p>
            A ativação possui <strong>garantia incondicional de 7 dias corridos</strong>{" "}
            contados da aprovação do pagamento: se não ficar satisfeito, você pode
            solicitar o cancelamento com <strong>devolução de 100%</strong> do valor
            pago. O pedido passa por análise da nossa equipe antes da devolução, e o
            site é desativado quando o reembolso é confirmado — seus dados e conteúdos
            ficam preservados.
          </p>
        </Section>

        <Section title="5. Cancelamento">
          <p>
            O cancelamento da mensalidade pode ser solicitado a qualquer momento pelo
            painel. O acesso permanece até o fim do período já contratado; após o
            cancelamento, recursos que dependem de assinatura ativa podem ser
            interrompidos, com seus dados preservados para uma futura reativação.
          </p>
        </Section>

        <Section title="6. Programa de afiliados">
          <p>
            Ao indicar novos usuários pelo seu link, você pode ganhar comissões sobre a
            ativação, conforme o percentual vigente. Comissões ficam pendentes durante
            a garantia de 7 dias do comprador e, passado o prazo sem reembolso, entram
            no saldo disponível. Em caso de reembolso, a comissão é estornada. Saques
            respeitam o valor mínimo vigente e os dados de recebimento cadastrados.
          </p>
        </Section>

        <Section title="7. Disponibilidade e uso adequado">
          <p>
            Buscamos manter os serviços disponíveis, mas indisponibilidades temporárias
            podem ocorrer por manutenção, atualizações, falhas técnicas, serviços de
            terceiros ou eventos fora do nosso controle. É proibido explorar
            vulnerabilidades, sobrecarregar a infraestrutura ou prejudicar outros
            usuários.
          </p>
        </Section>

        <Section title="8. Alterações">
          <p>
            Podemos atualizar funcionalidades e estes Termos. Mudanças relevantes serão
            comunicadas de forma adequada, observada a legislação aplicável (incluindo
            o CDC). O uso continuado após alterações implica concordância.
          </p>
        </Section>
      </main>

      <footer className="border-t border-emerald-950/10 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-gray-500">
          <p>© 2026 TopConsultores | Feito com ♥ pela TopConsultores</p>
          <p className="mt-1">
            VÓS SOIS DEUSES!
          </p>
        </div>
      </footer>
    </div>
  );
}
