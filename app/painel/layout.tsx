import type { ReactNode } from "react";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import { DashboardBannerDemo } from "@/components/demo/DashboardBannerDemo";
import { DemoFetchBridge } from "@/components/demo/DemoFetchBridge";
import { getPainelContext } from "@/lib/demo/painel-context";
import FeedbackBanner from "@/components/feedback/FeedbackBanner";
import { isSiteActivated } from "@/lib/painel-access";
import { PainelContent } from "@/components/dashboard/PainelContent";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const { isDemo, ctx } = await getPainelContext();

  const name = isDemo ? "Acesso Rápido" : ctx.profile!.name || ctx.profile!.email;
  const email = isDemo ? "Demonstração • salva só neste dispositivo" : ctx.profile!.email;
  const siteSlug = isDemo ? null : ctx.tenant?.slug ?? null;
  const isSuperAdmin = !isDemo && ctx.profile?.role === "superadmin";

  // Verifica se o site está ativado (apenas para usuários reais, não demo)
  const siteActivated = !isDemo && isSiteActivated(ctx as any);

  return (
    <div className="scope-painel flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-clip bg-gradient-to-b from-[#eef5ef] via-[#faf8f2] to-[#faf8f2] md:flex-row">
      {isDemo && <DemoFetchBridge />}
      <DashboardSidebar
        name={name}
        email={email}
        isSuperAdmin={isSuperAdmin}
        siteSlug={siteSlug}
        isDemo={isDemo}
        siteActivated={siteActivated}
      />
      <main className="w-full min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 md:px-8 md:py-8 md:pb-10">
        <div className="mx-auto w-full min-w-0 max-w-6xl">
          {isDemo && <DashboardBannerDemo />}
          {!isDemo && <FeedbackBanner />}
          <PainelContent isDemo={isDemo} isSuperAdmin={isSuperAdmin} siteActivated={siteActivated}>
            {children}
          </PainelContent>
        </div>
      </main>
    </div>
  );
}
