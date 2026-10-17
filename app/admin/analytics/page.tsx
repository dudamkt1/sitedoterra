import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_TRACKED_PATHS } from "@/lib/analytics";
import { PlatformAnalytics, type AnalyticsDashboard } from "@/components/admin/PlatformAnalytics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics — Admin",
  robots: { index: false, follow: false },
};

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "today", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "365d", label: "12 meses", days: 365 },
];

/** Data de hoje em São Paulo no formato YYYY-MM-DD. */
function todaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Soma dias a uma data ISO (YYYY-MM-DD), em UTC para não sofrer fuso. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const raw = searchParams.range;
  const rangeParam = typeof raw === "string" ? raw : undefined;
  const rangeKey = RANGES.some((r) => r.key === rangeParam) ? rangeParam! : "30d";
  const days = RANGES.find((r) => r.key === rangeKey)!.days;

  const rawPath = searchParams.path;
  const activePath =
    typeof rawPath === "string" && rawPath.startsWith("/") && rawPath.length <= 300 ? rawPath : null;

  const to = todaySaoPaulo();
  const from = addDays(to, -(days - 1));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_analytics_dashboard", {
    p_from: from,
    p_to: to,
    p_path: activePath,
  });

  const dashboard = (data as AnalyticsDashboard | null) ?? null;

  // Seletor de URL: sempre inclui as páginas conhecidas da plataforma
  // (garante, por exemplo, /landpage mesmo sem acessos) + o que foi visto.
  const optionMap = new Map<string, { pageviews: number; visitors: number }>();
  for (const p of PLATFORM_TRACKED_PATHS) {
    if (p !== "/") optionMap.set(p, { pageviews: 0, visitors: 0 });
  }
  for (const p of dashboard?.paths || []) {
    optionMap.set(p.path, { pageviews: p.pageviews, visitors: p.visitors });
  }
  const pathOptions = Array.from(optionMap.entries())
    .map(([path, v]) => ({ path, ...v }))
    .sort((a, b) => b.pageviews - a.pageviews || a.path.localeCompare(b.path));

  return (
    <PlatformAnalytics
      data={dashboard}
      error={error ? error.message : null}
      ranges={RANGES.map(({ key, label }) => ({ key, label }))}
      activeRange={rangeKey}
      pathOptions={pathOptions}
      activePath={activePath}
    />
  );
}
