"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Image as ImageIcon } from "lucide-react";
import {
  AFFILIATE_MATERIAL_FORMAT_LABELS,
  type AffiliateMaterial,
  type AffiliateMaterialFormat,
} from "@/types";

function formatBytes(n: number | null): string {
  if (n === null || n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const FORMAT_ORDER: AffiliateMaterialFormat[] = ["feed_1x1", "story_9x16"];
const FORMAT_TITLES: Record<AffiliateMaterialFormat, string> = {
  feed_1x1: "🖼️ Feed 1:1",
  story_9x16: "📱 Stories 9:16",
};

export function AffiliateMaterials() {
  const [materials, setMaterials] = useState<AffiliateMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/affiliate/materials", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.success && Array.isArray(j.materials)) setMaterials(j.materials);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
      </div>
    );
  }

  if (materials.length === 0) return null;

  const groups = FORMAT_ORDER.map((f) => ({
    format: f,
    items: materials.filter((m) => m.format === f),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="card !border-[#e3d3a1] !bg-[#fffdf5]">
      <h2 className="card-title">🎨 Materiais para divulgar</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Criativos prontos no padrão de cada rede. Baixe e poste com seu link de afiliado.
      </p>
      {groups.map((g) => (
        <div key={g.format} className="mb-5 last:mb-0">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            {FORMAT_TITLES[g.format]}{" "}
            <span className="font-normal normal-case">
              · {AFFILIATE_MATERIAL_FORMAT_LABELS[g.format]}
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {g.items.map((m) => (
              <div key={m.id} className="rounded-xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                <div
                  className="relative bg-gray-100 flex items-center justify-center overflow-hidden"
                  style={{ aspectRatio: m.format === "story_9x16" ? "9 / 16" : "1 / 1" }}
                >
                  {m.kind === "video" ? (
                    m.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnail_url} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-4xl">🎬</span>
                    )
                  ) : m.file_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.file_url} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  )}
                  <span className="absolute bottom-1.5 right-1.5 badge badge-gray !text-[10px]">
                    {m.kind === "video" ? "🎬 Vídeo" : "🖼️"}
                  </span>
                </div>
                <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                  <p className="font-semibold text-xs text-gray-800 truncate" title={m.title}>
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="text-[11px] text-gray-500 line-clamp-2">{m.description}</p>
                  )}
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="btn btn-primary w-full !py-1.5 !text-xs mt-auto"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Baixar{formatBytes(m.file_size_bytes) ? ` · ${formatBytes(m.file_size_bytes)}` : ""}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
