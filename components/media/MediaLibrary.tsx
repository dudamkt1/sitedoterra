"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaUploader } from "@/components/dashboard/MediaUploader";
import {
  listMedia,
  deleteMedia,
  fetchStorageStats,
  MEDIA_CATEGORIES_CLIENT,
  categoryLabel,
  formatBytes,
} from "@/lib/media-client";
import type { MediaFile } from "@/types";
import { CheckSquare, Trash2, Square, X } from "lucide-react";

interface MediaLibraryProps {
  scope: "tenant" | "system" | "admin";
  category?: string;
  selectable?: boolean;
  onSelect?: (media: MediaFile) => void;
  showOwner?: boolean;
  multiSelect?: boolean;
}

export function MediaLibrary({
  scope,
  category: initialCategory,
  selectable = false,
  onSelect,
  showOwner = false,
  multiSelect = false,
}: MediaLibraryProps) {
  const [items, setItems] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | "all">(initialCategory || "all");
  const [sort, setSort] = useState("newest");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalBytes: number; quotaBytes: number; totalFiles: number; byTenant?: any[] } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof listMedia>[0] = { scope };
      if (category !== "all") params.category = category;
      if (q.trim()) params.q = q.trim();
      if (sort) params.sort = sort;
      if (scope === "admin" && tenantFilter !== "all") params.tenantId = tenantFilter;
      const data = await listMedia(params);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar mídias.");
    } finally {
      setLoading(false);
    }
  }, [scope, category, q, sort, tenantFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchStorageStats(scope === "admin")
      .then(setStats)
      .catch(() => setStats(null));
  }, [scope]);

  function onSearch(value: string) {
    setQ(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, 250);
  }

  async function copyUrl(media: MediaFile) {
    try {
      await navigator.clipboard.writeText(media.public_url);
      setCopied(media.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copie a URL:", media.public_url);
    }
  }

  async function remove(media: MediaFile) {
    if (!window.confirm(`Excluir "${media.original_name || media.storage_key}"?`)) return;
    try {
      await deleteMedia(media.id);
      await load();
    } catch (e: any) {
      const base = e?.message || "Erro ao excluir.";
      const refs = (e?.references || []).map((r: string) => `• ${r}`);
      window.alert(refs.length ? `${base}\n\nUtilizada em:\n${refs.join("\n")}` : base);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((m) => m.id)));
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} arquivo(s) selecionado(s)?`)) return;
    setDeleting(true);
    try {
      for (const id of ids) {
        await deleteMedia(id);
      }
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      const base = e?.message || "Erro ao excluir.";
      const refs = (e?.references || []).map((r: string) => `• ${r}`);
      window.alert(refs.length ? `${base}\n\nUtilizada em:\n${refs.join("\n")}` : base);
    } finally {
      setDeleting(false);
    }
  }

  const pct = stats && stats.quotaBytes > 0 ? Math.round((stats.totalBytes / stats.quotaBytes) * 100) : 0;
  const selectionMode = multiSelect && !selectable;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-5">
      {/* Barra de uso (tenant) */}
      {scope === "tenant" && stats && (
        <div className="card !p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Armazenamento usado</span>
            <span className="text-gray-500">
              {formatBytes(stats.totalBytes)} de {formatBytes(stats.quotaBytes)} · {stats.totalFiles} arquivo(s)
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#1d5c3a]"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          {pct >= 100 && (
            <p className="text-xs text-red-600 mt-2">
              Seu espaço de armazenamento foi atingido. Exclua arquivos antigos ou altere seu plano.
            </p>
          )}
        </div>
      )}

      {/* Admin: filtro por usuário/tenant */}
      {scope === "admin" && stats?.byTenant && (
        <select
          className="input max-w-xs"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
        >
          <option value="all">Todos os usuários</option>
          {stats.byTenant.map((t) => (
            <option key={t.tenant_id} value={t.tenant_id}>
              {t.site_name || t.slug} ({formatBytes(t.bytes)})
            </option>
          ))}
        </select>
      )}

      {/* Ações / busca / filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <MediaUploader
          scope={scope === "system" ? "system" : "tenant"}
          category={category === "all" ? "general" : category}
          onUploaded={() => load()}
        />
        <input
          className="input flex-1 min-w-40"
          placeholder="🔍 Pesquisar"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
        />
        <select className="input max-w-44" value={category} onChange={(e) => setCategory(e.target.value as string)}>
          <option value="all">Todas</option>
          {MEDIA_CATEGORIES_CLIENT.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <select className="input max-w-44" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="largest">Maior tamanho</option>
          <option value="smallest">Menor tamanho</option>
        </select>
      </div>

      {/* Selection toolbar */}
      {selectionMode && hasSelection && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <span className="text-sm font-medium text-emerald-800">
            {selectedIds.size} arquivo(s) selecionado(s)
          </span>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={deleting}
            className="btn btn-destructive text-sm gap-1"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Excluindo..." : "Excluir selecionados"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="btn btn-outline text-sm"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar seleção
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 text-red-600 px-4 py-3 text-sm">{error}</p>}

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando mídias...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum arquivo encontrado. Envie sua primeira imagem ou vídeo para o Cloudflare R2.
        </p>
      ) : (
        <>
          {selectionMode && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg border">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Selecionar todos ({items.length})
              </label>
              <span className="text-xs text-gray-400">Clique nos itens para selecionar múltiplos</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((m) => {
              const isVideo = (m.mime_type || "").toLowerCase().startsWith("video/");
              const isSelected = selectedIds.has(m.id);
              return (
              <div
                key={m.id}
                className={`card !p-0 overflow-hidden transition-all ${selectionMode && isSelected ? "ring-2 ring-emerald-500 bg-emerald-50" : ""}`}
                onClick={selectionMode ? () => toggleSelect(m.id) : undefined}
                style={selectionMode ? { cursor: "pointer" } : undefined}
              >
                <div className="aspect-video bg-gray-100 relative group">
                  {isVideo ? (
                    <video
                      src={m.public_url}
                      preload="metadata"
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.public_url}
                      alt={m.original_name || "imagem"}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {selectable && !selectionMode && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect && onSelect(m); }}
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1d5c3a]/70 text-white text-sm font-semibold flex items-center justify-center"
                    >
                      {isVideo ? "Usar este vídeo ✓" : "Usar esta imagem ✓"}
                    </button>
                  )}
                  {selectionMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <label className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 shadow-lg cursor-pointer transition-transform hover:scale-110">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(m.id); }}
                          className="sr-only peer"
                        />
                        <Square className="h-4 w-4 text-gray-400 peer-checked:hidden" />
                        <CheckSquare className="h-4 w-4 text-emerald-600 hidden peer-checked:block" />
                      </label>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-gray-700 truncate" title={m.original_name || ""}>
                    {m.original_name || "arquivo"}
                  </p>
                  <p className="text-[0.7rem] text-gray-400 mt-0.5">
                    {isVideo ? "Vídeo" : categoryLabel(m.category)} · {formatBytes(m.file_size)}
                  </p>
                  {showOwner && (
                    <p className="text-[0.7rem] text-gray-500 mt-0.5">
                      {m.tenant_slug === "Sistema"
                        ? "Sistema"
                        : `${m.owner_name || m.owner_email || "—"} (${m.tenant_slug || "?"})`}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="text-xs text-[#1d5c3a] underline" onClick={() => copyUrl(m)}>
                      {copied === m.id ? "✓ Copiada" : "Copiar URL"}
                    </button>
                    <a href={m.public_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 underline">
                      Abrir
                    </a>
                    {!selectable && (
                      <button type="button" className="text-xs text-red-600 underline ml-auto" onClick={() => remove(m)}>
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}