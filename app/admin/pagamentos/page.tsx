import AdminPaymentConfig from "@/components/admin/AdminPaymentConfig";

export const dynamic = "force-dynamic";

export default function AdminPagamentosPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Pagamentos — Gateway
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Escolha o gateway (Stripe ou Mercado Pago), configure as chaves e a política de
        cobrança. O que estiver ativo aqui passa a ser usado automaticamente em toda a
        plataforma: checkout de ativação, mensalidade, cancelamento e webhooks.
      </p>
      <AdminPaymentConfig />
    </div>
  );
}
