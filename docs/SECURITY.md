# Security notes

- User and admin passwords are bcrypt hashes. The demo seed reads credentials only from environment variables.
- JWTs expire; protected endpoints verify signature, expiry, role, and user ownership. An email or role in a request body does not grant access.
- The frontend stores the short-lived demo JWT in `sessionStorage`. A hardened production deployment should move to an `HttpOnly`, `Secure`, `SameSite` cookie session and add CSRF protection.
- Login routes are rate limited; admin sign-in also locks a known admin account for 15 minutes after eight failed attempts. Passwords, JWTs, and payout destination details are never logged.
- Password reset links contain a cryptographically random, single-use token. Only its SHA-256 hash is stored, links expire after 30 minutes, and a successful reset revokes active user sessions. The forgot-password response does not reveal whether an email is registered.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` to deliver reset emails. In local development without SMTP, the reset link is printed to the backend console; never enable this fallback in production.
- Helmet sets standard response headers. In development, CORS accepts localhost and 127.0.0.1 origins on any port so Vite can use its next free port. Production accepts only the explicit `CLIENT_ORIGIN` entries; do not set a wildcard.
- Zod schemas reject unexpected fields and validate destination, amount bounds, method, and allowed state transitions.
- Redemption debits and ledger/request creation run within a MongoDB transaction. Conditional balance updates prevent a negative wallet under concurrent submissions.
- A unique idempotency key prevents a retry from creating a second debit. Unique references prevent reference collisions.
- User history queries scope by the authenticated user ID. Admin list results omit destination details; the authenticated admin detail endpoint reveals them only for review and does not log them.
- Admin mutations require the admin role and create audit events. A production deployment should add account lockout, stronger session revocation, MFA, and key rotation.
- Admin payout-access suspension requires a reason, writes an audit event, and revokes all active user sessions. Restoring access is also audited.
- Configure HTTPS at the deployment platform and keep all `.env` files out of Git.

## Known limitations

This is an assignment/demo implementation, not a production payout processor. It does not connect to UPI or gift-card fulfillment providers, verify a UPI ID, or send gift cards. A pending request represents a request for human/provider review only. Reward values and refund policy require business verification.
