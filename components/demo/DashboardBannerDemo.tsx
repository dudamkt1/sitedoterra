"use client";

export function DashboardBannerDemo() {
  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-start gap-2"
    >
      <span aria-hidden className="text-base">⚡</span>
      <div className="flex-1">
        <p className="font-semibold">Acesso rápido — modo demonstração</p>
        <p className="text-xs text-amber-800/90 mt-0.5">
          Explore à vontade: suas alterações são salvas somente neste navegador/celular e nunca afetam nenhum site real.
        </p>
      </div>
    </div>
  );
}
