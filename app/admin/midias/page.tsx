import { createAdminClient } from "@/lib/supabase/admin";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import { formatBytes } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmtBytes(bytes: number): string {
  return formatBytes(bytes);
}

export default async function AdminMidiasPage() {
  const admin = createAdminClient();

  const [{ data: rows }, { data: tenants }] = await Promise.all([
    admin.from("media_files").select("tenant_id, file_size, id", { count: "exact" }).eq("status", "uploaded").not("tenant_id", "is", null),
    admin.from("tenants").select("id, slug, site_name"),
  ]);

  const perTenant = new Map<string, { files: number; bytes: number }>();
  for (const r of rows || []) {
    const tid = r.tenant_id as string;
    const cur = perTenant.get(tid) || { files: 0, bytes: 0 };
    cur.files += 1;
    cur.bytes += Number(r.file_size) || 0;
    perTenant.set(tid, cur);
  }

  const tmap = new Map((tenants || []).map((t) => [t.id, t]));
  const totalBytes = Array.from(perTenant.values()).reduce((a, b) => a + b.bytes, 0);
  const totalFiles = Array.from(perTenant.values()).reduce((a, b) => a + b.files, 0);

  const byTenant = Array.from(perTenant.entries())
    .map(([tid, c]) => {
      const t = tmap.get(tid);
      return { tenant_id: tid, slug: t?.slug || "?", site_name: t?.site_name ?? null, files: c.files, bytes: c.bytes };
    })
    .sort((a, b) => b.bytes - a.bytes);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Mídias</h1>
      <p className="text-sm text-gray-500 mb-8">
        Arquivos de todos os sites armazenados no Cloudflare R2. Gerencie, filtre e exclua com segurança.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card !p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Total armazenado</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{fmtBytes(totalBytes)}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Arquivos</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{totalFiles}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Armazenamento</p>
          <p className="mt-1 text-sm text-gray-500">Cloudflare R2 · {process.env.R2_BUCKET_NAME || "site-doterra-media"}</p>
          {process.env.R2_PUBLIC_URL && (
            <p className="text-xs text-gray-400 mt-1">CDN: {process.env.R2_PUBLIC_URL}</p>
          )}
        </div>
      </div>

      <div className="card mb-8">
        <h2 className="card-title mb-4">Uso por usuário</h2>
        {byTenant.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum usuário enviou arquivos ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Usuário</th>
                  <th>Arquivos</th>
                  <th>Uso</th>
                </tr>
              </thead>
              <tbody>
                {byTenant.map((t) => (
                  <tr key={t.tenant_id}>
                    <td className="font-medium">{t.site_name || "Sem nome"}</td>
                    <td className="font-mono text-xs text-gray-500">/{t.slug}</td>
                    <td>{t.files}</td>
                    <td>{fmtBytes(t.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>Todos os arquivos</h2>
      <MediaLibrary scope="admin" showOwner />
    </div>
  );
}