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
    <div className="flex min-h-screen bg-[#faf8f2]">
      <AdminSidebar email={ctx.profile.email} />
      <main className="flex-1 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
