# V0.1 validation evidence

Last recorded: 2026-10-27T00:00+03:00 (Asia/Riyadh). Local development environment only; no deployment or production compliance claim.

## Passed

| Check | Result |
| --- | --- |
| `bash scripts/setup-local.sh` | Complete frozen-lock install, preserved local configuration/credentials, PostgreSQL readiness, Prisma generation/migrations, development seed and official catalog import; isolated test DB prepared |
| `npm run db:validate` | Valid schema |
| `npm run db:status` | All five checked-in migrations applied |
| `npm run db:drift` | No difference between schema and actual database |
| `npm run lint` | No errors or warnings |
| `npm run typecheck` | Passed |
| `npm test` | 9 unit tests passed |
| `npm run test:integration` | 24 tests passed against separate `iresearch_test` PostgreSQL database |
| `npm run test:e2e` | 9 Chromium tests passed in supported Webpack development mode |
| Focused browser rerun after researcher reassignment changes | B2B reject/revise/approve/AM validate/researcher assignment scenario passed |
| `npm run build` | Host production build passed |
| `python scripts/cloud-docker-build.py` | Image built with signed Debian OpenSSL packages, configured proxy CA as an ephemeral build secret, and normal TLS/checksum verification retained |
| Docker Compose app startup | Migrations applied, non-root application started and health request confirmed real PostgreSQL connectivity |
| Production-mode Docker browser smoke | Authenticated DB-backed dashboard and official package catalog; session cookie Secure, HttpOnly and Host-prefixed |
| Catalog import repeated | 24 source-ID upserts, 19 services and 5 packages, no duplicates; official prices preserved, VAT included per owner |
| Local backup restoration | Custom-format dump restored to a newly created verification database; user/request/catalog/audit counts and immutable-history/request-integrity triggers matched; verification DB then removed |
| Repository hygiene | Local settings, credentials, dependencies, generated app output and DB dump are ignored; no credentials printed or committed |

Distinct automated tests: **42** (9 unit + 24 integration + 9 browser). The focused browser rerun repeats one scenario and is not counted as an extra test.

## What the checks establish

- Registration cannot elevate browser-supplied role/tenant fields. Individuals and organization users remain separate. Pending registrations are not automatically verified.
- Organization review and service activation are independent. Initial administrator appointment, later promotions/removals and the minimum-admin guard are enforced.
- Invitations expire, can be revoked/reissued, are single-use, and cannot turn an existing individual account into an organization account.
- Cross-tenant reads and writes fail. View-only sharing does not permit editing; transfer preserves original creator; deactivation requires active-request transfer.
- B2B rejection requires a reason and preserves request ID/history. Self-approval is audited. Concurrent duplicate approvals produce only one snapshot/transition.
- Database submission gates reject unpaid B2C requests and B2B requests lacking approval, immutable requirements or service authorization. Approved waiting work releases exactly once after activation.
- AM leases exclude competing editors, expire, release and support audited override. Stale versions fail. Optional AM appointments do not automatically assign new requests or remove the shared queue.
- Only internal administrators assign/reassign researchers. Former researchers lose access. Researcher questions remain internal.
- QA rejection/new version/re-review, owner-only acceptance, revision scope, post-submission cancellation decisions and immutable audit history are service-tested.

## Blocked and unrun acceptance scenarios

| Required scenario | Actual status |
| --- | --- |
| Public signup → real verification email → login | Blocked: email integration deliberately disabled |
| Organization invitation email → recipient joins via delivered link | Acceptance logic service-tested; real delivery blocked |
| B2C verified test payment → Submitted → completed workflow | Blocked: payment, email and file providers disabled |
| Duplicate signed payment webhook → exactly one submission | Unrun: no configured provider/signature contract; endpoint returns 503 and accepts no events |
| Actual private uploads, scanned objects, signed downloads | Blocked: private storage and scanner deliberately disabled |
| Browser QA/delivery/client acceptance using actual uploaded files | Blocked: service-level **document metadata fixtures** test transitions but are not a storage integration |
| Custom quotation conversion | Awaiting owner-approved process |
| Production UAT, hosting/residency, compliance, monitoring and production restore/rollback | Not performed; provider/owner decisions remain open |
| Remote GitHub Actions run | Workflow authored; remote execution not observed |
| Environment publish and new-task restoration | Not performed; configuration draft saved, local dump restoration verified separately |

## Resolved setup issues

The managed network initially denied the website and Prisma engine host; configured access subsequently succeeded with verification intact. Prisma's temporary JavaScript schema-engine investigation exposed an unsupported PostgreSQL catalog type; standard native Prisma tooling now works, and no custom migration runner remains. A development CSP issue was corrected with development-only eval support. Development uses the supported Webpack bundler after a Turbopack reload-loop diagnosis; production builds still use the standard Next.js build. Docker runtime file ownership and OpenSSL detection were corrected and its actual authenticated startup was retested. No checksum, signature or TLS verification was disabled.

The local dump `.local/onboarding-db.dump` and checksum are private ignored development artifacts. They are not a production backup service. Restore only into a confirmed-empty local database; never overwrite an existing database. Startup/installation configuration is saved for environment review, not published or deployed by the agent.
