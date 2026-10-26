# Publish iResearch V0.1 on Replit for temporary review

Prepared 27 October 2026. This repository contains the actual application source from the cloud workspace. Import the updated `main` branch of `MohamedAlEoenaan/iResearch_v0.1` into Replit. A ZIP is not required. Replit deployment has **not** been performed or verified by Codex.

## Objective

Publish the existing application as a working temporary review site with HTTPS, PostgreSQL persistence and a private reviewer login. Adapt deployment configuration to Replit; do not rebuild the app, redesign the workflow, change the release to V2, or substitute a static demo. After publishing, verify the actual public URL and return it to the owner.

## Confirmed owner decisions

- Release **V0.1**, complete MVP delivered phase by phase; current milestone is incomplete.
- Next.js App Router, strict TypeScript, PostgreSQL, Prisma, Tailwind/shadcn-style UI.
- English interface; official logo/colors from iresearch.com.sa, already included locally.
- 24 official English catalog entries: 19 services and 5 packages. Preserve exact website prices, including unusual cents. **VAT included**, confirmed by the owner.
- Email, payments, private file storage and malware scanning remain explicitly **disabled**. Do not enable sandbox success adapters, accept payment webhooks, auto-verify public registrations, or fabricate uploaded files.
- Ask the owner about unresolved business choices. Do not invent contractual terms or claim Saudi compliance/data residency.

The uploaded original specification is preserved in `IRESEARCH_V2_CODEX_HANDOFF.md`; V2 is a source-document label, not the app version. Later owner decisions above override it. Read `IMPLEMENTATION_PLAN.md`, `OPEN_DECISIONS.md`, `VALIDATION.md` and `README.md` for scope/evidence.

## 1. Import the source

Import this GitHub repository into Replit with `package.json`, `src/`, `prisma/` and `catalog/` at the app root. Read `REPLIT_PROMPT.txt` for the Agent task. Keep all five migration folders, the lockfile, public brand assets and hidden starter/configuration files.

The repository excludes `.git`, `.env`, `.local`, credentials, database dumps, `node_modules`, `.next`, browser traces and other generated output. Create a fresh, separate review database and fresh secrets in Replit. Do not request or restore the Codex development database dump.

A starter `.replit` file is included. Its TOML syntax has been checked, but it has not been tested against Replit's current publishing product. Replit Agent must select the actual supported Node.js 24 module/runtime and confirm the current publishing settings. Do not invent module identifiers or claim this configuration is a verified one-click deployment.

## 2. Runtime and database

- **Node.js 24.x**, as pinned by `package.json` engines and `.nvmrc`.
- Use a server-capable Next.js deployment, not static hosting/export.
- Provision PostgreSQL using Replit's supported database capability. If unavailable, ask the owner for a supported PostgreSQL option. Do not replace it with SQLite or in-memory state.
- Preserve TLS certificate and Prisma artifact checksum verification. Install/provide OpenSSL if Prisma reports it missing; do not disable verification or use `rejectUnauthorized: false` to force a connection.
- The web process already binds `0.0.0.0`. Next.js honors `PORT`; absent that, it uses port 3000. Configure Replit's actual port mapping accordingly.
- Do not run Docker Compose or `scripts/setup-local.sh` in Replit: those configure the original local Docker database, not the hosted review database.
- Ask the owner before incurring charges or confirming a paid deployment plan.

## 3. Secrets and environment

Set values securely in Replit Secrets/deployment settings. Never put values in source control, browser-exposed `NEXT_PUBLIC_*` variables, screenshots, chat or logs. Ensure the *deployed runtime*, not just the development workspace, receives them.

| Name | Required value |
| --- | --- |
| `DATABASE_URL` | The actual connection string for the dedicated review PostgreSQL database. Preserve the provider's secure TLS configuration. |
| `SESSION_SECRET` | Fresh cryptographically random session-sealing secret, at least 32 characters. Generate securely server-side; do not copy `.env.example` or Codex's local value. |
| `APP_ORIGIN` | Exact published HTTPS origin, such as the actual origin Replit assigns; no path or trailing slash. Do not fabricate a URL. |
| `NODE_ENV` | `production` for the published application. |
| `REVIEW_ADMIN_EMAIL` | Owner-chosen private reviewer administrator login email. Used only during explicit one-time setup. |
| `REVIEW_ADMIN_PASSWORD` | Unique strong password, 12–128 characters, entered/generated securely. Never print it. Used only during explicit one-time setup. |
| `ENABLE_REVIEW_BOOTSTRAP` | Set to `1` only while deliberately provisioning the temporary reviewer administrator; disable/remove immediately afterward. |

`SESSION_SECRET` can be generated using Node's `crypto.randomBytes(48).toString('base64url')` and written directly to the secure secret field without exposing it in chat/logs. Do not reuse the example placeholder. Do not use `npm run env:init` to create a localhost database URL for Replit.

