"use client";

import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/dashboard/ui";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

interface SupportMaterial {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string;
  order: number;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function PainelMateriaisApoioPage() {
  const [materials, setMaterials] = useState<SupportMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const res = await fetch("/api/admin/support-materials", { cache: "no-store" });
        const data = await res.json();
        if (data.materials) {
          // Filter only global materials (tenant_id is null) for user panel
          const globalMaterials = data.materials.filter((m: SupportMaterial) => !m.tenant_id);
          setMaterials(globalMaterials.sort((a: SupportMaterial, b: SupportMaterial) => a.order - b.order));
        }
      } catch (e) {
        console.error("Erro ao buscar materiais:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchMaterials();
  }, []);

  return (
    <div>
      <SectionTitle sub="Materiais de apoio disponibilizados pela administração para sua consulta.">
        Materiais de Apoio
      </SectionTitle>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="h-8 w-8 animate-spin border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : materials.length === 0 ? (
        <div className="card p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum material disponível</h3>
          <p className="text-gray-400">
            A administração ainda não cadastrou materiais de apoio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m) => (
            <div
              key={m.id}
              className="card group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
            >
              {m.image_url && (
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img
                    src={m.image_url}
                    alt={m.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 truncate mb-1">{m.title}</h3>
                {m.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{m.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Ordem: {m.order}</span>
                  <a
                    href={m.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#1d5c3a] hover:underline"
                  >
                    Acessar
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}