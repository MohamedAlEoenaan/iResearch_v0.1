# iResearch V0.1

For Replit publishing, import this repository and give Replit Agent [REPLIT_PROMPT.txt](REPLIT_PROMPT.txt). Full deployment instructions are in [REPLIT_HANDOFF.md](REPLIT_HANDOFF.md). Publishing has not yet been performed.

English research-services application using Next.js App Router, React, strict TypeScript, PostgreSQL, Prisma, Tailwind, Radix/shadcn-style primitives, React Hook Form and Zod. Official logo/colors and the 24-entry English catalog come from iresearch.com.sa. Website prices are preserved exactly and include VAT, as confirmed by the owner.

This is an incremental implementation of the complete MVP. **It is not a finished production release.** Email, payment checkout, private file storage and malware scanning are intentionally disabled by the owner. There is no simulated successful payment, email delivery or file upload. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [OPEN_DECISIONS.md](OPEN_DECISIONS.md) and [VALIDATION.md](VALIDATION.md).

## Local development

Requirements: Node.js 24, npm, Docker with Compose v2. The task already has an isolated checkout; use it directly, without creating a worktree.

```bash
cd /workspace/iResearch_v0.1
npm ci
npm run env:init
# .env and .env.test are ignored; existing files are preserved.
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run catalog:import -- catalog/website.en.json
npm run dev
```

You can repeat the complete local setup with `bash scripts/setup-local.sh`. Development uses Next.js’s supported Webpack mode for reliable local refresh; production uses the standard Next.js build.

Use the application on local port 3000. `APP_ORIGIN` must exactly match the browser origin; mutation requests from other origins are rejected. `GET /api/health` checks PostgreSQL, not just the web process. After schema/client regeneration, restart the development server so its cached Prisma client uses the new schema.

`env:init` generates a random local PostgreSQL password and a unique iron-session secret. It never replaces an existing `.env`; it adds a missing local session secret. Do not use these development helpers to provision production. When supplying your own database settings, make `DATABASE_URL`, Compose `POSTGRES_PASSWORD` and the actual database agree. Never commit `.env`, seed credentials, or real integration secrets.

The development seed creates explicitly named, verified **local development identities**, not verified production customers. The generated passwords are in ignored `.local/seed-credentials.json`, mode 0600; they are not hardcoded or printed. Accounts: `super-admin@iresearch.test`, `admin@iresearch.test`, `am@iresearch.test`, `researcher@iresearch.test`, `qa@iresearch.test`, `marketing@iresearch.test`, `client@iresearch.test`, `org-admin@iresearch.test`, `member@iresearch.test`. Existing accounts/passwords are preserved on rerun. Never run the development seed against a production database; it refuses `NODE_ENV=production`.

New public registrations are **unverified** and cannot sign in while email delivery is disabled. An organization also requires registration approval. Approval grants workspace access and explicitly appoints the registering contact as initial organization administrator; service activation is a separate action. Additional users join by invitation only. Invitations and reset/verification requests are recorded as blocked outbox entries, and no delivery is claimed.

## Docker application

```bash
npm run env:init
# Build app, start DB, apply migrations, then start the production-mode app.
docker compose up --build -d
# Seed/import via host commands above (development database only).
curl --fail http://localhost:3000/api/health
```

Do not run the host development server on port 3000 at the same time as the Docker app. Live processes do not survive an environment snapshot; restart the DB and the chosen app mode in future tasks. Compose retains the database in the `postgres-data` volume. Do not use `docker compose down -v` unless intentionally deleting local database data.

The Dockerfile supports an optional `corporate_ca` build secret for a managed network proxy. Keep TLS verification enabled. In this cloud machine the Docker client config directory must be writable, the configured proxy must be retained, and the platform CA must be provided as that build secret. Do not copy a CA or proxy credential into the source/image or disable npm/Prisma/TLS verification. Use `python scripts/cloud-docker-build.py` in this managed cloud machine; it uses only proxy routing and a temporary CA build-secret mount, preserves verification, and cleans up temporary configuration.

Production-mode cookies are sealed with iron-session, HttpOnly, Secure and `__Host-` prefixed. Deploy behind HTTPS with an accurate `APP_ORIGIN` and unique `SESSION_SECRET`; choose a managed DB and approved hosting/residency before any production deployment. No deployment has been performed.

## Validation

```bash
npm run db:validate
npm run db:status
npm run db:drift
npm run lint
npm run typecheck
npm test
# Separate test DB, never the development or production database:
docker compose exec -T db createdb -U iresearch iresearch_test
DOTENV_CONFIG_PATH=.env.test npm run db:migrate
npm run test:integration
# Uses /usr/bin/chromium when installed; otherwise install Chromium:
npx playwright install chromium
npm run test:e2e
npm run build
```

If `iresearch_test` already exists, skip `createdb`. Integration configuration refuses a database whose name does not end in `_test`. Integration fixtures use unique IDs and do not truncate/reset a database. Browser tests use generated development accounts, reset only their login rate-limit counters so the suite can be repeated, and create identifiable E2E requests in the local development database. Do not point browser tests at production. UI tests reach researcher assignment, then explicitly verify that file upload is disabled. QA/delivery/acceptance are tested at service level using document metadata fixtures; these do not prove actual file services work.

`npm run worker` reports blocked email outbox records; it does not send mail or mark records as sent. A real retrying email worker remains pending provider configuration. Public payment webhook POSTs return 503 without accepting events. File downloads authorize the current actor and request/document visibility before returning an explicit 503; no signed URL is manufactured.

## Architecture and security boundaries

- `src/server/auth.ts`: Argon2id passwords, iron-session-sealed opaque sessions, hashed DB tokens, fresh database permissions, single-use verification/reset redemption, rate limits.
- `src/server/organizations.ts`: registration review, activation, administrator/member control and invitation policies.
- `src/server/requests.ts`: scoped queries and explicit transactionally locked/versioned transitions, approvals, AM leases, assignments, QA/client review, cancellation and access grants.
- `src/server/events.ts`: audit + in-app notification + blocked email outbox in the same transaction.
- `src/server/integrations.ts`: provider contracts and explicit unavailable states; no active provider implementation.
- `src/app/api/actions/route.ts`: validated JSON mutation boundary with exact-origin CSRF defense. Public registration ignores browser role/tenant fields.
- `prisma/migrations`: account/tenant constraints, owner integrity, payment/approval submission gates, immutable snapshots and append-only audit triggers, foreign keys/indexes and case-insensitive email uniqueness.

Organization and request advisory locks serialize concurrent approvals, service activation and membership/ownership changes. AM lease token and request version are checked on the server. Client status labels hide internal QA/assignment details. Researchers cannot contact clients directly; QA cannot edit deliverables; only the current request owner accepts/revises. Marketing cannot access client requests or research files. There is no B2B per-request payment, automatic AM assignment, automatic client acceptance, SLA/VIP system or contract/billing module.

For production use a restricted runtime DB role separate from the migration/backup owner, operator-controlled provisioning, trusted-proxy edge rate limiting and request-size limits, nonce-based production CSP hardening, monitoring and tested backups. Audit triggers prevent application DML changes; a database owner remains a privileged operator. These release tasks remain visible in the implementation plan.

The ignored development database snapshot `.local/onboarding-db.dump` was restored and verified locally. Saved cloud startup instructions explain how to restore it only when a future local database is confirmed empty. This is separate from environment publication and is not a production backup service.