The development workspace origin and the published origin may differ. Use the correct `APP_ORIGIN` for each environment. Mutation requests enforce exact origin matching. Do not weaken or remove this check to make preview forms work.

No payment, email or storage credentials are needed for this review because those integrations stay disabled.

## 4. Install and build

From the application root:

```bash
npm ci --include=dev
npm run db:generate
npm run db:validate
npm run build
```

The current deployment uses Prisma CLI and `tsx` for operational commands, so retain the installed development tooling in this review build; do not prune it before migrations/bootstrap. Installation must use `package-lock.json` and normal integrity checks.

The starter `.replit` build command is:

```bash
npm ci --include=dev && npm run db:generate && npm run build
```

## 5. Prepare the actual deployment database once

Run these commands with the actual *published review deployment's* `DATABASE_URL`, not an unrelated development database:

```bash
npm run db:migrate
npm run review:bootstrap
npm run catalog:import -- catalog/website.en.json
npm run db:status
npm run db:drift
```

`review:bootstrap` requires the explicit enable flag and secure email/password settings described above. It initializes the database-backed roles/permissions and creates one active INTERNAL / SUPER_ADMIN reviewer account. Its verification marker represents explicit operator provisioning, **not** successful email verification. It does not bypass verification for public registrations, provision real customer accounts or simulate email delivery. It prints no passwords, refuses to replace a different existing account, and preserves the existing administrator's password/roles on rerun.

Do not use `npm run db:seed` on a published instance or override `NODE_ENV` to bypass its production guard. That script is for the original local development fixtures. Additional reviewer personas should be explicitly agreed with the owner and provisioned privately; do not silently create public test logins or shared default passwords.

After setup, remove/disable `ENABLE_REVIEW_BOOTSTRAP` and remove `REVIEW_ADMIN_PASSWORD` from deployment secrets. Keep the login password securely available to the owner through a private mechanism; do not paste it into an Agent response or source file. `REVIEW_ADMIN_EMAIL` may also be removed from runtime secrets after setup.

If Replit only allows deployment database initialization at startup, create a guarded one-time initialization hook using the same enable flag, then disable that hook/flag after success. Do not run privileged account creation or catalog refresh unconditionally on every request/restart. No destructive reset, migration rewrite or old-development-database import is required.

## 6. Publish and start

Production startup command:

```bash
npm run db:migrate && npm run start
```

The included starter `.replit` defines that command. Configure the correct Replit server deployment/port mapping and publish through the owner's account. Supply the actual deployment URL as `APP_ORIGIN`; restart/redeploy after changing environment values where required.

Use HTTPS. Production session cookies are Secure, HttpOnly, SameSite=Lax and Host-prefixed. A failed login is not a reason to remove those protections. Check published environment values, origin matching, forwarded HTTPS handling and database initialization first.

Public registrations remain unverified while email is disabled, and new organization registrations additionally need internal approval. Use the privately provisioned reviewer account for the administration screens. Do not promise a full customer signup-to-payment-to-file-delivery workflow: that acceptance is blocked by the owner's integration choices.

## 7. Verify the public deployment before reporting success

1. Open the actual external HTTPS URL from a clean browser, not merely the development webview.
2. `GET /api/health` must return `status: ok`, `version: 0.1.0`, `database: connected`.
3. Confirm `/services` contains 19 entries and `/packages` contains 5; verify the exact official prices and VAT-included labels. Source catalog data and logo must load from the deployment.
4. Sign in privately with the reviewer administrator. Confirm the dashboard, organization administration, catalog, settings and audit viewer query the deployed PostgreSQL database.
5. Confirm login uses a Secure/HttpOnly Host-prefixed cookie. Verify an incorrect Origin is rejected; keep CSRF defense intact.
6. Restart/redeploy once and confirm the reviewer account, catalog and DB-backed records persist. Never depend on the deployment filesystem for business data or sessions.
7. Check mobile layout, failed-login feedback and disabled-integration messages. Payment webhooks must still return 503 and accept no events; file/email functions must not claim success.
8. Report the verified public URL, publishing type/lifetime, what was tested, remaining limitations and the secure method for accessing the reviewer login. Never report a local webview as an external deployment.

Existing local evidence: 9 unit tests, 24 PostgreSQL integration tests and 9 Chromium tests passed; host/Docker builds and authenticated production-mode Docker smoke passed. This is historical local evidence, not proof of a Replit deployment. Re-run checks relevant to any Replit adaptations. The full integration/browser suites assume isolated local fixtures as documented; do not point them at the shared hosted review database.

## Deliverables from Replit Agent

- A verified, externally reachable HTTPS review URL.
- PostgreSQL persistence and secure private reviewer login.
- The exact build/start commands and secret *names*, never values.
- Clear statement that email/payments/private files remain disabled and the complete MVP is unfinished.
- Any publishing-plan cost, expiration or account action the owner must handle.
