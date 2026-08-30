import Link from "next/link";
import { SectionTitle } from "@/components/dashboard/ui";
import HistoryClient from "@/components/checklist/HistoryClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Histórico do Checklist — Painel",
  robots: { index: false, follow: false },
};

export default function ChecklistHistoryPage() {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SectionTitle sub="Veja seu desempenho ao longo do tempo, com taxa de conclusão e sequência.">
          Histórico &amp; estatísticas
        </SectionTitle>
        <Link
          href="/painel/checklist"
          className="inline-flex items-center gap-2 rounded-[10px] border border-[#dde2dc] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] transition"
        >
          ← Voltar ao checklist
        </Link>
      </div>
      <HistoryClient />
    </div>
  );
}
