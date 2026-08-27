import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { BookingScheduleEditor } from "@/components/dashboard/BookingScheduleEditor";
import { BookingAppointmentsManager } from "@/components/dashboard/BookingAppointmentsManager";
import { getPublicBaseUrl } from "@/lib/public-url";

export default async function RealPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  const appUrl = getPublicBaseUrl();
  const slug = ctx.tenant?.slug || "";

  return (
    <div className="space-y-8">
      <SectionTitle sub="Gerencie sua disponibilidade e todos os compromissos — mais rápido que editar dentro de Meu Site.">
        Agendamentos
      </SectionTitle>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-blue-800">
          Esta é a área dedicada do <b>Agendamento</b>. Aqui você edita <b>dias/horários livres, bloqueios e horários ocupados</b> e acompanha os <b>compromissos</b> com status.
          Em <b>Meu Site</b> ficou apenas o interruptor <b>ativar/desativar</b> da seção.
        </p>
        {slug && (
          <a href={`/${slug}#agendamento`} target="_blank" className="btn btn-outline !py-2 !px-4 text-xs shrink-0 bg-white">
            Ver no site ↗
          </a>
        )}
      </div>

      <BookingScheduleEditor />

      <BookingAppointmentsManager />

      {appUrl && slug && (
        <p className="text-xs text-gray-400">
          Página pública do agendamento:{" "}
          <a href={`${appUrl}/${slug}#agendamento`} target="_blank" className="underline text-[#1d5c3a]">
            {appUrl}/{slug}#agendamento ↗
          </a>
        </p>
      )}
    </div>
  );
}
