
UPDATE public.whatsapp_config 
SET phone_number_id = '992797227256785',
    updated_at = now()
WHERE id = (SELECT id FROM public.whatsapp_config LIMIT 1);
