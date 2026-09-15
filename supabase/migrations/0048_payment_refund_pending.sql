-- ============================================================================
-- Reembolso em duas etapas: "aguardando reembolso" -> "reembolsado"
-- ============================================================================
-- Quando o usuário pede reembolso da ativação dentro da garantia de 7 dias,
-- o pagamento vai imediatamente para `refund_pending` (STATUS "Aguardando
-- reembolso" no painel + pedido visível em /admin "Visão geral").
-- Assim que o dinheiro é devolvido via Mercado Pago (webhook `refunded`),
-- o pagamento vai para `refunded` (STATUS "Reembolsado") e o site é
-- desativado — dados e histórico preservados.
-- Vale para `payments` e `billing_history` (ambas usam o enum).
-- ============================================================================

alter type public.payment_status add value if not exists 'refund_pending';
