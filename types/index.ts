export type UserRole = "user" | "superadmin";
export type AccountStatus =
  | "pending_activation"
  | "active"
  | "suspended"
  | "blocked"
  | "cancelled";
export type SiteStatus = "pending" | "active" | "suspended";
export type SubscriptionStatus =
  | "awaiting_activation"
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "paused";
export type DomainStatus =
  | "pending"
  | "verifying"
  | "verified"
  | "ssl_pending"
  | "active"
  | "error"
  | "removed"
  | "blocked";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "cancelled";
export type PaymentType = "activation" | "subscription" | "manual" | "refund";

export interface Profile {
  user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  cancelled_at: string | null;
  suspended_at: string | null;
  blocked_at: string | null;
  unblocked_at: string | null;
}

export interface Tenant {
  id: string;
  user_id: string;
  slug: string;
  site_name: string | null;
  site_status: SiteStatus;
  /** false = usuário isento de mensalidade recorrente (Super Admin decidiu na ativação). */
  monthly_billing_enabled: boolean;
  created_at: string;
  activated_at: string | null;
  suspended_at: string | null;
  cancelled_at: string | null;
  reactivated_at: string | null;
  settings: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  /** Gateway de pagamento da assinatura (padrão: stripe). */
  gateway: "stripe" | "mercadopago";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  mercadopago_customer_id: string | null;
  mercadopago_subscription_id: string | null;
  mercadopago_plan_id: string | null;
  /** Termos contratuais congelados na contratação (preços não mudam para contratos existentes). */
  snapshot: Record<string, unknown> | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  activated_at: string | null;
  canceled_at: string | null;
  reactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  tenant_id: string;
  domain: string;
  is_apex: boolean;
  vercel_domain_id: string | null;
  status: DomainStatus;
  ssl_status: string | null;
  vercel_config: Record<string, unknown>;
  connected_at: string;
  verified_at: string | null;
  last_checked_at: string | null;
  error_message: string | null;
  removed_at: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  /** Valor normal da ativação (ex.: R$ 1.500,00) — exibido riscado. */
  activation_regular_price_cents: number;
  /** Valor promocional/cobrado da ativação (ex.: R$ 297,00) — pagamento único. */
  activation_price_cents: number;
  /** Mensalidade recorrente (ex.: R$ 47,00/mês). */
  monthly_price_cents: number;
  billing_interval: "month" | "year";
  status: "active" | "inactive";
  /** Benefícios da oferta (exibidos com ✓ na HOME). */
  features: string[];
  offer_title: string | null;
  offer_subtitle: string | null;
  promo_text: string | null;
  /** Texto do botão CTA. Aceita o placeholder {price} (ex.: "Quero meu site por {price}"). */
  cta_text: string | null;
  /** Texto de transparência. Aceita {activation} e {monthly}. */
  transparency_text: string | null;
  cancel_text: string | null;
  allow_cancel: boolean;
  /** Primeira cobrança da mensalidade em N dias após a ativação (legado). */
  trial_days: number;
  /** Primeira cobrança da mensalidade em N meses após a ativação (padrão 3). */
  trial_months: number;
  sort_order: number;
  stripe_product_id: string | null;
  /** Price ID da mensalidade no Stripe (legado). */
  stripe_price_id: string | null;
  /** Price ID da ativação no Stripe (pagamento único). */
  activation_price_id: string | null;
  /** Price ID da mensalidade no Stripe (recorrente). */
  monthly_price_id: string | null;
  /** Cache do valor usado ao criar os Price IDs no Stripe (recria quando muda). */
  activation_price_amount_cents?: number | null;
  monthly_price_amount_cents?: number | null;
  /** Cache do plano recorrente do Mercado Pago (criado automaticamente). */
  mercadopago_plan_id: string | null;
  /** Valor da mensalidade no momento em que o plano MP foi criado (cache). */
  mercadopago_plan_amount_cents: number | null;
  /** Limite de armazenamento de mídia (bytes) permitido por este plano. */
  media_quota_bytes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: string;
  plan_id: string;
  field: string;
  previous_value_cents: number | null;
  new_value_cents: number | null;
  changed_by: string | null;
  created_at: string;
}

