import type { ReactNode } from "react";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import { DashboardBannerDemo } from "@/components/demo/DashboardBannerDemo";
import { DemoFetchBridge } from "@/components/demo/DemoFetchBridge";
import { getPainelContext } from "@/lib/demo/painel-context";
import FeedbackBanner from "@/components/feedback/FeedbackBanner";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const { isDemo, ctx } = await getPainelContext();

  const name = isDemo ? "Acesso Rápido" : ctx.profile!.name || ctx.profile!.email;
  const email = isDemo ? "Demonstração • salva só neste dispositivo" : ctx.profile!.email;
  const siteSlug = isDemo ? null : ctx.tenant?.slug ?? null;

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-clip bg-gradient-to-b from-[#eef5ef] via-[#faf8f2] to-[#faf8f2] md:flex-row">
      {isDemo && <DemoFetchBridge />}
      <DashboardSidebar
        name={name}
        email={email}
        isSuperAdmin={false}
        siteSlug={siteSlug}
        isDemo={isDemo}
      />
      <main className="w-full min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 md:px-8 md:py-8 md:pb-10">
        <div className="mx-auto w-full min-w-0 max-w-6xl">
          {isDemo && <DashboardBannerDemo />}
          {!isDemo && <FeedbackBanner />}
          {children}
        </div>
      </main>
    </div>
  );
}
