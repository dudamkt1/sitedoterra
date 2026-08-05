import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import { getDashboardContext } from "@/lib/auth";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const ctx = await getDashboardContext();

  if (!ctx?.profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#faf8f2]">
      <DashboardSidebar
        name={ctx.profile.name || ctx.profile.email}
        email={ctx.profile.email}
        isSuperAdmin={ctx.isSuperAdmin}
        siteSlug={ctx.tenant?.slug ?? null}
      />
      <main className="flex-1 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
