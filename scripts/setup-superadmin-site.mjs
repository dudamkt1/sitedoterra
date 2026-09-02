#!/usr/bin/env node
// ============================================================================
// CONFIGURAÇÃO DO SUPER ADMIN — Sincroniza site do super admin com domínio principal
// ----------------------------------------------------------------------------
// Uso:  node scripts/setup-superadmin-site.mjs
// IDEMPOTENTE — pode ser re-executado.
// ============================================================================

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Carrega .env
function loadEnv() {
  const result = { ...process.env };
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (result[key] === undefined) result[key] = value;
    }
  }
  return result;
}

const env = loadEnv();

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TEST_SUPERADMIN_EMAIL"];
const missing = required.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error("❌ Variáveis de ambiente ausentes:", missing.join(", "));
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPERADMIN_EMAIL = env.TEST_SUPERADMIN_EMAIL.trim().toLowerCase();

async function main() {
  console.log("==================================================");
  console.log(" CONFIGURAÇÃO DO SUPER ADMIN");
  console.log("==================================================\n");

  // 1. Encontra o user_id do super admin
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, email, name, role, status")
    .eq("email", SUPERADMIN_EMAIL)
    .maybeSingle();

  if (!profile) {
    console.error(`❌ Super admin não encontrado: ${SUPERADMIN_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅ Super admin encontrado: ${profile.email} (${profile.role})`);

  // 2. Garante perfil ativo
  if (profile.status !== "active") {
    await admin
      .from("profiles")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("user_id", profile.user_id);
    console.log("   → Perfil ativado");
  }

  // 3. Encontra tenant existente
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug, site_status, monthly_billing_enabled, site_name")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  let tenantId;
  const desiredSlug = "usuarioteste";

  if (tenant) {
    // Deleta o tenant existente e recria (evita trigger UPDATE sem updated_at)
    console.log(`🔄 Recriando tenant: /${tenant.slug} → /${desiredSlug}`);
    
    // Deleta dados relacionados primeiro
    await admin.from("site_settings").delete().eq("tenant_id", tenant.id);
    await admin.from("tenant_sections").delete().eq("tenant_id", tenant.id);
    await admin.from("pwa_settings").delete().eq("tenant_id", tenant.id);
    await admin.from("subscriptions").delete().eq("tenant_id", tenant.id);
    await admin.from("payments").delete().eq("tenant_id", tenant.id);
    await admin.from("billing_history").delete().eq("tenant_id", tenant.id);
    await admin.from("domains").delete().eq("tenant_id", tenant.id);
    
    // Deleta o tenant
    await admin.from("tenants").delete().eq("id", tenant.id);
    console.log("   → Tenant antigo removido");
  }

  // 4. Cria novo tenant com configurações corretas
  const { data: newTenant, error: tenantErr } = await admin
    .from("tenants")
    .insert({
      user_id: profile.user_id,
      slug: desiredSlug,
      site_name: "TopConsultores · Demo Oficial",
      site_status: "active",
      monthly_billing_enabled: false,
      activated_at: new Date().toISOString(),
      settings: {},
    })
    .select("id")
    .single();

  if (tenantErr || !newTenant) {
    console.error("❌ Erro ao criar tenant:", tenantErr);
    process.exit(1);
  }
  tenantId = newTenant.id;
  console.log(`✅ Tenant criado: /${desiredSlug} (site_status=active, monthly_billing_enabled=false)`);

  // 5. Garante site_settings
  const siteData = {
    name: "TopConsultores",
    surname: "Demo",
    fullName: "TopConsultores Demo",
    role: "Plataforma Oficial doTERRA · TopConsultores",
    eyebrow: "Demonstração Oficial · Site de Apresentação",
    description: "Site de demonstração da plataforma TopConsultores para consultoras doTERRA. Configure seu próprio site profissional com IA, agendamento, CRM e domínio próprio.",
    whatsapp: "5511999999999",
    whatsapp_floating_enabled: true,
    email: SUPERADMIN_EMAIL,
    instagram: "topconsultores",
    instagramHandle: "@topconsultores",
    site_title: "TopConsultores · Site Profissional doTERRA",
    logoMode: "text",
    logoText: "TopConsultores",
    faviconUrl: "",
    theme: { preset: "verde" },
    stats: {
      years: "5+",
      labelYears: "Anos de experiência",
      clients: "1000+",
      labelClients: "Consultoras atendidas",
      satisfaction: "99%",
      labelSatisfaction: "Satisfação",
    },
    social: {
      instagram: { enabled: true, url: "https://instagram.com/topconsultores" },
      facebook: { enabled: false, url: "" },
      youtube: { enabled: false, url: "" },
    },
  };

  await admin
    .from("site_settings")
    .upsert({ tenant_id: tenantId, data: siteData }, { onConflict: "tenant_id" });
  console.log("   → site_settings configurado com conteúdo de demonstração");

  // 6. Garante assinatura ativa (para o RPC funcionar)
  const now = new Date().toISOString();
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await admin.from("subscriptions").insert({
    tenant_id: tenantId,
    plan_id: null,
    stripe_customer_id: "cus_DEMO_superadmin",
    stripe_subscription_id: "sub_DEMO_superadmin",
    stripe_price_id: "price_DEMO_superadmin",
    status: "active",
    current_period_start: now,
    current_period_end: in30d,
    next_billing_at: in30d,
    cancel_at_period_end: false,
    activated_at: now,
    canceled_at: null,
  });
  console.log("   → Assinatura de demonstração criada (status=active)");

  // 7. Garante seções da HOME ativas
  const { data: sections } = await admin
    .from("site_sections")
    .select("id, key")
    .in("key", ["hero", "about", "story", "testimonials", "video", "booking", "products", "faq", "pricing"]);

  if (sections && sections.length > 0) {
    for (const section of sections) {
      await admin.from("tenant_sections").upsert(
        {
          tenant_id: tenantId,
          section_id: section.id,
          enabled: true,
          content: {},
          settings: {},
        },
        { onConflict: "tenant_id,section_id" }
      );
    }
    console.log(`   → ${sections.length} seções da HOME ativadas`);
  }

  // 8. Configura PWA settings
  await admin.from("pwa_settings").upsert(
    {
      tenant_id: tenantId,
      enabled: true,
      app_name: "TopConsultores",
      short_name: "TopConsultores",
      description: "Plataforma profissional para consultoras doTERRA",
      theme_color: "#1d5c3a",
      background_color: "#FEFCF8",
      display: "standalone",
      orientation: "portrait-primary",
      start_url: "/",
      scope: "/",
      icon_180_url: null,
      icon_192_url: null,
      icon_512_url: null,
      icon_svg_url: null,
      maskable: false,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  console.log("   → PWA configurado");

  console.log("\n==================================================");
  console.log(" ✅ Configuração concluída!");
  console.log("    Super Admin:     " + SUPERADMIN_EMAIL);
  console.log("    URL Principal:   " + (env.NEXT_PUBLIC_HOME_URL || env.NEXT_PUBLIC_APP_URL));
  console.log("    URL do Usuário:  " + (env.NEXT_PUBLIC_APP_URL || "https://oleos.topconsultores.com.br") + "/usuarioteste");
  console.log("    Mensalidade:     ISENTA (monthly_billing_enabled=false)");
  console.log("    Site Status:     ATIVO");
  console.log("==================================================");
  console.log("\n📝 O domínio principal (/) agora sincroniza com /usuarioteste via HOME_TENANT_SLUG");
  console.log("   O super admin edita em /painel/meu-site e reflete em ambos!");
}

main().catch((err) => {
  console.error("\n❌ Erro:");
  console.error(err?.message || err);
  process.exit(1);
});