export interface PublicTenant {
  tenant_id: string;
  slug: string;
  site_name: string | null;
  site_status: SiteStatus;
  settings: Record<string, unknown>;
  site_data: Record<string, unknown>;
  profile_name: string | null;
  email: string;
  monthly_billing_enabled: boolean;
  user_id: string;
}

// ============================ HOME MODULAR ============================

export type SectionType =
  | "header"
  | "hero"
  | "trustbar"
  | "about"
  | "testimonials"
  | "story"
  | "video"
  | "booking"
  | "tips"
  | "products"
  | "faq"
  | "pricing"
  | "footer";

export interface SectionPermissions {
  can_edit?: boolean;
  can_toggle?: boolean;
  can_edit_image?: boolean;
  can_edit_video?: boolean;
  can_edit_button?: boolean;
  can_edit_colors?: boolean;
  can_edit_layout?: boolean;
  available_to_all?: boolean;
}

export interface SiteSection {
  id: string;
  type: SectionType;
  key: string;
  label: string;
  title: string | null;
  subtitle: string | null;
  enabled: boolean;
  is_required: boolean;
  sort_order: number;
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  permissions: SectionPermissions;
  created_at?: string;
  updated_at?: string;
}

export interface TenantSection {
  id?: string;
  tenant_id: string;
  section_id: string;
  enabled: boolean;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ResolvedHomeSection extends SiteSection {
  tenant_id?: string;
  tenant_enabled: boolean;
  tenant_override?: boolean;
  anchor: string;
  navLabel?: string;
}

// ============================ IA ============================

export interface AiProvider {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  requires_api_key: boolean;
  free_tier: string | null;
  limits: string | null;
  docs_url: string | null;
  base_url: string | null;
  model: string | null;
  instructions: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AiSettings {
  id?: string;
  user_id: string;
  provider_id: string | null;
  api_key_enc: string | null;
  updated_at?: string;
}

export interface AiConfigView {
  settings: {
    provider_id: string | null;
    has_key: boolean;
    key_hint: string | null;
  };
  providers: AiProvider[];
}

// ============================ CENTRAL DE IA (conteúdo doTERRA) ============================

export interface AiToolField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
}

export interface AiTool {
  id: string;
  code: string;
  name: string;
  emoji: string;
  category: string;
  description: string | null;
  examples: string[];
  enabled: boolean;
  requires_api_key: boolean;
  sort_order: number;
  base_prompt: string | null;
  created_at?: string;
  updated_at?: string;
  /** Mesclado do esquema em lib/ai-tools.ts */
  fields: AiToolField[];
  generates_content: boolean;
}

export interface AiTemplateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "color" | "image" | "select";
  default?: string;
  options?: string[];
}

export interface AiTemplateStructure {
  layout: "story" | "carrossel";
  fields: AiTemplateField[];
}

