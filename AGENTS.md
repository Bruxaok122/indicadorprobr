# AGENTS.md

- Every dispatch-loop call to `send-bulk-template` must send its `dispatchId`; the function refuses to send unless that `active_dispatches` row exists and is not paused/cancelled/finished. Why: browser tabs running stale code kept sending after a dispatch was cancelled.
- `send-bulk-template` rejects variable mappings that reference removed fields (e.g. `valor_fatura`). Why: it is the fingerprint of stale tabs still running old dispatches.
