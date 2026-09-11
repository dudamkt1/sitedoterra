import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getDashboardContext } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getDashboardContext();

  if (!ctx?.profile) {
    redirect("/login");
  }
  if (ctx.profile.role !== "superadmin") {
    redirect("/painel");
  }

  return (
    <div className="scope-admin flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-clip bg-gradient-to-b from-[#f4efe2] via-[#faf8f2] to-[#faf8f2] md:flex-row">
      <AdminSidebar email={ctx.profile.email} />
      <main className="w-full min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 md:px-8 md:py-8 md:pb-10">
        <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
