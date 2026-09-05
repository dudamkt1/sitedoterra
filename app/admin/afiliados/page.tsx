import { createAdminClient } from "@/lib/supabase/admin";
import { AdminAffiliateDashboard } from "@/components/affiliate/AdminAffiliateDashboard";

export const dynamic = "force-dynamic";

// Interface espelha AdminAffiliateDashboard.tsx
interface AffiliateRow {
  id: string;
  user_id: string;
  is_active: boolean;
  accepted_terms_at: string | null;
  accepted_terms_version: number | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
}

interface ConversionRow {
  id: string;
  sale_amount: number;
  commission_amount: number;
  commission_percent_at_time: number;
  status: "pendente" | "aprovado" | "pago" | "estornado";
  created_at: string;
  new_customer_user_id: string;
  affiliate_user_id: string;
}

interface PayoutRow {
  id: string;
  amount: number;
  method: "pix" | "mercado_pago";
  status: "solicitado" | "em_analise" | "pago" | "rejeitado";
  requested_at: string;
  paid_at: string | null;
  pix_key: string | null;
  pix_key_snapshot: string | null;
  pix_key_type_snapshot: string | null;
  mp_email_snapshot: string | null;
  payment_method_label: string | null;
  affiliate_user_id: string;
}

export default async function AdminAfiliadosPage() {
  const admin = createAdminClient();

  // 1) Configurações globais (via RPC — funciona)
  const { data: settings } = await admin.rpc("get_affiliate_settings");

  // 2) Afiliados ativos — busca em DUAS etapas para contornar a ausência de FK
  //    direta entre affiliate_status.user_id e profiles.user_id.
  //    O schema atual tem affiliate_status.user_id → auth.users(id), portanto
  //    o embed PostgREST `profiles!inner(...)` falha silenciosamente
  //    (erro PGRST200) e retorna `[]`. Fazemos o join manualmente.
  const { data: affRows, error: affErr } = await admin
    .from("affiliate_status")
    .select("id, user_id, is_active, accepted_terms_at, accepted_terms_version, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (affErr) {
    console.error("[admin/afiliados] affiliate_status:", affErr.message);
  }

  const affRowsArr: AffiliateRow[] = (affRows as AffiliateRow[]) || [];
  const affUserIds = Array.from(new Set(affRowsArr.map((r) => r.user_id).filter(Boolean)));

  // Busca perfis em uma única query (IN)
  const profilesMap = new Map<string, ProfileRow>();
  if (affUserIds.length > 0) {
    const { data: profileRows, error: profErr } = await admin
      .from("profiles")
      .select("user_id, email, name, created_at")
      .in("user_id", affUserIds);
    if (profErr) {
      console.error("[admin/afiliados] profiles (afiliados):", profErr.message);
    }
    for (const p of (profileRows as ProfileRow[]) || []) {
      profilesMap.set(p.user_id, p);
    }
  }

  const affiliatesData = affRowsArr.map((a) => {
    const p = profilesMap.get(a.user_id);
    return {
      id: a.id,
      user_id: a.user_id,
      is_active: a.is_active,
      accepted_terms_at: a.accepted_terms_at,
      profiles: {
        email: p?.email || "—",
        name: p?.name || "",
        user_id: a.user_id,
        created_at: p?.created_at || a.created_at,
      },
    };
  });

  // 3) Conversões — mesma técnica de duas etapas
  const { data: convRows, error: convErr } = await admin
    .from("affiliate_conversions")
    .select("id, sale_amount, commission_amount, commission_percent_at_time, status, created_at, new_customer_user_id, affiliate_user_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (convErr) {
    console.error("[admin/afiliados] affiliate_conversions:", convErr.message);
  }

  const convArr: ConversionRow[] = (convRows as ConversionRow[]) || [];
  const convCustomerIds = Array.from(new Set(convArr.map((c) => c.new_customer_user_id).filter(Boolean)));
  const customerProfiles = new Map<string, ProfileRow>();
  if (convCustomerIds.length > 0) {
    const { data: rows, error } = await admin
      .from("profiles")
      .select("user_id, email, name")
      .in("user_id", convCustomerIds);
    if (error) console.error("[admin/afiliados] profiles (clientes):", error.message);
    for (const p of (rows as ProfileRow[]) || []) {
      customerProfiles.set(p.user_id, p);
    }
  }

  const conversionsData = convArr.map((c) => {
    const cp = customerProfiles.get(c.new_customer_user_id);
    return {
      id: c.id,
      sale_amount: c.sale_amount,
      commission_amount: c.commission_amount,
      commission_percent_at_time: c.commission_percent_at_time,
      status: c.status,
      created_at: c.created_at,
      new_customer_user_id: c.new_customer_user_id,
      affiliate_status: { user_id: c.affiliate_user_id },
      profiles: {
        email: cp?.email || "—",
        name: cp?.name || "",
      },
    };
  });

  // 4) Payouts — mesma técnica
  const { data: payoutRows, error: payErr } = await admin
    .from("affiliate_payouts")
    .select("id, amount, method, status, requested_at, paid_at, pix_key, pix_key_snapshot, pix_key_type_snapshot, mp_email_snapshot, payment_method_label, affiliate_user_id")
    .order("requested_at", { ascending: false })
    .limit(200);

  if (payErr) {
    console.error("[admin/afiliados] affiliate_payouts:", payErr.message);
  }

  const payArr: PayoutRow[] = (payoutRows as PayoutRow[]) || [];
  const payUserIds = Array.from(new Set(payArr.map((p) => p.affiliate_user_id).filter(Boolean)));
  const payProfiles = new Map<string, ProfileRow>();
  if (payUserIds.length > 0) {
    const { data: rows, error } = await admin
      .from("profiles")
      .select("user_id, email, name, created_at")
      .in("user_id", payUserIds);
    if (error) console.error("[admin/afiliados] profiles (payouts):", error.message);
    for (const p of (rows as ProfileRow[]) || []) {
      payProfiles.set(p.user_id, p);
    }
  }

  const payoutsData = payArr.map((p) => {
    const pr = payProfiles.get(p.affiliate_user_id);
    return {
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      requested_at: p.requested_at,
      paid_at: p.paid_at,
      pix_key: p.pix_key,
      pix_key_snapshot: p.pix_key_snapshot,
      pix_key_type_snapshot: p.pix_key_type_snapshot,
      mp_email_snapshot: p.mp_email_snapshot,
      payment_method_label: p.payment_method_label,
      profiles: {
        email: pr?.email || "—",
        name: pr?.name || "",
      },
    };
  });

  const settingsData = Array.isArray(settings) ? settings[0] : settings;

  return (
    <AdminAffiliateDashboard
      settings={settingsData}
      affiliates={affiliatesData}
      conversions={conversionsData}
      payouts={payoutsData}
    />
  );
}
