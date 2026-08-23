"use client";

import Link from "next/link";
import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/ui";

export function PainelDemoOverview() {
  const { ready, data } = useDemoStore();
  if (!ready || !data) {
    return <div className="text-sm text-gray-500">Carregando demonstração...</div>;
  }

  const totalVendas = data.sales.reduce((acc, s) => acc + s.total, 0);
  const totalPago = data.sales
    .filter((s) => s.status === "pago")
    .reduce((acc, s) => acc + s.total, 0);
  const totalPendente = data.sales
    .filter((s) => s.status === "pendente")
    .reduce((acc, s) => acc + s.total, 0);
  const clientesVip = data.clients.filter((c) => c.vip).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Olá, visitante 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Esta é a visão geral do seu futuro SITE DOTERRA. Tudo aqui é fictício e fica salvo apenas neste dispositivo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Status do site"
          value="No ar"
          icon="🟢"
          sub="URL: /demonstracao"
        />
        <StatCard
          label="Plano"
          value="Plano Essencial"
          icon="📦"
          sub={`${formatBRL(9900)} ativação + ${formatBRL(4900)}/mês`}
        />
        <StatCard
          label="Assinatura"
          value={<span className="text-[#1d5c3a] font-semibold">Ativa</span>}
          icon="💳"
          sub="Próxima cobrança: 30 dias"
        />
        <StatCard
          label="Domínio próprio"
          value="carla.consultoria.local"
          icon="🔗"
          sub={<span className="text-[#1d5c3a]">Conectado</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Meu Site</h2>
            <Link href="/painel/meu-site" className="btn btn-outline !py-2 !px-4 text-xs">
              Configurar
            </Link>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex justify-between"><span>URL pública</span><strong className="text-[#1d5c3a]">/demonstracao</strong></li>
            <li className="flex justify-between"><span>Status</span><span className="text-[#1d5c3a] font-semibold">Ativo</span></li>
            <li className="flex justify-between"><span>Domínio personalizado</span><strong>carla.consultoria.local</strong></li>
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Resumo da demonstração</h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex justify-between"><span>Clientes</span><strong>{data.clients.length}</strong></li>
            <li className="flex justify-between"><span>Clientes VIP</span><strong>{clientesVip}</strong></li>
            <li className="flex justify-between"><span>Vendas (total)</span><strong>{formatBRL(totalVendas * 100)}</strong></li>
            <li className="flex justify-between"><span>Recebido</span><strong className="text-[#1d5c3a]">{formatBRL(totalPago * 100)}</strong></li>
            <li className="flex justify-between"><span>Pendente</span><strong className="text-amber-700">{formatBRL(totalPendente * 100)}</strong></li>
            <li className="flex justify-between"><span>Tarefas em aberto</span><strong>{data.tasks.filter((t) => !t.done).length}</strong></li>
            <li className="flex justify-between"><span>Produtos cadastrados</span><strong>{data.products.length}</strong></li>
          </ul>
        </div>
      </div>

      <div className="mt-8 card">
        <h2 className="card-title mb-3">Próximos passos sugeridos</h2>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-3">
            <span className="badge badge-green">✓</span>
            <span>Explore <Link href="/painel/meu-site" className="text-[#1d5c3a] underline">Meu Site</Link> e altere cores, textos e seções.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="badge badge-green">✓</span>
            <span>Crie, edite e exclua clientes no <Link href="/painel/crm" className="text-[#1d5c3a] underline">CRM</Link>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="badge badge-green">✓</span>
            <span>Teste a <Link href="/painel/ia" className="text-[#1d5c3a] underline">IA para conteúdo</Link>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="badge badge-green">✓</span>
            <span>Faça upload de imagens na <Link href="/painel/midias" className="text-[#1d5c3a] underline">Biblioteca de Mídia</Link>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="badge badge-gray">i</span>
            <span>Em <Link href="/painel/conta" className="text-[#1d5c3a] underline">Minha Conta</Link> você encontra a opção <em>Restaurar demonstração</em>.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
