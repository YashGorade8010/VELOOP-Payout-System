# Database and wallet accounting

MongoDB collections are represented by Mongoose models in `backend/src/server.js`.

## Collections

- `User`: account profile, lowercase unique email, bcrypt password hash, active state.
- `AdminUser`: unique email, bcrypt hash, active state, `SUPER_ADMIN` role.
- `Wallet`: one per user, currency `VE`, available and reserved integer balances.
- `PayoutMethod`: unique method key, display metadata, availability, maintenance text, order.
- `RewardOption`: unique internal ID, method, display name, denomination/currency, required VE count, optional site-relative/HTTPS asset reference, active state and order.
- `RedemptionRequest`: owner, unique public reference, method, reward snapshot, required VE cost, private destination, status/history, wallet transaction link, idempotency key, and completion timestamp.
- `WalletTransaction`: immutable debit/reversal entry with balance before/after and request reference.
- `AuditLog`: actor, role, action, target, reason/change summary, timestamp.
- `IdempotencyRecord`: unique `(userId, key)`, request-body hash, and original response for identical retries.

## Indexes

Unique indexes: user/admin email, wallet user, method key, reward ID, redemption reference, `(userId, idempotencyKey)`, and `(userId, key)` idempotency record. Request status, request owner, `(method, status, createdAt)`, ledger owner/reference, and audit timestamp are indexed for common lookups.

## Accounting model

At submission, the API starts a MongoDB transaction, finds the active method and reward, conditionally decrements `availableBalance` only when it covers the current server-side reward cost, creates the pending request snapshot, appends one debit ledger entry, and records the idempotency response. If any operation fails, the transaction rolls back. The client never chooses the balance, price, or request owner. VE wallet balances, configured VE costs, and VE ledger amounts are integers bounded by JavaScript's safe-integer range; the amount currency is explicitly recorded as `VE`.

An idempotency key is scoped to the authenticated user. Replaying the same key with the same method, option, and normalized destination returns the original result without a second debit; reusing that key for different input is rejected.

VE is deducted when a request is submitted. If a request later becomes `REJECTED`, `CANCELLED`, or `FAILED`, a separate reversal ledger entry restores the same VE amount. A prior reversal check prevents a second refund. This demo policy must be confirmed with the business owner before real use; the source assignment explicitly says not to invent production refund behavior.

## Redemption status meanings

- `PENDING`: user submitted the request; the VE debit and ledger entry have committed, and the request awaits review.
- `UNDER_REVIEW`: an administrator has started review.
- `APPROVED`: an administrator authorized payout processing; this does not mean payment was delivered.
- `COMPLETED`: an administrator recorded successful fulfillment (a provider reference may be attached).
- `REJECTED`: the administrator declined the request; the demo accounting model reverses the debit once.
- `CANCELLED`: the administrator cancelled the request; the demo accounting model reverses the debit once.
- `FAILED`: processing failed after approval; the demo accounting model reverses the debit once.

Only the authenticated admin status endpoint can advance a request. Supported transitions are `PENDING → UNDER_REVIEW | APPROVED | REJECTED | CANCELLED`, `UNDER_REVIEW → APPROVED | REJECTED | CANCELLED`, and `APPROVED → COMPLETED | FAILED`. User request bodies cannot set status.

Use Atlas or another replica-set deployment. A standalone local MongoDB server cannot execute the multi-document transactions used by redemption creation.

## Historical records

Each request stores a reward snapshot, preserving the submitted denomination and VE cost if an administrator changes the current option. Ledger rows are append-only; corrections use a new reversal/adjustment entry rather than editing old accounting records.

The authenticated wallet response reports `totalWithdrawn` as the sum of INR denominations for completed requests only. Pending, rejected, cancelled, failed, and non-INR requests are excluded from this display total.
