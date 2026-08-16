-- Corrige modelo do Google Gemini para a linha atual (idempotente).
-- A linha Gemini 2.x (2.5-flash, 2.0-flash, 2.5-pro, 1.5-*) foi retirada para
-- novas chaves pela Google (HTTP 404 "no longer available to new users").
-- O substituto estável atual com free tier é o gemini-3.5-flash.

UPDATE ai_providers
SET model = 'gemini-3.5-flash', updated_at = now()
WHERE code = 'google-gemini'
  AND model IN ('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro');