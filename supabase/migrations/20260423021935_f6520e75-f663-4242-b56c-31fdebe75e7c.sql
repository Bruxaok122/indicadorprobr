
-- Tabela para registrar dispensas de contatos compartilhados por operador
CREATE TABLE IF NOT EXISTS public.contact_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (contact_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_dismissals_contact ON public.contact_dismissals(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_dismissals_user ON public.contact_dismissals(user_id);

ALTER TABLE public.contact_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
ON public.contact_dismissals FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own dismissals"
ON public.contact_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dismissals"
ON public.contact_dismissals FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Função: bloqueia o contato (status='encerrado') quando todos os operadores
-- elegíveis (não admins, não bloqueados) dispensarem o contato compartilhado.
CREATE OR REPLACE FUNCTION public.check_all_operators_dismissed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_operators int;
  total_dismissals int;
  c_dispatch_mode text;
  c_claimed_by uuid;
BEGIN
  SELECT dispatch_mode, claimed_by INTO c_dispatch_mode, c_claimed_by
  FROM public.contacts WHERE id = NEW.contact_id;

  -- Só aplica para contatos shared não reivindicados
  IF c_dispatch_mode <> 'shared' OR c_claimed_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO total_operators
  FROM public.profiles p
  WHERE COALESCE(p.is_blocked, false) = false
    AND NOT public.is_admin(p.user_id);

  SELECT COUNT(*) INTO total_dismissals
  FROM public.contact_dismissals d
  JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.contact_id = NEW.contact_id
    AND COALESCE(p.is_blocked, false) = false
    AND NOT public.is_admin(p.user_id);

  IF total_operators > 0 AND total_dismissals >= total_operators THEN
    UPDATE public.contacts
    SET status = 'encerrado'
    WHERE id = NEW.contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_all_operators_dismissed ON public.contact_dismissals;
CREATE TRIGGER trg_check_all_operators_dismissed
AFTER INSERT ON public.contact_dismissals
FOR EACH ROW
EXECUTE FUNCTION public.check_all_operators_dismissed();
