"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  QrCode,
  CheckCircle,
  Loader2,
  AlertCircle,
  Copy,
  Lock,
  ShieldCheck,
  Minus,
  Plus,
  BadgeCheck,
  Clock,
} from "lucide-react";
import type { CatalogPaymentSettings } from "@/types";
import { CatalogCardBrick } from "@/components/catalog/CatalogCardBrick";

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

interface BrickConfig {
  publicKey: string;
  productName: string;
  priceCents: number;
  maxInstallments: number;
  withoutInterest: number;
}

interface CardPaid {
  status: string;
  orderId: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  const [activeTab, setActiveTab] = useState<"pix" | "mercadopago">("pix");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);

  // Checkout transparente (cartão dentro da página)
  const [brickConfig, setBrickConfig] = useState<BrickConfig | null>(null);
  const [brickLoading, setBrickLoading] = useState(false);
  const [brickError, setBrickError] = useState<string | null>(null);
  const [brickDead, setBrickDead] = useState(false);
  const [cardPaid, setCardPaid] = useState<CardPaid | null>(null);

  // Fallback legado (redirect p/ o site do MP)
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpReturn, setMpReturn] = useState<"success" | "failure" | "pending" | null>(null);

  // Ao voltar do Mercado Pago legado, exibe aviso contextual.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mp = params.get("mp");
    if (mp === "success" || mp === "failure" || mp === "pending") {
      setMpReturn(mp);
      setActiveTab("mercadopago");
      const url = new URL(window.location.href);
      url.searchParams.delete("mp");
      url.searchParams.delete("order_id");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const settings = paymentSettings || {
    pix_enabled: true,
    pix_discount_percent: 0,
    mp_enabled: false,
    mp_installments: 1,
    mp_installments_without_interest: 1,
    requires_contact_info: true,
  };

  const hasPixDiscount = settings.pix_enabled && settings.pix_discount_percent > 0;
  const pixDiscountCents = Math.round(product.price_cents * (settings.pix_discount_percent / 100));
  const pixPriceCents = product.price_cents - pixDiscountCents;
  const totalPixCents = pixPriceCents * quantity;
  const totalOriginalCents = product.price_cents * quantity;

  type PaymentTab = "pix" | "mercadopago";
  const availableTabs: PaymentTab[] = [];
  if (settings.pix_enabled) availableTabs.push("pix");
  if (settings.mp_enabled) availableTabs.push("mercadopago");

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pix_enabled, settings.mp_enabled]);

  const contactInvalid =
    settings.requires_contact_info &&
    (!customerName.trim() || (!customerEmail.trim() && !customerPhone.trim()));
  const cardContactInvalid =
    !customerName.trim() || !EMAIL_RE.test(customerEmail.trim());

  // Carrega a config do Brick ao abrir a aba Cartão (uma vez por produto).
  useEffect(() => {
    if (activeTab !== "mercadopago" || !settings.mp_enabled) return;
    if (brickConfig || brickLoading || cardPaid) return;
    let cancelled = false;
    setBrickLoading(true);
    setBrickError(null);
    fetch(`/api/catalogo/brick-config?slug=${encodeURIComponent(slug)}&productId=${encodeURIComponent(product.id)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Checkout transparente indisponível.");
        if (!cancelled) setBrickConfig(json);
      })
      .catch((e) => {
        if (!cancelled) setBrickError(e instanceof Error ? e.message : "Checkout indisponível.");
      })
      .finally(() => {
        if (!cancelled) setBrickLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, slug, product.id]);

  async function handlePixPurchase() {
    if (contactInvalid) {
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

  /** Fallback legado: sai do site e paga no Mercado Pago (usado se o Brick falhar). */
  async function handleMercadoPagoRedirect() {
    if (contactInvalid) {
      setMpError("Informe seu nome e pelo menos e-mail ou telefone.");
      return;
    }
    setMpLoading(true);
    setMpError(null);

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
          returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar preferência");

      if (data.mercadoPago?.initPoint) {
        window.location.href = data.mercadoPago.initPoint;
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

  const maxInst = Math.max(1, Math.min(12, Number(settings.mp_installments) || 1));
  const rawWo = (settings as unknown as Record<string, unknown>).mp_installments_without_interest;
  const woQty =
    typeof rawWo === "boolean" ? (rawWo ? maxInst : 1) : Math.max(1, Math.min(maxInst, Number(rawWo) || 1));
  const installmentsHint =
    maxInst <= 1
      ? "À vista no cartão"
      : woQty >= maxInst
        ? `Em até ${maxInst}x sem juros`
        : woQty <= 1
          ? `Em até ${maxInst}x no cartão`
          : `Em até ${maxInst}x (até ${woQty}x sem juros)`;

  const brickAmount = totalOriginalCents / 100;
  const showBrick = !brickDead && !brickError && brickConfig;

  const contactFields = (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <h4 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">Seus dados</h4>
      <div>
        <input
          type="text"
          placeholder="Seu nome completo *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="input w-full"
          autoComplete="name"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="email"
          placeholder={activeTab === "mercadopago" ? "E-mail *" : "E-mail"}
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          className="input"
          autoComplete="email"
        />
        <input
          type="tel"
          placeholder="Telefone (WhatsApp)"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="input"
          autoComplete="tel"
        />
      </div>
      {showNotes ? (
        <textarea
          placeholder="Observações (opcional)"
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          className="input min-h-16"
          rows={2}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="text-[12.5px] font-semibold text-[#1d5c3a] hover:underline"
        >
          + Adicionar observações
        </button>
      )}
    </div>
  );

  const qtyStepper = (
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          aria-label="Diminuir quantidade"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1 || !!pixData || !!cardPaid}
          className="p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center text-[15px] font-bold text-slate-800 tabular-nums">{quantity}</span>
        <button
          type="button"
          aria-label="Aumentar quantidade"
          onClick={() => setQuantity((q) => Math.min(10, q + 1))}
          disabled={quantity >= 10 || !!pixData || !!cardPaid}
          className="p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="text-right">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Total</p>
        <p className="text-[22px] font-extrabold text-[#0d3320] tracking-tight leading-none">
          {formatBRL(activeTab === "pix" && hasPixDiscount ? totalPixCents : totalOriginalCents)}
        </p>
      </div>
    </div>
  );

  const pixPane = (
    <div className="space-y-4">
      {hasPixDiscount && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2 text-emerald-800 mb-1.5">
            <BadgeCheck className="h-5 w-5" />
            <span className="font-bold text-[14px]">Desconto PIX de {settings.pix_discount_percent}%</span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[13px] text-emerald-600 line-through">{formatBRL(totalOriginalCents)}</span>
            <span className="text-[24px] font-extrabold text-emerald-700">{formatBRL(totalPixCents)}</span>
          </div>
        </div>
      )}

      {pixError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{pixError}</span>
        </div>
      )}

      {!pixData ? (
        <div className="space-y-4">
          {settings.requires_contact_info && contactFields}
          {qtyStepper}
          <button
            type="button"
            onClick={handlePixPurchase}
            disabled={pixLoading || contactInvalid}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1d5c3a] hover:bg-[#165030] active:scale-[0.99] text-white text-[15px] font-bold px-5 py-3.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_6px_20px_rgba(29,92,58,0.3)]"
          >
            {pixLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <QrCode className="h-5 w-5" />
                Pagar {formatBRL(hasPixDiscount ? totalPixCents : totalOriginalCents)} com PIX
              </>
            )}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-slate-400">
            <Lock className="h-3.5 w-3.5" /> QR Code gerado aqui mesmo, sem sair da página
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-5">
            <div className="flex items-center gap-2 text-emerald-800 mb-3">
              <CheckCircle className="h-5 w-5" />
              <span className="font-bold">QR Code pronto! Escaneie para pagar</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              {pixData.qrCodeBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-52 h-52 bg-white p-2.5 rounded-2xl border border-emerald-200 shadow-sm"
                />
              ) : (
                <div className="w-52 h-52 bg-white p-2 rounded-2xl border border-emerald-200 flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-emerald-600" />
                </div>
              )}
              <div className="w-full">
                <p className="text-[12px] font-semibold text-emerald-700 mb-1">PIX copia e cola:</p>
                <div className="flex gap-2">
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
                Expira às {new Date(pixData.expiresAt).toLocaleTimeString("pt-BR")}
              </p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500">
            Após o pagamento, seu pedido é confirmado automaticamente.
          </p>
          <button type="button" onClick={() => setPixData(null)} className="w-full btn btn-outline">
            Voltar
          </button>
        </div>
      )}
    </div>
  );

  const cardPane = (
    <div className="space-y-4">
      {mpReturn && (
        <div
          className={`rounded-xl border p-3 flex items-center gap-2 ${
            mpReturn === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : mpReturn === "pending"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
        >
          {mpReturn === "success" ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-sm">
            {mpReturn === "success"
              ? "Pagamento aprovado! Obrigado pela compra."
              : mpReturn === "pending"
                ? "Pagamento pendente. Assim que compensar, confirmamos seu pedido."
                : "Você saiu do pagamento sem concluir. Finalize aqui mesmo, sem sair da página."}
          </span>
        </div>
      )}

      {cardPaid ? (
        <div
          className={`rounded-2xl border p-6 text-center ${
            cardPaid.status === "approved"
              ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200"
              : "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200"
          }`}
        >
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
              cardPaid.status === "approved" ? "bg-emerald-500" : "bg-amber-500"
            } text-white shadow-lg`}
          >
            {cardPaid.status === "approved" ? (
              <CheckCircle className="h-7 w-7" />
            ) : (
              <Clock className="h-7 w-7" />
            )}
          </div>
          <h4 className="text-[18px] font-extrabold text-slate-800">
            {cardPaid.status === "approved" ? "Pagamento aprovado!" : "Pagamento em análise"}
          </h4>
          <p className="mt-1.5 text-sm text-slate-600 leading-6">
            {cardPaid.status === "approved"
              ? "Obrigado pela compra! A confirmação chega no seu e-mail em instantes."
              : "Seu pagamento está sendo processado. Avisaremos assim que compensar — sem precisar fazer nada."}
          </p>
          <p className="mt-3 inline-block rounded-full bg-white/80 border border-slate-200 px-3 py-1 text-[11.5px] font-mono text-slate-500">
            Pedido {cardPaid.orderId.slice(0, 8)}…
          </p>
          <button
            type="button"
            onClick={() => {
              setCardPaid(null);
              setQuantity(1);
            }}
            className="mt-4 w-full btn btn-outline"
          >
            Fazer outro pedido
          </button>
        </div>
      ) : (
        <>
          {settings.requires_contact_info && contactFields}
          {qtyStepper}
          <p className="text-center text-[13px] font-semibold text-slate-500">{installmentsHint}</p>

          {brickLoading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col items-center gap-3" aria-live="polite">
              <div className="w-9 h-9 rounded-full border-4 border-[#e8efe8] border-t-[#1d5c3a] animate-spin" />
              <p className="text-sm font-medium text-slate-600">Carregando pagamento seguro...</p>
            </div>
          )}

          {showBrick && brickConfig && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  <CreditCard className="h-4 w-4" /> Cartão de crédito
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> Sem sair do site
                </span>
              </div>
              {cardContactInvalid ? (
                <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] leading-6 text-amber-800">
                  Preencha <b>nome completo</b> e <b>e-mail válido</b> acima para liberar o cartão.
                </p>
              ) : (
                <CatalogCardBrick
                  key={`${brickConfig.publicKey}-${brickAmount}`}
                  publicKey={brickConfig.publicKey}
                  amount={brickAmount}
                  payerEmail={customerEmail.trim()}
                  maxInstallments={brickConfig.maxInstallments}
                  order={{
                    slug,
                    productId: product.id,
                    customerName: customerName.trim(),
                    customerEmail: customerEmail.trim(),
                    customerPhone: customerPhone.trim(),
                    customerNotes: customerNotes.trim(),
                    quantity,
                  }}
                  onPaid={({ status, orderId }) => setCardPaid({ status, orderId })}
                  onBrickFailure={() => setBrickDead(true)}
                />
              )}
            </div>
          )}

          {(brickError || brickDead) && (
            <div className="space-y-3">
              {mpError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{mpError}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleMercadoPagoRedirect}
                disabled={mpLoading || contactInvalid}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#009EE3] hover:bg-[#0088CC] active:scale-[0.99] text-white text-[15px] font-bold px-5 py-3.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_6px_20px_rgba(0,158,227,0.35)]"
              >
                {mpLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Redirecionando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Pagar {formatBRL(totalOriginalCents)} no Mercado Pago
                  </>
                )}
              </button>
            </div>
          )}

          {showBrick && (
            <button
              type="button"
              onClick={handleMercadoPagoRedirect}
              disabled={mpLoading || contactInvalid}
              className="w-full text-center text-[12.5px] font-semibold text-slate-400 hover:text-[#009EE3] hover:underline transition"
            >
              Prefere pagar no site do Mercado Pago?
            </button>
          )}
        </>
      )}

      {whatsappLink && !cardPaid && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[#2d3a4a] text-[14px] font-semibold px-4 py-3 transition"
        >
          💬 Falar no WhatsApp
        </a>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcf9f5]">
      <header className="bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-3">
          <Link
            href={`/catalogo/${slug}`}
            className="inline-flex items-center gap-1.5 text-[13.5px] text-white/90 hover:text-white"
          >
            ← Voltar ao catálogo
          </Link>
          <Link href={`/${slug}`} className="text-[13px] text-white/70 hover:text-white">
            Ver site
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <article className="grid grid-cols-1 md:grid-cols-2 gap-0 bg-white rounded-[20px] border border-[#e2e8e0] shadow-[0_8px_32px_rgba(13,51,32,0.08)] overflow-hidden">
          {/* Coluna do produto */}
          <div className="flex flex-col">
            <div className="relative aspect-[4/3] bg-gradient-to-br from-[#eaf6ec] to-[#f5f7f4]">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-7xl text-[#1d5c3a]/25 select-none">
                  📦
                </div>
              )}
            </div>
            <div className="p-6 sm:p-7">
              {product.category && (
                <span className="inline-flex items-center rounded-full bg-[#eaf6ec] border border-emerald-200 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-800">
                  {product.category}
                </span>
              )}
              <h1
                className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-[#0d3320] mt-2.5 leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {product.name}
              </h1>
              {product.description && (
                <p className="text-[14.5px] leading-6 text-[#4a5a52] mt-3 whitespace-pre-line">
                  {product.description}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Compra protegida
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-emerald-600" /> Pagamento seguro
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-emerald-600" /> Vendido por {profileName}
                </span>
              </div>
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5b] active:scale-[0.99] text-white text-[15px] font-bold px-5 py-3 transition"
                >
                  <span>💬</span>
                  <span>Chamar no WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {/* Coluna do checkout transparente */}
          <div className="border-t md:border-t-0 md:border-l border-[#e2e8e0] bg-gradient-to-b from-white to-[#f8faf8] p-6 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-extrabold text-[#0d3320]">Finalizar compra</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <Lock className="h-3 w-3" /> Sem sair do site
              </span>
            </div>

            {availableTabs.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">
                Nenhuma forma de pagamento ativa no momento. Fale no WhatsApp. 💬
              </p>
            ) : (
              <>
                <div
                  className="grid gap-1 mb-5 bg-slate-100 rounded-2xl p-1"
                  style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0,1fr))` }}
                  role="tablist"
                >
                  {availableTabs.map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                        activeTab === tab
                          ? "bg-white text-[#1d5c3a] shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {tab === "pix" ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                      <span>{tab === "pix" ? "PIX" : "Cartão"}</span>
                      {tab === "pix" && hasPixDiscount && (
                        <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white leading-none">
                          -{settings.pix_discount_percent}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {activeTab === "pix" && pixPane}
                {activeTab === "mercadopago" && cardPane}
              </>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pagamento processado pelo Mercado Pago ∙ Seus dados estão protegidos
            </p>
          </div>
        </article>

        <div className="mt-6 text-center text-[12px] text-[#8a9a8e]">
          Catálogo de <b className="text-[#0d3320]">{profileName}</b> ·{" "}
          <Link href={`/catalogo/${slug}`} className="text-[#1d5c3a] hover:underline">
            Ver mais produtos
          </Link>
        </div>
      </main>
    </div>
  );
}
