import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mediaContext,
  MediaError,
  getMediaQuotaBytes,
  getTenantStorageUsed,
  DEFAULT_MEDIA_QUOTA_BYTES,
} from "@/lib/media";
import type { MediaStorageStats } from "@/types";

export const runtime = "nodejs";

/**
 * GET /api/media/stats
 * - Usuário comum: uso do próprio tenant + quota do plano.
 * - Super Admin (?all=1): total + consumo por usuário/tenant (para limite por plano).
 */
export async function GET(request: Request) {
  const admin = createAdminClient();

  let ctx;
  try {
    ctx = await mediaContext();
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";

  // ---------- Super Admin: visão agregada de toda a plataforma ----------
  if (all) {
    if (!ctx.isSuperAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { data: rows } = await admin
      .from("media_files")
      .select("tenant_id, file_size")
      .eq("status", "uploaded")
      .not("tenant_id", "is", null);

    const perTenant = new Map<string, { files: number; bytes: number }>();
    for (const r of rows || []) {
      const tid = r.tenant_id as string;
      const cur = perTenant.get(tid) || { files: 0, bytes: 0 };
      cur.files += 1;
      cur.bytes += Number(r.file_size) || 0;
      perTenant.set(tid, cur);
    }

    const tenantIds = Array.from(perTenant.keys());
    const [{ data: tenants }] = await Promise.all([
      tenantIds.length ? admin.from("tenants").select("id, slug, site_name").in("id", tenantIds) : Promise.resolve({ data: [] }),
    ]);
    const tmap = new Map((tenants || []).map((t) => [t.id, t]));

    const byTenant = tenantIds.map((tid) => {
      const t = tmap.get(tid);
      const c = perTenant.get(tid)!;
      return {
        tenant_id: tid,
        slug: t?.slug ?? "?",
        site_name: t?.site_name ?? null,
        files: c.files,
        bytes: c.bytes,
      };
    });

    const stats: MediaStorageStats = {
      totalBytes: byTenant.reduce((a, b) => a + b.bytes, 0),
      totalFiles: byTenant.reduce((a, b) => a + b.files, 0),
      quotaBytes: DEFAULT_MEDIA_QUOTA_BYTES,
      byTenant: byTenant.sort((a, b) => b.bytes - a.bytes),
    };
    return NextResponse.json(stats);
  }

  // ---------- Usuário comum ----------
  const [used, quota, filesRow] = await Promise.all([
    getTenantStorageUsed(ctx.tenant.id),
    getMediaQuotaBytes(ctx.tenant.id),
    admin
      .from("media_files")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", "uploaded"),
  ]);

  const stats: MediaStorageStats = {
    totalBytes: used,
    totalFiles: filesRow.count || 0,
    quotaBytes: quota,
    byTenant: [],
  };
  return NextResponse.json(stats);
}