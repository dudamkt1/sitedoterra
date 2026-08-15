-- ============================================================================
-- CORREÇÃO IA — MODELO GEMINI DESCONTINUADO
-- ----------------------------------------------------------------------------
-- O modelo `gemini-1.5-flash` foi descontinuado pela Google (HTTP 404 na API
-- generativelanguage v1beta) e as ferramentas de IA pararam de funcionar.
-- O modelo atual gratuito e estável é `gemini-2.5-flash` (testado 200 OK).
-- Atualiza o provider e o fallback no código (lib/ai.ts).
-- Idempotente: pode ser re-executado sem erros.
-- ============================================================================

update public.ai_providers
set model = 'gemini-2.5-flash',
    free_tier = 'Plano gratuito (Free Tier) com cota generosa por dia.',
    limits = 'O plano gratuito do Gemini tem limite de requisições por dia (RPm/TPM). Para uso contínuo e intenso, verifique o plano pago (Pay-as-you-go). Não é necessário cartão para começar.',
    updated_at = now()
where code = 'google-gemini';