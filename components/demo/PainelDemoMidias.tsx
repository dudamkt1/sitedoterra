"use client";

import { useDemoStore } from "@/lib/demo/store";
import { useRef } from "react";

const CATEGORIES = [
  { code: "logo", label: "Logo" },
  { code: "banner", label: "Banner" },
  { code: "produto", label: "Produto" },
  { code: "foto_pessoal", label: "Foto pessoal" },
  { code: "outros", label: "Outros" },
];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function PainelDemoMidias() {
  const { ready, data, update, genId } = useDemoStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const catRef = useRef<HTMLSelectElement>(null);

  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !data) return;
    const cat = catRef.current?.value || "outros";
    const newItems: typeof data.media = [];
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await readAsDataUrl(file);
        newItems.push({
          id: genId("media"),
          name: file.name,
          category: cat,
          mimeType: file.type,
          size: file.size,
          dataUrl,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // ignora arquivo que falhou
      }
    }
    update((d) => ({ ...d, media: [...d.media, ...newItems] }));
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(id: string) {
    if (!confirm("Excluir mídia?")) return;
    update((d) => ({ ...d, media: d.media.filter((m) => m.id !== id) }));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Biblioteca de Mídia</h1>
        <p className="text-sm text-gray-500 mt-1">
          As imagens ficam armazenadas localmente neste navegador (sem envio ao Cloudflare R2).
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <select ref={catRef} className="input max-w-[180px]" defaultValue="outros">
            {CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]">
            📁 Selecionar imagens
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
          <span className="text-xs text-gray-500">As imagens ficam somente neste dispositivo.</span>
        </div>
      </div>

      {data.media.length === 0 ? (
        <div className="card text-center text-sm text-gray-500">
          Nenhuma imagem ainda. Selecione arquivos acima para começar.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.media.map((m) => (
            <div key={m.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="aspect-square bg-gray-100">
                {m.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl">📄</div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-gray-800" title={m.name}>{m.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.category} · {(m.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="mt-2 text-xs font-medium text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
