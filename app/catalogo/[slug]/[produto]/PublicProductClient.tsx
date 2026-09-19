"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, QrCode, CheckCircle, Loader2, AlertCircle, Copy } from "lucide-react";

type CatalogPaymentSettings = {
  pix_enabled: boolean;
  pix_discount_percent: number;
  mp_enabled: boolean;
  mp_installments: number;
  requires_contact_info: boolean;
} | null;

type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  unit: string;
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface PixPaymentData {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
}

interface MercadoPagoData {
  preferenceId: string;
  initPoint: string;
}

export default function PublicProductClient({
  slug,
  profileName,
  product,
  whatsappLink,
  paymentSettings,
}: {
  slug: string;
  profileName: string;
  product: PublicProduct;
  whatsappLink: string | null;
  paymentSettings: CatalogPaymentSettings;
}) {
  const [activeTab, setActiveTab] = useState<"pix" | "mercadopago" | "whatsapp">("pix");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);

  const [mpLoading, setMpLoading] = useState(false);
  const [mpData, setMpData] = useState<MercadoPagoData | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);

  const settings = paymentSettings || {
    pix_enabled: true,
    pix_discount_percent: 0,
    mp_enabled: false,
    mp_installments: 1,
    requires_contact_info: true,
  };

  const hasPixDiscount = settings.pix_enabled && settings.pix_discount_percent > 0;
  const pixDiscountCents = Math.round(product.price_cents * (settings.pix_discount_percent / 100));
  const pixPriceCents = product.price_cents - pixDiscountCents;
  const totalPixCents = pixPriceCents * quantity;
  const totalOriginalCents = product.price_cents * quantity;

  type PaymentTab = "pix" | "mercadopago" | "whatsapp";

  const availableTabs: PaymentTab[] = [];
  if (settings.pix_enabled) availableTabs.push("pix");
  if (settings.mp_enabled) availableTabs.push("mercadopago");
  availableTabs.push("whatsapp");

  // Auto-switch to first available tab
  if (!availableTabs.includes(activeTab)) {
    setActiveTab(availableTabs[0]);
  }

  async function handlePixPurchase() {
    if (settings.requires_contact_info && (!customerName.trim() || (!customerEmail.trim() && !customerPhone.trim()))) {
      setPixError("Informe seu nome e pelo menos e-mail ou telefone.");
      return;
    }
    setPixLoading(true);
    setPixError(null);
    setPixData(null);

    try {
      const res = await fetch(`/api/catalogo/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          productId: product.id,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerNotes: customerNotes.trim() || undefined,
          paymentMethod: "pix",
          quantity,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar pedido PIX");

      if (data.pix) {
        setPixData(data.pix);
      } else if (data.order?.payment_qr_code) {
        setPixData({
          qrCode: data.order.payment_qr_code,
          qrCodeBase64: data.order.payment_qr_code_text || "",
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });
      } else {
        setPixError("Não foi possível gerar o QR Code. Tente novamente.");
      }
    } catch (e) {
      setPixError(e instanceof Error ? e.message : "Erro ao processar PIX");
    } finally {
      setPixLoading(false);
    }
  }

  async function handleMercadoPagoPurchase() {
    if (settings.requires_contact_info && (!customerName.trim() || (!customerEmail.trim() && !customerPhone.trim()))) {
      setMpError("Informe seu nome e pelo menos e-mail ou telefone.");
      return;
    }
    setMpLoading(true);
    setMpError(null);
    setMpData(null);

    try {
      const res = await fetch(`/api/catalogo/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          productId: product.id,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerNotes: customerNotes.trim() || undefined,
          paymentMethod: "mercadopago",
          quantity,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar preferência");

      if (data.mercadoPago?.initPoint) {
        setMpData(data.mercadoPago);
        // Redireciona para o Mercado Pago
        window.location.href = data.mercadoPago.initPoint;
      } else if (data.order?.payment_id) {
        // Fallback: tenta buscar a preferência
        setMpError("Preferência criada. Redirecionando...");
      } else {
        setMpError("Não foi possível iniciar o pagamento. Tente novamente.");
      }
    } catch (e) {
      setMpError(e instanceof Error ? e.message : "Erro ao processar Mercado Pago");
    } finally {
      setMpLoading(false);
    }
  }

  function copyPixCode() {
    if (pixData?.qrCodeBase64) {
      navigator.clipboard.writeText(pixData.qrCodeBase64);
    }
  }

  const pixTabContent = (
    <div className="space-y-4">
      {hasPixDiscount && (
        <div className="rounded-[12px] bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2 text-emerald-800 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Desconto PIX de {settings.pix_discount_percent}%</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[13px] text-emerald-600 line-through">{formatBRL(totalOriginalCents)}</span>
            <span className="text-[24px] font-extrabold text-emerald-700">{formatBRL(totalPixCents)}</span>
            <span className="text-emerald-600">por {quantity}x {product.unit || "un"}</span>
          </div>
        </div>
      )}

      {pixError && (
        <div className="rounded-[10px] bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{pixError}</span>
        </div>
      )}

      {!pixData ? (
        <div className="space-y-4">
          {settings.requires_contact_info && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-[10px] border border-gray-200">
              <h4 className="font-semibold text-gray-800">Dados para o pedido</h4>
              <input
                type="text"
                placeholder="Seu nome completo *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input w-full"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="E-mail"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="input"
                />
                <input
                  type="tel"
                  placeholder="Telefone (WhatsApp)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="input"
                />
              </div>
              <textarea
                placeholder="Observações (opcional)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="input min-h-20"
                rows={2}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>Quantidade:</span>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="input w-24"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="text-lg font-bold text-[#0d3320] ml-auto">
              {hasPixDiscount ? formatBRL(totalPixCents) : formatBRL(totalOriginalCents)}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePixPurchase}
            disabled={pixLoading || (settings.requires_contact_info && (!customerName.trim() || (!customerEmail.trim() && !customerPhone.trim())))}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#1d5c3a] hover:bg-[#165030] text-white text-[15px] font-semibold px-5 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pixLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <QrCode className="h-5 w-5" />
                Pagar com PIX
              </>
            )}
          </button>

          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white hover:bg-slate-50 text-[#2d3a4a] text-[14px] font-semibold px-4 py-3 transition"
            >
              💬 Falar no WhatsApp
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[12px] bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-2 text-emerald-800 mb-3">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">QR Code gerado! Escaneie com seu app do banco</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              {pixData.qrCodeBase64 && (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 bg-white p-2 rounded-[8px] border border-emerald-200"
                />
              )}
              {pixData.qrCode && !pixData.qrCodeBase64 && (
                <div className="w-48 h-48 bg-white p-2 rounded-[8px] border border-emerald-200 flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-emerald-600" />
                </div>
              )}
              <div className="text-center">
                <p className="text-sm text-emerald-700">Copia e cola:</p>
                <div className="flex gap-2 mt-1">
                  <input
                    readOnly
                    value={pixData.qrCodeBase64 || pixData.qrCode || ""}
                    className="input flex-1 text-xs font-mono bg-white"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copyPixCode}
                    className="btn btn-outline !whitespace-nowrap text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar
                  </button>
                </div>
              </div>
              <p className="text-xs text-emerald-600">
                Expira em {new Date(pixData.expiresAt).toLocaleTimeString("pt-BR")}
              </p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500">
            Após o pagamento, seu pedido será confirmado automaticamente.
          </p>
          <button
            type="button"
            onClick={() => setPixData(null)}
            className="w-full btn btn-outline"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );

  const mpTabContent = (
    <div className="space-y-4">
      {settings.requires_contact_info && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-[10px] border border-gray-200">
          <h4 className="font-semibold text-gray-800">Dados para o pedido</h4>
          <input
            type="text"
            placeholder="Seu nome completo *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="input w-full"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="E-mail"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="input"
            />
            <input
              type="tel"
              placeholder="Telefone (WhatsApp)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="input"
            />
          </div>
          <textarea
            placeholder="Observações (opcional)"
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            className="input min-h-20"
            rows={2}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>Quantidade:</span>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="input w-24"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="text-lg font-bold text-[#0d3320] ml-auto">
          {formatBRL(totalOriginalCents)}
        </span>
      </div>

      {mpError && (
        <div className="rounded-[10px] bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{mpError}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleMercadoPagoPurchase}
        disabled={mpLoading || (settings.requires_contact_info && (!customerName.trim() || (!customerEmail.trim() && !customerPhone.trim())))}
        className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#009EE3] hover:bg-[#0088CC] text-white text-[15px] font-semibold px-5 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mpLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Redirecionando...
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            Pagar com Mercado Pago
          </>
        )}
      </button>

      {settings.mp_installments > 1 && (
        <p className="text-center text-sm text-gray-500">
          Em até {settings.mp_installments}x {settings.mp_installments_without_interest ? "sem juros" : "com juros"}
        </p>
      )}

      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white hover:bg-slate-50 text-[#2d3a4a] text-[14px] font-semibold px-4 py-3 transition"
        >
          💬 Falar no WhatsApp
        </a>
      )}
    </div>
  );

  const whatsappTabContent = (
    <div className="space-y-4 text-center">
      <div className="rounded-[12px] bg-blue-50 border border-blue-200 p-6">
        <div className="text-5xl mb-3">💬</div>
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Comprar via WhatsApp</h3>
        <p className="text-blue-700 mb-4">
          Entre em contato diretamente com {profileName.split(" ")[0]} para tirar dúvidas e finalizar sua compra.
        </p>
        {whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[12px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[15px] font-semibold px-5 py-3 transition"
          >
            Abrir WhatsApp
          </a>
        ) : (
          <p className="text-blue-600">Configure o WhatsApp no site para habilitar esta opção.</p>
        )}
      </div>
      <p className="text-sm text-gray-500">
        O pagamento será combinado diretamente com o vendedor.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcf9f5]">
      <header className="bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-3">
          <Link href={`/catalogo/${slug}`} className="inline-flex items-center gap-1.5 text-[13.5px] text-white/90 hover:text-white">
            ← Voltar ao catálogo
          </Link>
          <Link href={`/${slug}`} className="text-[13px] text-white/70 hover:text-white">
            Ver site
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <article className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-[18px] border border-[#e2e8e0] shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="relative aspect-[4/3] bg-gradient-to-br from-[#eaf6ec] to-[#f5f7f4]">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-7xl text-[#1d5c3a]/25 select-none">📦</div>
            )}
          </div>
          <div className="p-6 flex flex-col">
            {product.category && (
              <span className="self-start inline-flex items-center rounded-full bg-[#eaf6ec] border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-800 leading-none">
                {product.category}
              </span>
            )}
            <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-[#0d3320] mt-2 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {product.name}
            </h1>
            {product.description && (
              <p className="text-[15px] leading-6 text-[#4a5a52] mt-3 whitespace-pre-line">{product.description}</p>
            )}

            {/* Payment Tabs */}
            <div className="mt-auto pt-5">
              <div className="flex gap-1 mb-4 bg-gray-100 rounded-[10px] p-1">
                {availableTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-sm font-semibold transition ${
                      activeTab === tab
                        ? "bg-white text-[#1d5c3a] shadow-sm"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    {tab === "pix" && <QrCode className="h-4 w-4" />}
                    {tab === "mercadopago" && <CreditCard className="h-4 w-4" />}
                    {tab === "whatsapp" && <span>💬</span>}
                    <span>{tab === "pix" ? "PIX" : tab === "mercadopago" ? "Mercado Pago" : "WhatsApp"}</span>
                  </button>
                ))}
              </div>

              {activeTab === "pix" && pixTabContent}
              {activeTab === "mercadopago" && mpTabContent}
              {activeTab === "whatsapp" && whatsappTabContent}
            </div>
          </div>
        </article>

        <div className="mt-6 text-center text-[12px] text-[#8a9a8e]">
          Catálogo de <b className="text-[#0d3320]">{profileName}</b> ·{" "}
          <Link href={`/catalogo/${slug}`} className="text-[#1d5c3a] hover:underline">Ver mais produtos</Link>
        </div>
      </main>
    </div>
  );
}