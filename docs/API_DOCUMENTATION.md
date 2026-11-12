# API documentation

Base URL: `http://localhost:4000`. All successful responses are JSON. Errors use `{ "error": { "code": "...", "message": "..." } }`. Authenticated routes accept `Authorization: Bearer <JWT>`. Admin endpoints require a JWT issued to the admin role.

## Authentication and public configuration

| Method | Route                            | Auth                 | Purpose                                          |
| ------ | -------------------------------- | -------------------- | ------------------------------------------------ |
| GET    | `/api/health`                    | Public               | Liveness and Mongo connection status             |
| POST   | `/api/auth/register`             | Public               | Create user and zero-balance wallet              |
| POST   | `/api/auth/login`                | Public               | User login                                       |
| POST   | `/api/auth/forgot-password`      | Public, rate limited | Request a single-use password reset email        |
| POST   | `/api/auth/reset-password`       | Public, rate limited | Set a new password with a valid, unexpired token |
| POST   | `/api/auth/logout`               | User                 | Revoke current session                           |
| POST   | `/api/admin/auth/login`          | Public, rate limited | Admin login                                      |
| POST   | `/api/admin/auth/logout`         | Admin                | Revoke current admin session                     |
| GET    | `/api/payout/config`             | Public               | Method availability metadata and active reward options |
| GET    | `/api/payout/methods`            | Public               | Method availability and user-facing method metadata |
| GET    | `/api/payout/options?method=upi` | Public               | Active options for one method                    |

Registration accepts `name`, `email`, and `password` (10 to 100 characters). Login accepts `email` and `password`. Admin credentials are provisioned by `npm --prefix backend run seed:demo` from the repository root.

Forgot password accepts `{ "email": "user@example.com" }` and always returns a generic success message. Reset password accepts `{ "token": "...", "password": "at-least-10-characters" }`. Reset tokens expire after 30 minutes, are single use, and a successful reset revokes the user's active sessions. Configure SMTP environment variables to deliver email; local development prints a reset link in the backend console when SMTP is not configured.

## User endpoints

| Method | Route                           | Purpose                                                         |
| ------ | ------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/wallet`                   | Current user's available/reserved VEs and completed INR withdrawal total |
| POST   | `/api/redemptions/quote`        | Recalculate eligibility using the current reward and wallet     |
| POST   | `/api/redemptions`              | Revalidate and submit a redemption atomically                   |
| GET    | `/api/redemptions/my-history`   | Current user's latest 100 requests                              |
| GET    | `/api/redemptions/:referenceId` | One request owned by the current user                           |

Quote body: `{ "method": "upi", "rewardOptionId": "<Mongo id>" }`.

The authenticated quote response includes the current reward snapshot, `availableBalance`, `eligible`, `remainingBalance`, and `shortfall`. The payout UI uses this response for each reward card; final submission still rechecks the active method, option, and wallet balance inside the backend transaction. The quote is not a reservation, so a later balance or configuration change can make submission fail safely.

Create body: `{ "method": "upi", "rewardOptionId": "<Mongo id>", "destination": { "upiId": "name@bank" } }`. Amazon and Google Play use `{ "destination": { "email": "person@example.com" } }`. Include an `Idempotency-Key` header with 12 to 128 characters. Replaying that key with identical input returns the original result; using it with different input returns `409 IDEMPOTENCY_KEY_REUSED`. The API rejects extra body fields and independently validates current method, option, cost, balance, and destination. The client must not send `userId`, `requiredVEs`, `balanceAfter`, or `status`.

Successful reads return resource envelopes such as `{ "wallet": ... }` and `{ "redemptions": [...], "page": 1, "limit": 20, "total": 0 }`. Quotes return `200`; a newly created redemption returns `201` with the actual persisted status, reference, submission time, and updated wallet balance. Invalid request fields return `400`, missing/invalid authentication returns `401`, wrong role returns `403`, missing or unavailable resources return `404`, and insufficient balance, changed configuration, or invalid state transitions return `409`.

## Admin endpoints

| Method | Route                                                                          | Purpose                                                      |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| POST   | `/api/admin/auth/login`                                                        | Admin login                                                  |
| GET    | `/api/admin/dashboard?dateFrom=2026-01-01&dateTo=2026-01-31`                   | Live request, VE, payout-value and active configuration totals for an optional date range |
| GET    | `/api/admin/redemptions?page=1&limit=20&status=PENDING&method=upi&search=VLR-&dateFrom=2026-01-01&dateTo=2026-01-31&sort=newest` | Searchable, filtered, sorted and paginated request list; destination excluded |
| GET    | `/api/admin/redemptions/:id`                                                   | Authorized request detail, including destination             |
| PATCH  | `/api/admin/redemptions/:id/status`                                            | Validated transition plus required reason                    |
| GET    | `/api/admin/payout-methods`                                                    | Current method configuration                                 |
| PATCH  | `/api/admin/payout-methods/:id`                                                | Update method availability and display configuration         |
| GET    | `/api/admin/reward-options`                                                    | All configured reward options                                |
| POST   | `/api/admin/reward-options`                                                    | Add a disabled option                                        |
| PATCH  | `/api/admin/reward-options/:id`                                                | Update an option; client must send the full validated option |
| GET    | `/api/admin/users?search=name-or-email&page=1&limit=20`                        | Search users without returning password hashes               |
| GET    | `/api/admin/users/:id`                                                         | User wallet, safe request history and ledger history          |
| PATCH  | `/api/admin/users/:id/access`                                                  | Suspend or restore payout access with an audited reason        |
| GET    | `/api/admin/transactions?page=1&limit=30&dateFrom=2026-01-01&dateTo=2026-01-31&type=REDEMPTION_DEBIT&userId=<id>&referenceId=VLR-` | Filtered, paginated ledger view |
| GET    | `/api/admin/audit-logs?page=1&limit=50&dateFrom=2026-01-01&dateTo=2026-01-31&action=REDEMPTION_REJECTED&targetId=VLR-` | Filtered, paginated audit events |

Admin PATCH requests that change payout-method availability or reward-option availability/value must include a `reason` (3–500 characters). The API stores this reason with the audited change; the admin interface requires an explicit confirmation before submitting these changes.

Status body: `{ "status": "REJECTED", "reason": "..." }`. Completion may include `providerReference`. Rejection, cancellation, or failure writes a one-time VE reversal under the documented demo accounting model. Allowed transitions are `PENDING → UNDER_REVIEW | APPROVED | REJECTED | CANCELLED`, `UNDER_REVIEW → APPROVED | REJECTED | CANCELLED`, and `APPROVED → COMPLETED | FAILED`. Status meanings and refund behavior are documented in [DATABASE.md](DATABASE.md); confirm the demo reversal policy with VELOOP before production use.

## Status and errors

Typical status codes: `200` success, `201` created, `400` malformed or invalid input, `401` missing/expired auth, `403` wrong role, `404` unavailable resource, `409` insufficient balance/config changed/duplicate/invalid transition, `429` rate limited, `500` generic server failure. Internal database errors and stack traces are not sent to the client.

## Current API gaps

Request search supports reference IDs, user IDs, names, and emails. User detail history and audited payout-access suspension/restoration are available. Payout methods are a fixed, seeded set of three enum values; admins edit those records instead of creating arbitrary methods. There is no separate `/api/admin/settings` resource because payout availability and reward rules are persisted in the method and reward-option resources. Admin login is IP-rate-limited and locks a known admin account for 15 minutes after eight failed attempts. Provider fulfillment and a production session-cookie migration remain outside this demo implementation.
