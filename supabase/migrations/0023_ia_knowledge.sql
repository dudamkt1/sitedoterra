-- ============================================================================
-- EXPANDE A SEÇÃO "ESPECIALISTA IA doTERRA" (about):
-- adiciona mais sugestões rápidas (chips) voltadas aos óleos doTERRA.
-- O treinamento personalizado (knowledge) é preenchido por cada consultor
-- no painel e não entra aqui.
-- ============================================================================

update public.site_sections
set content = content
  || jsonb_build_object(
       'chips', '[
         {"emoji": "😴", "label": "Ansiedade e sono"},
         {"emoji": "🤕", "label": "Dor de cabeça"},
         {"emoji": "🛡️", "label": "Imunidade"},
         {"emoji": "⚡", "label": "Energia e foco"},
         {"emoji": "🤢", "label": "Digestão"},
         {"emoji": "💪", "label": "Dores musculares"}
       ]'::jsonb
     )
where type = 'about' and key = 'about';
