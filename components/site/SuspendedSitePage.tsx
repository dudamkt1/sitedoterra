import type { PublicTenant } from "@/types";

export function SuspendedSitePage({ tenant, host }: { tenant: PublicTenant; host: string }) {
  const name = tenant.profile_name || tenant.site_name || tenant.slug;
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #1D5C3A 0%, #0D3320 60%, #0A2418 100%)" }}
    >
      <div className="max-w-md w-full text-center text-white">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-3xl font-light mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Este site está temporariamente indisponível
        </h1>
        <p className="text-white/60 leading-relaxed">
          O site de {name} está passando por uma manutenção ou a assinatura está temporariamente suspensa.
          Em breve tudo estará no ar novamente.
        </p>
        <p className="mt-8 text-xs text-white/40">
          {host || `/${tenant.slug}`} · Site suspenso pela administração
        </p>
      </div>
    </div>
  );
}
