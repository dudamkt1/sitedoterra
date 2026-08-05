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
  activation_price_cents: number;
  monthly_price_cents: number;
  billing_interval: "month" | "year";
  status: "active" | "inactive";
  features: unknown[];
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
}
