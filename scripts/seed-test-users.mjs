#!/usr/bin/env node
// ============================================================================
// SEED — Usuários de teste (Super Admin + Cliente Teste)
// ----------------------------------------------------------------------------
// Uso:  npm run seed:test
//       (ou: node scripts/seed-test-users.mjs)
//
// IDEMPOTENTE — pode ser re-executado quantas vezes quiser. Nunca duplica.
//
// O que ele faz (sempre via SUPABASE_SERVICE_ROLE_KEY, apenas no servidor):
//   1. procura o usuário por e-mail (auth.users / profiles)
//   2. cria se não existir, atualiza se existir (senha, perfil)
//   3. garante a role (superadmin | user)
//   4. garante perfil (nome, status active)
//   5. garante o tenant/site (slug, site_status active)
//   6. garante plano, assinatura ativa, pagamentos (ativação + mensalidade)
//   7. garante site_settings e tenant_sections (seções da HOME ativas)
//
// IMPORTANTE:
//   - NÃO realiza cobrança real no Stripe. IDs de Stripe usam prefixo "TESTE".
//   - As credenciais vêm de variáveis de ambiente (nunca do código).
//   - Rodar NÃO apaga nem altera usuários/pagamentos/assinaturas reais.
// ============================================================================

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env: process.env primeiro; se ausente, carrega do arquivo .env (raiz)
// ---------------------------------------------------------------------------
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (result[key] === undefined) result[key] = value;
    }
  }
  return result;
}

const env = loadEnv();

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_SUPERADMIN_EMAIL",
  "TEST_SUPERADMIN_PASSWORD",
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
];
const missing = required.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error("❌ Variáveis de ambiente ausentes:", missing.join(", "));
  console.error("   Configure as credenciais de teste antes de rodar o seed.");
  process.exit(1);
}

