export interface DemoSession {
  active: true;
  nonce: string;
  startedAt: string;
}

export interface DemoClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  vip: boolean;
  loyaltyPoints: number;
  notes: string;
  createdAt: string;
}

export interface DemoProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  stock: number;
}

export interface DemoSale {
  id: string;
  clientId: string;
  productIds: string[];
  total: number;
  status: "pago" | "pendente" | "cancelado";
  createdAt: string;
}

export interface DemoCharge {
  id: string;
  clientId: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "pago" | "pendente" | "atrasado";
}

export interface DemoTask {
  id: string;
  title: string;
  clientId: string | null;
  dueDate: string;
  done: boolean;
  priority: "baixa" | "media" | "alta";
}

export interface DemoWhatsappMessage {
  id: string;
  clientId: string;
  direction: "in" | "out";
  content: string;
  createdAt: string;
}

export interface DemoMediaItem {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  createdAt: string;
}

export interface DemoFinanceEntry {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number;
  date: string;
}

export interface DemoSocialLink {
  enabled: boolean;
  url: string;
}

export interface DemoSiteData {
  site_title: string;
  name: string;
  surname: string;
  fullName: string;
  role: string;
  eyebrow: string;
  description: string;
  badgeTitle: string;
  badgeSubtitle: string;
  whatsapp: string;
  whatsapp_floating_enabled: boolean;
  email: string;
  instagram: string;
  instagramHandle: string;
  logoMode: "text" | "image";
  logoText: string;
  logoUrl: string;
  logoLightUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  stats: {
    years: string;
    clients: string;
    satisfaction: string;
  };
  social: {
    instagram: DemoSocialLink;
    facebook: DemoSocialLink;
    youtube: DemoSocialLink;
  };
}

export interface DemoSectionState {
  enabled: boolean;
  content: Record<string, unknown>;
}

export interface DemoData {
  clients: DemoClient[];
  products: DemoProduct[];
  sales: DemoSale[];
  charges: DemoCharge[];
  tasks: DemoTask[];
  whatsapp: DemoWhatsappMessage[];
  media: DemoMediaItem[];
  finance: DemoFinanceEntry[];
  site: DemoSiteData;
  sections: Record<string, DemoSectionState>;
  crmSettings: {
    modules: Record<string, boolean>;
    loyalty: {
      enabled: boolean;
      pointsPerCurrency: number;
      currencyPerPoint: number;
      vipThreshold: number;
    };
  };
}
