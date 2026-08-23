"use client";

import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

export function PainelDemoProdutos() {
  const { ready, data, update, genId } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addProduct() {
    const name = prompt("Nome do produto:");
    if (!name) return;
    const priceStr = prompt("Preço (em reais):");
    const price = Number(priceStr) || 0;
    update((d) => ({
      ...d,
      products: [
        ...d.products,
        {
          id: genId("prod"),
          name,
          price,
          category: "Óleos Essenciais",
          description: "",
          stock: 0,
        },
      ],
    }));
  }

  function removeProduct(id: string) {
    if (!confirm("Excluir produto?")) return;
    update((d) => ({ ...d, products: d.products.filter((x) => x.id !== id) }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo de demonstração (somente neste dispositivo).</p>
        </div>
        <button
          type="button"
          onClick={addProduct}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Novo produto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.products.map((p) => (
          <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{p.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{p.category}</p>
              </div>
              <span className="text-sm font-bold text-[#1d5c3a]">{formatBRL(p.price * 100)}</span>
            </div>
            {p.description && <p className="mt-3 text-xs text-gray-600 leading-relaxed">{p.description}</p>}
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Estoque: {p.stock}</span>
              <button type="button" onClick={() => removeProduct(p.id)} className="font-medium text-red-600 hover:underline">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
