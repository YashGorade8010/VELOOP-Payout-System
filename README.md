# VELOOP Rewards Payout System

A full-stack payout and redemption application for UPI cash, Amazon gift cards, and Google Play gift cards. The React client is served separately from an Express API backed by MongoDB. Wallet balances, eligibility, reward configuration, redemption state, and ledger entries are owned by the API.

> **Configuration pending verification:** the assignment requires denominations and VE costs to match the existing production payout pages. Those values could not be verified from the linked pages during development. Configure approved values through the admin tools before enabling a method; do not enter guessed amounts.

## Current implementation

- Payout routes for UPI, Amazon, and Google Play with backend-managed methods and reward options.
- User registration/login, wallet lookup, eligibility quote, destination validation, review/confirm, and redemption history.
- MongoDB-backed wallets, reward snapshots, ledger entries, status lifecycle, admin sessions, idempotency, and atomic debit/reversal handling.
- Protected admin dashboard with date filters, searchable/paginated redemption requests, request details, payout method and reward configuration, user history/access controls, and audit/ledger views.
- Authenticated dark wallet dashboard using live balance, completed withdrawal totals, configured payment methods, and redemption history APIs.
- Responsive layouts, Vercel SPA routing, Render service configuration, Postman collection, and technical documentation.

Before this can be submitted, add verified VELOOP reward values, confirm the accounting/refund policy, deploy the API/frontend, and complete evaluator evidence. A local demo admin is provisioned and documented in `DEMO_ACCESS.md`. User search, protected destination review, user payout-access controls, request history, account-level admin login lockout, and filtered ledger/audit APIs are implemented. Real payment-provider fulfillment and a secure production cookie session are not included in this demo.

## Technology

- React, Vite, React Router, Bootstrap, CSS Modules
- Node.js, Express, Mongoose, MongoDB Atlas
- JWT authentication, bcrypt password hashing, Zod request validation
- Rate limiting, Helmet, strict CORS, idempotency keys, MongoDB transactions
- Vercel (frontend) and Render or Railway (API)

## Repository layout

```text
frontend/
  src/
    components/       Shared UI components
    pages/
      Payout/         Payout and reward selection
      Authentication/ Sign in, registration, and password recovery
      RedemptionHistory/ User redemption history
      WalletDashboard/  Authenticated wallet overview and activity
      Admin/          Admin workspace
    services/         API client
    constants/        Payout method metadata
    utils/            Currency and display helpers
    assets/           Images and static assets
    App.jsx           Application shell and workflow state
backend/
  src/
    config/           Database connection
    middleware/       Authentication and request guards
    models/           MongoDB schemas
    routes/           Auth, payout, redemption, and admin endpoints
    services/         Session, email, and audit services
    validators/       Request validation
    utils/            Shared API helpers
docs/                 API, database, security, admin, and testing guides
postman/              API collection for evaluator workflows
```

## Development setup

Requirements: Node.js 20+, MongoDB replica set (Atlas is recommended; transactions require a replica set), and separate frontend/backend environment files based on `.env.example`.

```sh
npm install --prefix frontend
npm install --prefix backend
npm --prefix frontend run dev
```

In a second terminal, run `npm --prefix backend run dev`. Configure `backend/.env` first. Never commit `.env` files. Provision the demo administrator with `npm --prefix backend run seed:demo`; the seed reads credentials from environment variables and does not store a plaintext password.

## Environment configuration

See `frontend/.env.example` and `backend/.env.example`. Keep MongoDB credentials and JWT secrets on the API host only. The browser receives only `VITE_API_URL` and must never receive administrator credentials or database secrets.

## Accounting and safety rules

- A redemption request is priced from the active MongoDB reward option on the server. Client balances, costs, status values, and user IDs are ignored.
- The API checks the authenticated owner and current wallet inside a MongoDB transaction, records the debit and redemption snapshot, and uses a unique idempotency key to prevent retry duplicates.
- Requests begin in `PENDING`. Only authorized admin transitions are accepted and recorded with actor, timestamp, reason, and audit entry.
- VEs are deducted at submission in the demo accounting model. Rejection returns them exactly once through a separate reversal ledger entry. This model must be confirmed against approved VELoop operations before production use.
- Destination details are not returned by list endpoints and are masked in admin tables.

## User workflow

Sign in → open `/Payout?method=upi`, `/Payout?method=amazon`, or `/Payout?method=googlePlay` → fetch wallet and active options → request a quote → enter destination → review → confirm → receive a server-generated reference → track status in history.

## Admin workflow

Sign in at `/admin/login` → review live dashboard and requests → inspect a request → approve, reject with a reason, or advance its status → manage methods and reward options. Every API route enforces admin authorization, and changes are audited.

## Deployment

1. Create a MongoDB Atlas database configured for transactions.
2. Deploy `backend/` to Render/Railway with production environment variables and a restricted `CLIENT_ORIGIN`.
3. Deploy `frontend/` to Vercel (set the project root directory to `frontend`) with `VITE_API_URL` pointing to the API.
4. Seed the demo admin on the API host through the documented one-time command; never commit credentials.
5. Verify live sign-in, quote, redemption, ledger, history, admin status changes, and config updates before submission.

Live URLs and demo access must be added after deployment in `DEMO_ACCESS.md`. The project is not submission-ready until a real API/database deployment, approved reward values, and evaluator evidence are configured.

## Required documentation

- [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- [DATABASE.md](docs/DATABASE.md)
- [SECURITY.md](docs/SECURITY.md)
- [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)
- [TESTING.md](docs/TESTING.md)
- [DEMO_ACCESS.md](DEMO_ACCESS.md)

## License

Educational assignment project. Confirm rights to use any VELoop Rewards brand assets before public release.
