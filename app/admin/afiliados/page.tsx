import { createAdminClient } from "@/lib/supabase/admin";
import { AdminAffiliateDashboard } from "@/components/affiliate/AdminAffiliateDashboard";

export const dynamic = "force-dynamic";

export default async function AdminAfiliadosPage() {
  const admin = createAdminClient();

  const [{ data: settings }, { data: affiliates }, { data: conversions }, { data: payouts }] = await Promise.all([
    admin.rpc("get_affiliate_settings"),
    admin
      .from("affiliate_status")
      .select("*, profiles!inner(email, name, user_id, created_at)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    admin
      .from("affiliate_conversions")
      .select("*, affiliate_status!inner(user_id), profiles!affiliate_conversions_new_customer_user_id_fkey(email, name)")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("affiliate_payouts")
      .select("*, profiles!inner(email, name)")
      .order("requested_at", { ascending: false })
      .limit(200),
  ]);

  const settingsData = Array.isArray(settings) ? settings[0] : settings;
  const affiliatesData = affiliates || [];
  const conversionsData = conversions || [];
  const payoutsData = payouts || [];

  return (
    <AdminAffiliateDashboard
      settings={settingsData}
      affiliates={affiliatesData}
      conversions={conversionsData}
      payouts={payoutsData}
    />
  );
}