"use client";

import { useEffect, useState } from "react";

export function AiUsageStats() {
  const [stats, setStats] = useState<{ total: number; last7d: number; byTool: Record<string, number>; byUser: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ai/stats")
      .then((r) => r.json())
      .then((json) => setStats(json.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Carregando estatísticas...</p>;
  if (!stats) return null;

  const toolTotal = Object.values(stats.byTool || {}).reduce((s, n) => s + n, 0);
  const topTools = Object.entries(stats.byTool || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="card">
      <h2 className="card-title mb-3">Estatísticas de uso</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Conteúdos gerados</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Nos últimos 7 dias</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.last7d}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Usuários ativos</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{Object.keys(stats.byUser || {}).length}</p>
        </div>
      </div>
      {topTools.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Ferramentas mais usadas</p>
          <div className="space-y-1">
            {topTools.map(([tool, count]) => (
              <div key={tool} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{tool}</span>
                <span className="text-gray-400">{count} ({Math.round((count / toolTotal) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}