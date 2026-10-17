import type { ReactNode } from "react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/ui";

export interface AnalyticsDayPoint {
  day: string;
  pageviews: number;
  visitors: number;
}

export interface AnalyticsDashboard {
  generated_at: string;
  range: { from: string; to: string; days: number };
  prev_range: { from: string; to: string };
  totals: { pageviews: number; visitors: number; per_visitor: number };
  previous: { pageviews: number; visitors: number };
  series: AnalyticsDayPoint[];
  hours: { hour: number; pageviews: number; visitors: number }[];
  top_pages: { path: string; pageviews: number; visitors: number }[];
  sources: { source: string; pageviews: number; visitors: number }[];
  devices: { device: string; pageviews: number; visitors: number }[];
  hosts: { host: string; pageviews: number }[];
}

interface RangeOption {
  key: string;
  label: string;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  desktop: "Computador",
  other: "Outro",
};

const nf = new Intl.NumberFormat("pt-BR");

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function delta(cur: number, prev: number): { text: string; up: boolean | null } {
  if (prev <= 0) return { text: cur > 0 ? "novo" : "—", up: cur > 0 ? true : null };
  const d = ((cur - prev) / prev) * 100;
  return { text: `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`, up: d >= 0 };
}

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  const { text, up } = delta(cur, prev);
  const cls = up === null ? "text-gray-400" : up ? "text-emerald-600" : "text-rose-500";
  return <span className={cls}>{text} vs período anterior</span>;
}

/** Gráfico de linha/área em SVG — funciona com qualquer nº de pontos, sem JS. */
function TrendChart({ series }: { series: AnalyticsDayPoint[] }) {
  const w = 100;
  const h = 40;
  const n = series.length;
  if (n === 0) {
    return <p className="py-16 text-center text-sm text-gray-400">Sem dados no período.</p>;
  }
  const maxPV = Math.max(1, ...series.map((s) => s.pageviews));
  const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const yPV = (v: number) => h - (v / maxPV) * (h - 2) - 1;
  const pvPath = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${yPV(s.pageviews).toFixed(2)}`).join(" ");
  const areaPath = `${pvPath} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label="Tendência de acessos">
      <path d={areaPath} className="fill-emerald-600/15" />
      <path d={pvPath} className="stroke-emerald-600" strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h2>
      {children}
    </div>
  );
}

function BarRow({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 truncate text-sm text-gray-700" title={label}>
        {label}
      </span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
        <span className="block h-full rounded-full bg-emerald-600/80" style={{ width: `${Math.max(2, pct)}%` }} />
      </span>
      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-gray-500">
        {nf.format(value)}
        {hint ? <span className="text-gray-300"> · {hint}</span> : null}
      </span>
    </div>
  );
}

