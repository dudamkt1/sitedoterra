import type { ReactNode } from "react";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import { DashboardBannerDemo } from "@/components/demo/DashboardBannerDemo";
import { DemoFetchBridge } from "@/components/demo/DemoFetchBridge";
import { getPainelContext } from "@/lib/demo/painel-context";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const { isDemo, ctx } = await getPainelContext();

  const name = isDemo ? "Acesso Rápido" : ctx.profile!.name || ctx.profile!.email;
  const email = isDemo ? "Demonstração • salva só neste dispositivo" : ctx.profile!.email;
  const siteSlug = isDemo ? null : ctx.tenant?.slug ?? null;

  return (
    <div className="flex min-h-screen bg-[#faf8f2]">
      {isDemo && <DemoFetchBridge />}
      <DashboardSidebar
        name={name}
        email={email}
        isSuperAdmin={false}
        siteSlug={siteSlug}
        isDemo={isDemo}
      />
      <main className="flex-1 px-8 py-8 max-w-6xl">
        {isDemo && <DashboardBannerDemo />}
        {children}
      </main>
    </div>
  );
}
