# AGENTS.md
- Administrative computer access uses protected RPCs and auth session IDs in separate tables; revoked sessions must never reactivate through heartbeat. Why: computer logout and persistent blocking must not affect operator device authorization.

- Every dispatch-loop call to `send-bulk-template` must send its `dispatchId`; the function refuses to send unless that `active_dispatches` row exists and is not paused/cancelled/finished. Why: browser tabs running stale code kept sending after a dispatch was cancelled.
- `send-bulk-template` rejects variable mappings that reference removed fields (e.g. `valor_fatura`). Why: it is the fingerprint of stale tabs still running old dispatches.
