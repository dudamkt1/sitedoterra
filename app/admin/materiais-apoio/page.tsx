import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminMateriaisApoioPage() {
  const admin = createAdminClient();

  const { data: materials } = await admin
    .from("support_materials")
    .select("*, tenants(slug, site_name)")
    .order("order", { ascending: true });

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Materiais de Apoio
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Gerencie subcategorias globais de materiais de apoio disponíveis para todos os usuários.
      </p>

      <div className="card">
        {materials?.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">Nenhum material cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Imagem</th>
                  <th>Título</th>
                  <th>Descrição</th>
                  <th>Link</th>
                  <th>Site</th>
                  <th>Ordem</th>
                </tr>
              </thead>
              <tbody>
                {materials?.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt={m.title}
                          className="w-16 h-10 object-cover rounded"
                        />
                      )}
                    </td>
                    <td className="font-medium">{m.title}</td>
                    <td className="text-sm text-gray-500 max-w-xs truncate">{m.description || "—"}</td>
                    <td className="text-sm font-mono text-emerald-600 truncate max-w-xs">
                      <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-800">
                        {m.link_url}
                      </a>
                    </td>
                    <td className="font-mono text-xs text-gray-500">
                      {m.tenants?.site_name || m.tenants?.slug || "Sistema"}
                    </td>
                    <td className="text-sm text-gray-500">{m.order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}