export function PlatformAnalytics({
  data,
  error,
  ranges,
  activeRange,
}: {
  data: AnalyticsDashboard | null;
  error: string | null;
  ranges: RangeOption[];
  activeRange: string;
}) {
  const tabs = (
    <div className="mb-6 flex flex-wrap gap-2">
      {ranges.map((r) => (
        <Link
          key={r.key}
          href={`/admin/analytics?range=${r.key}`}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            r.key === activeRange
              ? "bg-[#1d5c3a] text-white"
              : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );

  if (error || !data) {
    return (
      <div>
        <h1 className="mb-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Analytics
        </h1>
        <p className="mb-8 text-sm text-gray-500">Acessos ao domínio principal da plataforma.</p>
        {tabs}
        <div className="card border border-amber-200 bg-amber-50">
          <h2 className="mb-2 text-base font-semibold text-amber-900">Analytics ainda não ativado no banco</h2>
          <p className="text-sm leading-relaxed text-amber-900/90">
            Rode uma única vez o arquivo{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">
              supabase/migrations/0057_platform_analytics.sql
            </code>{" "}
            no SQL Editor do Supabase e recarregue esta página. Depois disso os acessos começam a ser contados
            automaticamente (sem scripts e sem cookies no site).
          </p>
          {error ? <p className="mt-3 break-words text-xs text-amber-800/70">{error}</p> : null}
        </div>
      </div>
    );
  }

  const { totals, previous, series, hours, top_pages, sources, devices, hosts, range } = data;
  const avgPerDay = range.days > 0 ? totals.pageviews / range.days : 0;
  const peak = series.reduce<AnalyticsDayPoint | null>(
    (best, s) => (!best || s.pageviews > best.pageviews ? s : best),
    null
  );
  const maxPage = Math.max(1, ...top_pages.map((p) => p.pageviews));
  const maxSource = Math.max(1, ...sources.map((s) => s.pageviews));
  const maxHour = Math.max(1, ...hours.map((h) => h.pageviews));
  const hourMap = new Map(hours.map((h) => [h.hour, h.pageviews]));
  const maxHost = Math.max(1, ...hosts.map((h) => h.pageviews));

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Analytics
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Acessos às páginas do <strong>domínio principal</strong> da plataforma ({fmtDay(range.from)} a{" "}
        {fmtDay(range.to)}). Não inclui os sites dos usuários.
      </p>

      {tabs}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Acessos (pageviews)"
          value={nf.format(totals.pageviews)}
          sub={<DeltaBadge cur={totals.pageviews} prev={previous.pageviews} />}
          icon="👣"
        />
        <StatCard
          label="Visitantes únicos"
          value={nf.format(totals.visitors)}
          sub={<DeltaBadge cur={totals.visitors} prev={previous.visitors} />}
          icon="🧑"
        />
        <StatCard
          label="Páginas por visitante"
          value={(totals.per_visitor || 0).toFixed(2)}
          sub="Acessos ÷ visitantes"
          icon="📄"
        />
        <StatCard
          label="Média por dia"
          value={nf.format(Math.round(avgPerDay))}
          sub={peak ? `Pico: ${nf.format(peak.pageviews)} em ${fmtDay(peak.day)}` : undefined}
          icon="📊"
        />
      </div>

      <div className="mt-6">
        <Section title="Acessos ao longo do tempo">
          <div className="mb-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-emerald-600" /> Acessos
            </span>
            <span className="ml-auto">Pico diário: {nf.format(peak?.pageviews || 0)}</span>
          </div>
          <TrendChart series={series} />
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            <span>{fmtDay(range.from)}</span>
            <span>{fmtDay(range.to)}</span>
          </div>
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Páginas mais acessadas">
          {top_pages.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Sem dados no período.</p>
          ) : (
            <div className="space-y-2.5">
              {top_pages.map((p) => (
                <BarRow key={p.path} label={p.path} value={p.pageviews} max={maxPage} hint={`${nf.format(p.visitors)} visit.`} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Origem do tráfego">
          {sources.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Sem dados no período.</p>
          ) : (
            <div className="space-y-2.5">
              {sources.map((s) => (
                <BarRow key={s.source} label={s.source} value={s.pageviews} max={maxSource} hint={`${nf.format(s.visitors)} visit.`} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Dispositivos">
          {devices.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Sem dados no período.</p>
          ) : (
            <div className="space-y-2.5">
              {devices.map((d) => (
                <BarRow
                  key={d.device}
                  label={DEVICE_LABELS[d.device] || d.device}
                  value={d.pageviews}
                  max={Math.max(1, ...devices.map((x) => x.pageviews))}
                  hint={`${nf.format(d.visitors)} visit.`}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Horários de maior acesso">
          <div className="flex h-40 items-end gap-[2px]">
            {Array.from({ length: 24 }, (_, hh) => {
              const v = hourMap.get(hh) || 0;
              return (
                <div key={hh} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${hh}h — ${nf.format(v)} acessos`}>
                  <div
                    className="w-full rounded-t bg-emerald-600/80"
                    style={{ height: `${Math.max(2, Math.round((v / maxHour) * 140))}px` }}
                  />
                  {hh % 3 === 0 && <span className="text-[9px] text-gray-400">{hh}h</span>}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {hosts.length > 1 && (
        <div className="mt-6">
          <Section title="Acessos por domínio">
            <div className="space-y-2.5">
              {hosts.map((h) => (
                <BarRow key={h.host} label={h.host} value={h.pageviews} max={maxHost} />
              ))}
            </div>
          </Section>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        Dados de primeira-parte, sem cookies e sem IP armazenado. Bots não são contados.
      </p>
    </div>
  );
}
