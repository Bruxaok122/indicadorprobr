
UPDATE public.api_configs 
SET is_validated = true,
    status_message = '✅ API conectada e operacional',
    name = 'PRINCIPAL',
    updated_at = now()
WHERE id = '92c315a8-20dc-44fb-b9f4-65aacdc33693';
