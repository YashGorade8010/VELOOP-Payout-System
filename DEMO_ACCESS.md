# Demo access

Use this document to record deployment URLs after the services are configured. Do not publish admin passwords, database credentials, API keys, or other secrets. Provision demo credentials through environment variables on the development API host and share them only through an approved private channel.

- Local frontend: http://localhost:5173
- Live frontend URL: pending deployment
- Local backend API: http://localhost:4000
- Local backend health: http://localhost:4000/api/health
- Live backend API URL: pending deployment
- Live backend health URL: pending deployment (`/api/health`)
- Admin login: http://localhost:5173/admin/login
- GitHub repository URL: pending repository setup
- Demo admin email: provision through `ADMIN_SEED_EMAIL` on the development backend
- Demo admin password: provision through `ADMIN_SEED_PASSWORD`; do not store it in this repository
- Demo user: optional; provision through `USER_SEED_EMAIL` and `USER_SEED_PASSWORD`
- Reward denominations and required VEs: not seeded; configure only approved values before enabling payout methods.

## Reset demo data

For local development only, clear the dedicated development database `veloop_payout`, set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD`, then run `npm --prefix backend run seed:demo` from the repository root. Set `USER_SEED_EMAIL`, `USER_SEED_PASSWORD`, and optionally `DEMO_STARTING_VES` only when a demo user is required. Never run the seed against production data.
