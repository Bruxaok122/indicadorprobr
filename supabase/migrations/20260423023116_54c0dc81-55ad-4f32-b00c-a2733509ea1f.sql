-- Liberar o contato "Lb" para o pool compartilhado para visualização
UPDATE public.contacts
SET claimed_by = NULL,
    claimed_at = NULL,
    user_id = NULL,
    dispatch_mode = 'shared'
WHERE id = 'd5c231d7-a644-42a7-beb0-61e0dccbda5f';

-- Limpar dispensas anteriores deste contato para que volte a aparecer
DELETE FROM public.contact_dismissals
WHERE contact_id = 'd5c231d7-a644-42a7-beb0-61e0dccbda5f';