for (const key of ["TEST_SUPERADMIN_PASSWORD", "TEST_USER_PASSWORD"]) {
  if (env[key] === "change-me" || env[key].length < 6) {
    console.error(`❌ A senha de teste (${key}) não foi configurada corretamente.`);
    console.error("   Use uma senha própria para o ambiente de teste (nunca 'change-me').");
    process.exit(1);
  }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPERADMIN_EMAIL = env.TEST_SUPERADMIN_EMAIL.trim().toLowerCase();
const SUPERADMIN_PASSWORD = env.TEST_SUPERADMIN_PASSWORD;
const USER_EMAIL = env.TEST_USER_EMAIL.trim().toLowerCase();
const USER_PASSWORD = env.TEST_USER_PASSWORD;

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const in30d = new Date(now.getTime() + 30 * DAY).toISOString();

const STRIPE_MONTHLY_PRICE_ID = env.STRIPE_MONTHLY_PRICE_ID || "price_TESTE_4700";

const log = {
  superadmin: "nada a fazer",
  client: "nada a fazer",
  plan: "nada a fazer",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function findUserIdByEmail(email) {
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (data?.user_id) return data.user_id;

  // Fallback: varre auth.users via Admin API (seguro, service role)
  let page = 1;
  const perPage = 1000;
  while (page <= 20) {
    const { data: users } = await admin.auth.admin.listUsers({ page, perPage });
    const hit = (users?.users || []).find(
      (u) => (u.email || "").trim().toLowerCase() === email
    );
    if (hit) return hit.id;
    if (!users?.users || users.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function ensureAuthUser({ email, password, name }) {
  const existingId = await findUserIdByEmail(email);
  if (existingId) {
    // Garante a senha (utiliza a configurada no ambiente)
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password,
      user_metadata: { name },
    });
    if (error) {
      console.error(`⚠️  Falha ao atualizar senha de ${email}:`, error.message);
    }
    return { id: existingId, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    if (String(error.message).toLowerCase().includes("already registered")) {
      const id = await findUserIdByEmail(email);
      if (id) return { id, created: false };
    }
    throw error;
  }
  return { id: data.user.id, created: true };
}

async function ensureProfile({ userId, email, name, role, status }) {
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id, email, name, role, status, activated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await admin.from("profiles").insert({
      user_id: userId,
      email,
      name,
      role,
      status,
      activated_at: now.toISOString(),
    });
    return;
  }

  await admin
    .from("profiles")
    .update({
      email,
      name,
      role,
      status,
      activated_at: status === "active" ? existing.activated_at || now.toISOString() : existing.activated_at,
    })
    .eq("user_id", userId);
}

async function ensureTenant({ userId, slug, siteName }) {
  const { data: existing } = await admin
    .from("tenants")
    .select("id, user_id, slug")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("tenants")
      .update({
        slug,
        site_name: siteName,
        site_status: "active",
        activated_at: now.toISOString(),
        suspended_at: null,
        cancelled_at: null,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: tenant, error } = await admin
    .from("tenants")
    .insert({
      user_id: userId,
      slug,
      site_name: siteName,
      site_status: "active",
      activated_at: now.toISOString(),
      settings: {},
    })
    .select("id")
    .single();

  if (error || !tenant) {
    const { data: retry } = await admin
      .from("tenants")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (retry) return retry.id;
    throw error || new Error("Falha ao criar tenant");
  }
  return tenant.id;
}

async function ensurePlanMonthly() {
  const { data: existing } = await admin
    .from("plans")
    .select("id, code")
    .eq("code", "monthly")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: plan, error } = await admin
    .from("plans")
    .insert({
      name: "Plano Mensal",
      code: "monthly",
      description: "Site profissional, IA, agendamento, CRM e domínio próprio.",
      activation_price_cents: 29700,
      monthly_price_cents: 4700,
      billing_interval: "month",
      status: "active",
      features: [
        "Site profissional personalizado",
        "Chat IA especialista doTERRA",
        "Agendamento integrado",
        "CRM de clientes",
        "Domínio próprio incluso",
        "Suporte por WhatsApp",
      ],
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !plan) throw error || new Error("Falha ao criar plano");
  log.plan = "plano 'monthly' criado (não existia)";
  return plan.id;
}

async function ensureSubscription({ tenantId, planId }) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    plan_id: planId,
    stripe_customer_id: "cus_TESTE_cliente_teste",
    stripe_subscription_id: "sub_TESTE_cliente_teste",
    stripe_price_id: STRIPE_MONTHLY_PRICE_ID,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: in30d,
    next_billing_at: in30d,
    cancel_at_period_end: false,
    activated_at: now.toISOString(),
    canceled_at: null,
  };

  if (existing) {
    await admin.from("subscriptions").update(payload).eq("id", existing.id);
    return existing.id;
  }

  const { data: sub, error } = await admin
    .from("subscriptions")
    .insert(payload)
    .select("id")
    .single();
  if (error || !sub) throw error || new Error("Falha ao criar assinatura");
  return sub.id;
}

async function ensurePayment({ tenantId, subscriptionId, type, amountCents, piId, csId, invoiceId }) {
  await admin
    .from("payments")
    .upsert(
      {
        tenant_id: tenantId,
        subscription_id: subscriptionId || null,
        stripe_payment_intent_id: piId,
        stripe_checkout_session_id: csId || null,
        type,
        amount_cents: amountCents,
        currency: "brl",
        status: "succeeded",
        paid_at: now.toISOString(),
        metadata: {
          test: true,
          note: "Dados de TESTE — nenhuma cobrança real no Stripe.",
        },
      },
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true }
    );

  if (invoiceId) {
    await admin
      .from("billing_history")
      .upsert(
        {
          tenant_id: tenantId,
          subscription_id: subscriptionId || null,
          plan_id: null,
          stripe_invoice_id: invoiceId,
          stripe_charge_id: `ch_TESTE_${type}`,
          type,
          amount_cents: amountCents,
          currency: "brl",
          status: "succeeded",
          period_start: now.toISOString(),
          period_end: in30d,
        },
        { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
      );
  }
}

async function ensureSiteData({ tenantId }) {
  const data = {
    name: "Cliente",
    surname: "Teste",
    fullName: "Cliente Teste",
    role: "Consultora de demonstração · Site de teste",
    eyebrow: "Site de demonstração — Cliente Teste",
    description: "Site de demonstração — Cliente Teste. Conteúdo criado apenas para testes da plataforma.",
    whatsapp: null,
    email: USER_EMAIL,
    instagram: null,
    site_title: "Site de demonstração — Cliente Teste",
    social: {},
  };

  await admin
    .from("site_settings")
    .upsert({ tenant_id: tenantId, data }, { onConflict: "tenant_id" });
}

// Seções da HOME que devem ficar ATIVAS no site do Cliente Teste.
// CTA → seção "pricing" (Planos/Oferta), a CTA de conversão da plataforma.
const SECTIONS_TO_ENABLE = [
  "hero",          // Hero
  "about",         // Especialista / Apresentação
  "story",         // Sobre / História
  "testimonials",  // Depoimentos
  "video",         // Vídeo
  "booking",       // Agendamento
  "products",      // Produtos
  "faq",           // FAQ
  "pricing",       // CTA (Planos / Oferta)
];

async function ensureTenantSections({ tenantId }) {
  const { data: sections } = await admin
    .from("site_sections")
    .select("id, key, is_required")
    .in("key", SECTIONS_TO_ENABLE);

  if (!sections || sections.length === 0) {
    console.log("   ⚠️  Tabela site_sections sem registros/migração — pulando tenant_sections.");
    return;
  }

  for (const section of sections) {
    await admin
      .from("tenant_sections")
      .upsert(
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
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log("==================================================");
  console.log(" SEED — Usuários de teste (idempotente)");
  console.log(" Supabase:", env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("==================================================\n");

  // ---------- 1) SUPER ADMIN ----------
  console.log("• Super Admin");
  const superadmin = await ensureAuthUser({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    name: "Super Admin Teste",
  });
  log.superadmin = superadmin.created ? "criado" : "já existia — atualizado";

  await ensureProfile({
    userId: superadmin.id,
    email: SUPERADMIN_EMAIL,
    name: "Super Admin Teste",
    role: "superadmin",
    status: "active",
  });
  console.log(`   ${SUPERADMIN_EMAIL} → role=superadmin · status=active (${log.superadmin})`);

  // ---------- 2) CLIENTE TESTE ----------
  console.log("\n• Cliente Teste");
  const client = await ensureAuthUser({
    email: USER_EMAIL,
    password: USER_PASSWORD,
    name: "Cliente Teste",
  });
  log.client = client.created ? "criado" : "já existia — atualizado";

  await ensureProfile({
    userId: client.id,
    email: USER_EMAIL,
    name: "Cliente Teste",
    role: "user",
    status: "active",
  });

  const tenantId = await ensureTenant({
    userId: client.id,
    slug: "cliente-teste",
    siteName: "Site de demonstração — Cliente Teste",
  });
  console.log(`   ${USER_EMAIL} → role=user · status=active (${log.client})`);
  console.log(`   tenant: /cliente-teste · site_status=active`);

  // ---------- 3) FINANCEIRO (registros internos de TESTE) ----------
  const planId = await ensurePlanMonthly();
  const subscriptionId = await ensureSubscription({ tenantId, planId });
  console.log(`   ${log.plan} · assinatura=active (R$ 47,00/mês)`);

  // Ativação R$ 297,00 PAGO + mensalidade R$ 47,00 PAGA
  await ensurePayment({
    tenantId,
    subscriptionId: null,
    type: "activation",
    amountCents: 29700,
    piId: "pi_TESTE_ativacao_cliente_teste",
    csId: "cs_TESTE_ativacao_cliente_teste",
    invoiceId: null,
  });
  await ensurePayment({
    tenantId,
    subscriptionId,
    type: "subscription",
    amountCents: 4700,
    piId: "pi_TESTE_mensalidade_cliente_teste",
    csId: null,
    invoiceId: "in_TESTE_mensalidade_cliente_teste",
  });
  console.log("   pagamento ativação R$ 297,00 = succeeded (TESTE)");
  console.log("   pagamento mensalidade R$ 47,00 = succeeded (TESTE)");

  // ---------- 4) SITE / CONTEÚDO ----------
  await ensureSiteData({ tenantId });
  await ensureTenantSections({ tenantId });
  console.log("   site_settings + tenant_sections (HERO, SOBRE, DEPOIMENTOS, VÍDEO, AGENDAMENTO, PRODUTOS, FAQ, CTA) ativas");

  console.log("\n==================================================");
  console.log(" ✅ Seed concluído.");
  console.log("    Super Admin:  " + SUPERADMIN_EMAIL);
  console.log("    Cliente:      " + USER_EMAIL);
  console.log("    URL pública:  " + (env.NEXT_PUBLIC_APP_URL || "https://sitedoterra-psi.vercel.app") + "/cliente-teste");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("\n❌ Erro no seed:");
  console.error(err?.message || err);
  process.exit(1);
});
