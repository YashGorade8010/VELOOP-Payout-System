# Admin guide

## Provisioning and sign-in

Set `ADMIN_SEED_EMAIL` and a development-only `ADMIN_SEED_PASSWORD` (at least 12 characters), then run `npm --prefix backend run seed:demo` from the repository root with a configured `MONGO_URI`. The seed does not print or commit the password. Sign in at `/admin/login`.

## Configure options safely

1. Verify each denomination, VE requirement, payout method, and policy against an approved source.
2. Create the reward option in the admin workspace; new options are inactive. You may provide a site-relative or HTTPS icon asset reference.
3. Review the stored values and activate the option only after confirmation.
4. Enable its payout method only when the method has an approved processing path.
5. Open the user page and confirm it displays the server configuration.

The backend re-reads current configuration during final submission, so an option that changed after a user opened the confirmation view must be quoted again.

## Review requests

Use request filters to search by reference, user ID, name/email, method, status, and date. Results are server-paginated and can be sorted newest/oldest. Open a request for its protected destination details, wallet transaction link, status history, and optional provider reference. Record a meaningful reason when changing status. Rejection/cancellation/failure returns deducted VEs through an audited reversal. Complete only requests that have actually been fulfilled; the current demo has no provider integration.

Use user lookup to open a user's wallet, safe redemption history, and ledger history. Suspending payout access requires a reason, creates an audit record, and revokes the user's active sessions. Restoring access is also audited.

Audit records and the wallet ledger are available through admin APIs. Never make direct database edits to historical transactions.
