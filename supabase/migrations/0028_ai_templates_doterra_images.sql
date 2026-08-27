-- 0028: fundos profissionais doTERRA nos templates — nunca só cor chapada
-- Atualiza o campo image.default de cada template para uma foto gratuita doTERRA (Unsplash, licença livre)
-- Mantém edição livre: usuário pode trocar por outra URL quando quiser

update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1608571423902-eed4a94d8108?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'produto-destaque';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'oleo-semana';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1470259078422-06e8c24ebf84?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'dica-rapida';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1598440947619-cc6db50d67f9?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'voce-sabia';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = '3-formas';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'frase-inspiradora';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1470259078422-06e8c24ebf84?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'post-educativo';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1608571423902-eed4a94d8108?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'chamada-contato';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1598440947619-cc6db50d67f9?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'novo-produto';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'oferta';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'depoimento';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'story-produto';
update public.ai_templates set structure = jsonb_set(structure, '{fields,8,default}', '"https://images.unsplash.com/photo-1446071103084-c257b5f70672?w=800&auto=format&fit=crop&q=80"'::jsonb) where code = 'carrossel-educativo';
