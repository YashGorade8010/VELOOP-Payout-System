# Manual verification checklist

This document lists acceptance scenarios; no automated tests have yet been added or run.

## User flows

- Current development database check: `GET /api/payout/config` returned empty `methods` and `options` arrays; the per-method options endpoints returned 404 because no methods are active. Actual denomination and VE-cost checks therefore remain blocked until approved records are configured.
- Register and sign in; ensure the wallet balance comes from the API.
- For an authenticated user, verify each configured reward card's eligibility, shortfall, and remaining balance against `POST /api/redemptions/quote`; the browser must not submit its own balance or VE cost.
- Open each exact `/Payout?method=...` URL and verify the correct method is selected.
- Try an unsupported method and confirm the page falls back safely.
- Configure an inactive method/option and confirm it is unavailable to users and rejected by the API.
- Request a quote with a valid reward ID; send fake `requiredVEs`, `userId`, and balance fields and confirm they are rejected.
- Send a create request containing client-supplied `userId`, `status`, `rewardAmount`, or `requiredVEs`; confirm strict validation rejects it and no wallet or ledger record changes.
- Verify UPI and email field validation, then confirm the server validates again.
- Submit a valid request and confirm the persisted reference, pending status, wallet debit, ledger transaction, and user history agree.
- Replay the same idempotency key with identical input and verify no second request/debit is created; reuse it with changed input and expect `409 IDEMPOTENCY_KEY_REUSED`. Concurrently submit requests whose combined cost exceeds the wallet and confirm only one debit succeeds and the wallet never becomes negative.
- Attempt to read another user's reference and confirm a 404.

## Admin flows

- Attempt admin endpoints without a token and as a normal user; expect 401/403.
- Filter requests by method, status, reference/user ID/name/email, date range, and sort order; verify page totals and previous/next navigation against the API response.
- Filter dashboard totals by date range and verify payout values remain separated by currency.
- Open a user detail view and verify it contains only that user's safe request and ledger history; suspend and restore access with a reason, then verify sessions are revoked and audit events exist.
- Exercise the `APPROVED -> FAILED` status transition and verify its one-time reversal and audit entry.
- Change a reward option, reload the user page, and verify the new API value appears.
- Try invalid reward amounts and invalid status transitions; ensure they are rejected.
- Reject a pending request with a reason and verify the one-time reversal and audit entry.
- Retry a processed transition and confirm no extra ledger row is created.
- Review responsive layout at widths 320, 768, 1280, 1440, and 1920 pixels.

The Postman collection includes invalid-destination checks, duplicate-idempotency replay, Amazon and Google Play request templates, insufficient-balance, admin search/detail, and a guarded reward-option update. Run the environment-dependent cases only after adding approved active reward IDs and business-approved denomination/VE values; the collection deliberately does not provide fake values. Concurrency and refund-idempotency still require manual or automated database-backed verification. Capture screenshots and record actual results before submission. A demonstration video has not yet been created. No automated test suite is currently included.
