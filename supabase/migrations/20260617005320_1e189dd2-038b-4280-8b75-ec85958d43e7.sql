UPDATE public.waba_phone_numbers wpn
SET api_config_id = ac.id
FROM public.api_configs ac
WHERE wpn.phone_number_id = ac.phone_number_id
  AND wpn.api_config_id IS NULL;