export interface AiTemplate {
  id: string;
  code: string;
  name: string;
  emoji: string;
  category: string;
  description: string | null;
  structure: AiTemplateStructure;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AiHistoryItem {
  id: string;
  user_id: string;
  tenant_id: string | null;
  tool_code: string | null;
  tool_name: string | null;
  prompt: string | null;
  content: string;
  metadata: Record<string, unknown>;
  favorite: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AiUserTemplate {
  id: string;
  user_id: string;
  tenant_id: string | null;
  template_code: string;
  name: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

// ============================ MÍDIA (Cloudflare R2) ============================

export type MediaStatus = "uploading" | "uploaded" | "failed";
export type MediaScope = "tenant" | "system" | "admin";

/** Metadados de um arquivo armazenado no R2 (binário NUNCA vai para o banco). */
export interface MediaFile {
  id: string;
  tenant_id: string | null;
  user_id: string;
  storage_key: string;
  public_url: string;
  original_name: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number;
  width: number | null;
  height: number | null;
  category: string;
  folder: string | null;
  is_public: boolean;
  status: MediaStatus;
  created_at: string;
  updated_at: string;
  /** Campos extras presentes somente na visão do Super Admin. */
  tenant_name?: string | null;
  tenant_slug?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
}

export interface MediaAction {
  id: string;
  media_id: string | null;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface MediaStorageStats {
  totalBytes: number;
  totalFiles: number;
  quotaBytes: number;
  byTenant: {
    tenant_id: string;
    slug: string;
    site_name: string | null;
    files: number;
    bytes: number;
  }[];
}

// ============================ CRM CONSULTORES ============================

export type CrmModuleCode =
  | "fidelidade"
  | "financeiro"
  | "cobrancas"
  | "whatsapp"
  | "automacoes"
  | "relatorios";

export interface CrmSettings {
  tenant_id: string;
  currency: string;
  modules: Partial<Record<CrmModuleCode, boolean>>;
  vip_rules: {
    minSpentCents?: number;
    minPurchases?: number;
    minPoints?: number;
    reorderMonths?: number;
  };
  categories: string[];
  financial_categories: {
    income?: string[];
    expense?: string[];
  };
  created_at?: string;
  updated_at?: string;
}

export interface CrmClient {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  category: string;
  is_vip: boolean;
  first_contact_at: string | null;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  /** Aggregados computados (somente leitura). */
  total_spent_cents?: number;
  purchase_count?: number;
  ticket_avg_cents?: number;
  points_balance?: number;
}

export interface CrmClientNote {
  id: string;
  tenant_id: string;
  client_id: string;
  user_id: string;
  note: string;
  created_at: string;
}

export interface CrmTimelineEvent {
  id: string;
  tenant_id: string;
  client_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_at: string;
  created_at: string;
}

export interface CrmProduct {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  active: boolean;
  /** Código/SKU opcional para identificação interna. */
  sku: string | null;
  /** Unidade de venda (ex.: un, cx, kg, ml). Default "un". */
  unit: string;
  /** Observações internas (não aparecem no catálogo público). */
  notes: string | null;
  /** Exibe no catálogo público compartilhado. Default true. */
  show_publicly: boolean;
  created_at: string;
  updated_at: string;
  /** Computado: quantidade vendida / total vendido. */
  units_sold?: number;
  sold_cents?: number;
}

export interface CrmSale {
  id: string;
  tenant_id: string;
  user_id: string;
  client_id: string | null;
  sale_date: string;
  discount_cents: number;
  total_cents: number;
  payment_method: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Relacionamentos (somente leitura). */
  client_name?: string | null;
  items?: CrmSaleItem[];
}

export interface CrmSaleItem {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export interface CrmFinancialEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  client_id: string | null;
  type: "income" | "expense";
  category: string | null;
  description: string | null;
  amount_cents: number;
  entry_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
}

export interface CrmCharge {
  id: string;
  tenant_id: string;
  user_id: string;
  client_id: string | null;
  sale_id: string | null;
  amount_cents: number;
  due_date: string;
  payment_method: string | null;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
}

export interface CrmLoyaltySettings {
  tenant_id: string;
  enabled: boolean;
  program_name: string;
  points_per_purchase_cents: number;
  points_per_referral: number;
  points_per_birthday: number;
  points_per_special: number;
  rules: string[];
  benefits: string[];
  rewards: string[];
  levels: { name: string; min_points: number }[];
  created_at?: string;
  updated_at?: string;
}

export interface CrmLoyaltyPoint {
  id: string;
  tenant_id: string;
  client_id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  client_name?: string | null;
}

export interface CrmTask {
  id: string;
  tenant_id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  category: string | null;
  notes: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
}

export interface CrmAutomation {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  enabled: boolean;
  days: number;
  schedule_time: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmMessageTemplate {
  id: string;
  tenant_id: string;
  user_id: string;
  code: string | null;
  label: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface CrmWhatsAppConfig {
  tenant_id: string;
  enabled: boolean;
  provider: string | null;
  api_url: string | null;
  phone_id: string | null;
  webhook_url: string | null;
  connection_status: string;
  created_at: string;
  updated_at: string;
  /** Exibido apenas com máscara, nunca o token real. */
  has_token: boolean;
  key_hint: string | null;
}

// ============================ AGENDAMENTOS ============================

export type BookingStatus = "pendente" | "confirmado" | "realizado" | "cancelado" | "faltou" | "reagendado";

export interface TenantBooking {
  id: string;
  tenant_id: string;
  user_id: string;
  client_name: string;
  client_whatsapp: string | null;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string; // YYYY-MM-DD
  booking_time: string; // HH:mm
  notes: string | null;
  status: BookingStatus;
  source: "painel" | "site" | "whatsapp" | "importado";
  created_at: string;
  updated_at: string;
}

export interface CrmDashboardStats {
  activeClients: number;
  vipClients: number;
  monthSales: number;
  monthRevenueCents: number;
  receivableCents: number;
  pendingCharges: number;
  overdueCharges: number;
  clientsWithoutRecentContact: number;
  upcomingBirthdays: { id: string; name: string; birth_date: string }[];
  upcomingTasks: CrmTask[];
  vipClientsList: CrmClient[];
  needsAttention: CrmClient[];
  revenueByMonth: { month: string; total_cents: number; sales: number }[];
  consultantName: string | null;
  currency: string;
}

export interface CrmExportBundle {
  exported_at: string;
  consultant_name: string | null;
  site_name: string | null;
  currency: string;
  clients: CrmClient[];
  products: CrmProduct[];
  sales: CrmSale[];
  financial: CrmFinancialEntry[];
  charges: CrmCharge[];
  tasks: CrmTask[];
  loyaltyPoints: CrmLoyaltyPoint[];
}

// ============================ AFILIADOS ============================

export type AffiliateConversionStatus = "pendente" | "aprovado" | "pago" | "estornado";
export type AffiliatePayoutStatus = "solicitado" | "em_analise" | "pago" | "rejeitado";
export type AffiliatePayoutMethod = "pix" | "mercado_pago";
export type AffiliatePixKeyType = "cpf_cnpj" | "email" | "phone" | "random";

export interface AffiliatePaymentMethod {
  user_id: string;
  method: AffiliatePayoutMethod;
  pix_key_type: AffiliatePixKeyType | null;
  pix_key: string | null;
  mp_email: string | null;
  updated_at: string;
}

export interface AffiliateSettings {
  id: string;
  commission_percent: number;
  min_payout_amount: number;
  program_active: boolean;
  terms_version: number;
  cookie_max_age_days: number;
  /**
   * Flag global controlada pelo Super Admin: permite que afiliados sem site
   * ativo divulguem seu link de afiliado e gerem novas indicações.
   * Default: true (preserva comportamento do programa).
   */
  allow_inactive_site_affiliate: boolean;
  updated_at: string;
}

export interface AffiliateStatus {
  id: string;
  user_id: string;
  is_active: boolean;
  accepted_terms_at: string | null;
  accepted_terms_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateClick {
  id: string;
  affiliate_user_id: string;
  visitor_token: string;
  source_subdomain: string;
  clicked_at: string;
  converted: boolean;
}

export interface AffiliateConversion {
  id: string;
  click_id: string;
  affiliate_user_id: string;
  new_customer_user_id: string;
  sale_amount: number;
  commission_percent_at_time: number;
  commission_amount: number;
  status: AffiliateConversionStatus;
  created_at: string;
}

export interface AffiliatePayout {
  id: string;
  affiliate_user_id: string;
  amount: number;
  method: AffiliatePayoutMethod;
  /** Legado: chave PIX do momento (mantida para compatibilidade). */
  pix_key: string | null;
  /** Legado: metadata MP (mantida para compatibilidade). */
  mercado_pago_account_info: Record<string, unknown> | null;
  /**
   * Snapshot imutável dos dados de pagamento NO MOMENTO do saque.
   * Preserva os dados mesmo se o afiliado alterar depois.
   */
  pix_key_type_snapshot: AffiliatePixKeyType | null;
  pix_key_snapshot: string | null;
  mp_email_snapshot: string | null;
  /** Rótulo legível para UI: ex. "PIX (E-mail)". */
  payment_method_label: string | null;
  status: AffiliatePayoutStatus;
  requested_at: string;
  paid_at: string | null;
}

export interface AffiliateDashboardSummary {
  total_clicks: number;
  total_conversions: number;
  available_balance: number;
  pending_balance: number;
  total_paid: number;
}
