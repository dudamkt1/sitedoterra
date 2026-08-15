-- Corrige modelos de IA descontinuados diretamente no banco (idempotente).
-- gemini-1.5-flash foi descontinuado pela Google (HTTP 404);
-- llama-3.3-70b-versatile / llama-3.1-8b-instant saem do ar em 16/08/2026;
-- os modelos :free antigos do OpenRouter foram removidos da plataforma.

UPDATE ai_providers
SET model = 'gemini-2.5-flash', updated_at = now()
WHERE code = 'google-gemini' AND model IN ('gemini-1.5-flash', 'gemini-1.5-pro');

UPDATE ai_providers
SET model = 'openai/gpt-oss-20b', updated_at = now()
WHERE code = 'groq' AND model IN ('llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'llama3-8b-8192');

UPDATE ai_providers
SET model = 'openrouter/free', updated_at = now()
WHERE code = 'openrouter' AND model IN ('meta-llama/llama-3.1-8b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-70b-instruct:free');