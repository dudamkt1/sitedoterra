"use client";

import { useState } from "react";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import type { MediaFile } from "@/types";

/**
 * Abre a biblioteca de mídia em modo de SELEÇÃO (modal).
 * Usado nos campos de imagem dos editores (hero, story, etc.).
 * Escopo:
 *   - "tenant": biblioteca do usuário autenticado (seu site).
 *   - "system": biblioteca do sistema (Super Admin — HOME global).
 */
export function MediaPicker({
  scope,
  value,
  onChange,
  label = "Escolher",
}: {
  scope?: "tenant" | "system";
  value?: string;
  onChange?: (url: string, media?: MediaFile) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-outline !py-1.5 !px-3 !text-xs"
        onClick={() => setOpen(true)}
      >
        🖼️ {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-4xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Biblioteca de mídia</h3>
              <button type="button" className="text-gray-400 text-xl" onClick={() => setOpen(false)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Escolha uma imagem ou envie uma nova. Ela será armazenada no Cloudflare R2.
            </p>
            {value && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt="atual" className="w-16 h-12 object-cover rounded" referrerPolicy="no-referrer" />
                <p className="text-xs text-gray-500 truncate flex-1">{value}</p>
                <button type="button" className="text-xs text-red-600 underline" onClick={() => { onChange?.(""); setOpen(false); }}>
                  Remover imagem
                </button>
              </div>
            )}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <MediaLibrary
                scope={scope || "tenant"}
                selectable
                onSelect={(m) => {
                  onChange?.(m.public_url, m);
                  setOpen(false);
                }}
              />
            </div>
            <div className="flex justify-end mt-4">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}