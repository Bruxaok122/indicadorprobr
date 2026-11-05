# AGENTS.md
- Administrative computer access uses protected RPCs and auth session IDs in separate tables; revoked sessions must never reactivate through heartbeat. Why: computer logout and persistent blocking must not affect operator device authorization.
- Gestão is a standalone protected page; its inventory reads Auth sessions through a minimal admin-only RPC and polls without hiding idle sessions. Why: existing signed-in devices must appear without conflating presence with session validity.
- Gestão also reads deduplicated legacy administrative devices as history; hardware is best-effort browser metadata and location is coarse IP geolocation through an authenticated function using Auth's session IP, never client-provided IP or precise coordinates. Why: historical metadata may be absent and must not be fabricated; location lookups must not delay login or heartbeat.

- Every dispatch-loop call to `send-bulk-template` must send its `dispatchId`; the function refuses to send unless that `active_dispatches` row exists and is not paused/cancelled/finished. Why: browser tabs running stale code kept sending after a dispatch was cancelled.
- `send-bulk-template` rejects variable mappings that reference removed fields (e.g. `valor_fatura`). Why: it is the fingerprint of stale tabs still running old dispatches.
