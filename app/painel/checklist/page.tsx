import { SectionTitle } from "@/components/dashboard/ui";
import ChecklistClient from "@/components/checklist/ChecklistClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meu Checklist — Painel",
  robots: { index: false, follow: false },
};

export default function ChecklistPage() {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SectionTitle sub="Organize sua rotina diária, semanal, mensal e anual.">
          Meu Checklist
        </SectionTitle>
        <Link
          href="/painel/checklist/historico"
          className="inline-flex items-center gap-2 rounded-[10px] border border-[#dde2dc] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2d3a4a] hover:bg-[#f5f7f4] transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 3v6h6" />
            <path d="M12 7v5l3 2" />
          </svg>
          Histórico &amp; estatísticas
        </Link>
      </div>
      <ChecklistClient />
    </div>
  );
}
