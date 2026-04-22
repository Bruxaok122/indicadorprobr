-- 1. Adicionar campos em contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS dispatch_mode text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS claimed_by uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_contacts_dispatch_mode ON public.contacts(dispatch_mode);
CREATE INDEX IF NOT EXISTS idx_contacts_claimed_by ON public.contacts(claimed_by);

-- 2. Função auxiliar: pode escrever no contato?
-- Regra: admin sempre pode; dono direto pode; em modo shared, só o claimer pode escrever
CREATE OR REPLACE FUNCTION public.can_write_contact(_contact_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = _contact_id
        AND (
          (c.dispatch_mode = 'private' AND c.user_id = _user_id)
          OR (c.dispatch_mode = 'shared' AND c.claimed_by = _user_id)
        )
    );
$$;

-- Função auxiliar: pode visualizar contato (leitura)?
-- Em shared não-claimed: todos operadores autenticados podem ver
CREATE OR REPLACE FUNCTION public.can_view_contact(_contact_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = _contact_id
        AND (
          c.user_id = _user_id
          OR c.user_id IS NULL
          OR (c.dispatch_mode = 'shared' AND (c.claimed_by IS NULL OR c.claimed_by = _user_id))
        )
    );
$$;

-- 3. Atualizar RLS de contacts (SELECT) para incluir shared não-claimed
DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts;
CREATE POLICY "Users can view contacts"
ON public.contacts FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id IS NULL
  OR is_admin(auth.uid())
  OR (dispatch_mode = 'shared' AND (claimed_by IS NULL OR claimed_by = auth.uid()))
);

-- UPDATE de contacts: permitir claim em shared não-claimed (apenas se cliente já respondeu ao template)
DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
CREATE POLICY "Users can update contacts"
ON public.contacts FOR UPDATE
USING (
  auth.uid() = user_id
  OR user_id IS NULL
  OR is_admin(auth.uid())
  OR (dispatch_mode = 'shared' AND (claimed_by IS NULL OR claimed_by = auth.uid()))
);

-- 4. Atualizar RLS de messages: leitura para shared não-claimed; escrita só para claimer/dono/admin
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages"
ON public.messages FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id IS NULL
  OR is_admin(auth.uid())
  OR public.can_view_contact(contact_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
ON public.messages FOR INSERT
WITH CHECK (
  is_admin(auth.uid())
  OR (auth.uid() = user_id AND public.can_write_contact(contact_id, auth.uid()))
);

-- 5. Atualizar RLS de conversations
DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
CREATE POLICY "Users can view conversations"
ON public.conversations FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id IS NULL
  OR is_admin(auth.uid())
  OR public.can_view_contact(contact_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations"
ON public.conversations FOR UPDATE
USING (
  auth.uid() = user_id
  OR user_id IS NULL
  OR is_admin(auth.uid())
  OR public.can_write_contact(contact_id, auth.uid())
);