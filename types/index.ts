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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
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
