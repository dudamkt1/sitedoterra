import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getCrmSettings, computeDashboardStats } from "@/lib/crm";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/crm/stats — indicadores do dashboard do CRM. */
export async function GET() {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const profile = await getProfile(user!.id);
  const settings = await getCrmSettings(admin, tenant!.id);
  const stats = await computeDashboardStats(admin, tenant!.id, settings, profile?.name || null);
  return NextResponse.json({ stats, settings });
}