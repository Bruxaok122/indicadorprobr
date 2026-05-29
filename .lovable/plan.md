## Objetivo

Permitir que operadores autorizados repliquem, com um clique, o **último disparo feito pelo admin** — mesmo template, mesma lista, mesma quantidade, mesmo modo (lote/turbo/smart) e mesmas variáveis. Você dispara uma vez como admin e o operador continua daí.

## Como vai funcionar

### 1. Nova permissão por usuário
- Novo campo `can_replay_admin_dispatch` em `profiles` (booleano, default `false`).
- Toggle na linha do usuário em **Admin → Usuários** (igual aos toggles `can_dispatch` / `can_manage_numbers`).
- Só usuários com esse toggle ligado verão o botão.

### 2. Snapshot do último disparo do admin
Nova tabela `last_admin_dispatch` (singleton — só guarda o disparo admin mais recente):
- `template_name`, `template_language`
- `list_name` (a mesma lista usada)
- `total` (quantidade-alvo)
- `mode` (`batch` / `turbo` / `smart` / `individual`)
- `phone_number_id` (número WABA usado)
- `variable_mappings` (jsonb — mapeamento {{1}}, {{2}}, etc.)
- `filters` (jsonb — filtros aplicados: renda mínima, verified-name, etc.)
- `created_at`, `created_by_admin_id`

Toda vez que o admin conclui (ou inicia) um disparo via `AdminDisparosPage`, a config é **upsertada** nessa tabela (substitui o anterior).

### 3. Botão no operador
Na página **OperatorDisparosPage**, no topo:
- Card destacado "🔁 Repetir último disparo do admin"
- Mostra resumo: template, lista, quantidade, modo, data do disparo admin
- Botão **"Disparar agora com minhas credenciais"**
- Confirmação simples antes de executar
- Ao clicar: monta o payload com os dados do snapshot + `operator_id = auth.uid()` e chama a mesma edge function `send-bulk-template` que o wizard já usa
- Mostra o `DispatchCountdown` normal (mesma UX dos outros disparos do operador)

### 4. Regras de segurança
- Card/botão renderizam apenas se `profile.can_replay_admin_dispatch === true` **e** existir snapshot
- RLS na tabela: SELECT para autenticados com a permissão; INSERT/UPDATE só admin
- O disparo respeita os limites normais do operador (anti-ban, janela 24h, créditos)

## Arquivos afetados

**Backend / DB**
- Migration: cria `last_admin_dispatch` + coluna `can_replay_admin_dispatch` em `profiles` + RLS + GRANTs

**Admin**
- `useAdmin.ts` — nova action `toggleReplayPermission`
- `UsersTable.tsx` + `UserCard.tsx` — coluna/toggle "Repetir disparo admin"
- `AdminDisparosPage.tsx` (ou hook de disparo admin) — após confirmar disparo, gravar snapshot em `last_admin_dispatch`

**Operador**
- `OperatorDisparosPage.tsx` — novo componente `ReplayAdminDispatchCard` no topo
- Novo arquivo `src/components/dispatch/ReplayAdminDispatchCard.tsx` — card + botão + lógica de chamada à edge function

**Sem mudanças** em: webhook, ai-agent, lógica de mensagens, ChatContactList, etc.

## Confirmações antes de implementar

1. O "último disparo do admin" deve ser **sempre o mais recente** (substitui o anterior), correto? Ou você quer manter um histórico dos últimos N para o operador escolher?
2. O operador deve poder repetir **quantas vezes quiser** o mesmo snapshot, ou só **uma vez** por snapshot (até o admin disparar de novo)?
