import { getPainelContext } from "@/lib/demo/painel-context";
import { SectionTitle, StatusBadge } from "@/components/dashboard/ui";
import { formatDate } from "@/lib/utils";
import { PainelDemoConta } from "@/components/demo/PainelDemoConta";

export default async function ContaPage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;

  if (isDemo) {
    return (
      <div>
        <SectionTitle sub="Esta conta é uma demonstração. Nada é gravado em servidores reais.">
          Minha Conta
        </SectionTitle>
        <PainelDemoConta />
      </div>
    );
  }

  const p = ctx.profile;
  if (!p) return null;

  return (
    <div>
      <SectionTitle sub="Dados da sua conta.">Minha Conta</SectionTitle>
      <div className="card max-w-xl">
        <dl className="divide-y divide-gray-100 text-sm">
          {[
            ["Nome", p.name || "—"],
            ["E-mail", p.email],
            ["Telefone", p.phone || "—"],
            ["Status da conta", <StatusBadge key="s" status={p.status} />],
            ["Cadastro", formatDate(p.created_at)],
            ["Ativação", formatDate(p.activated_at)],
            ["Cancelamento", formatDate(p.cancelled_at)],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between py-3">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-gray-400">
          Para alterar nome ou telefone, entre em contato com o suporte. Os dados da conta são preservados mesmo após cancelamento ou suspensão.
        </p>
      </div>
    </div>
  );
}
