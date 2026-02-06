-- Add CPF and valor_da_causa columns to contacts table
ALTER TABLE public.contacts ADD COLUMN cpf TEXT;
ALTER TABLE public.contacts ADD COLUMN valor_da_causa NUMERIC;