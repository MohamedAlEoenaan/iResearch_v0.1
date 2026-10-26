# iResearch V0.1 implementation plan

The uploaded specification is preserved in `IRESEARCH_V2_CODEX_HANDOFF.md`. Its V2 label does not change the user-requested release number: **V0.1**.

## Confirmed user decisions

- Build the complete MVP, delivered phase by phase.
- Next.js App Router, strict TypeScript, PostgreSQL, Prisma, Tailwind/shadcn primitives.
- English interface; logo and colors from https://iresearch.com.sa/.
- Email, payments, private file storage, and malware scanning remain **blocked**. Do not use development adapters that simulate their success.
- Display the website prices exactly, including unusual cents. Prices include VAT (explicit user confirmation).
- Ask the user about unresolved product decisions; do not invent catalog, integration, contractual, or compliance facts.

Checkboxes indicate implemented capabilities, not an assertion that the entire release is ready. Parent phase acceptance remains open where real external integrations prevent the specified end-to-end scenario.

## Phase 0 — Application and development environment

- [x] Next.js/React application, TypeScript strict mode, Tailwind, reusable shadcn-style Button using Radix Slot/CVA, React Hook Form/Zod registration.
- [x] PostgreSQL/Prisma schema, versioned migrations, generated client, local secrets generation, repeatable development seeding.
- [x] Branded responsive public pages and role-specific workspace, loading/error/empty states.
- [x] Vitest unit/integration suites and Playwright browser tests.
- [x] Docker application startup and local CI-equivalent checks verified; results recorded in `VALIDATION.md`. Remote GitHub Actions execution is not claimed.

Acceptance: documented setup starts DB/app; migrations are repeatable; lint/typecheck/build/tests pass; a functional application request reaches PostgreSQL.

## Phase 1 — Identity and organizations

- [x] Separate individual and organization registration, Argon2id passwords, database-backed role/permission joins.
- [x] Maintained iron-session cookie sealing around opaque, hashed, expiring database sessions; HttpOnly/SameSite cookies, production Secure/Host prefix; login rotation and logout revocation.
- [x] Origin/content-type checks on mutations, database-backed rate limiting, token expiry/single-use verification/reset handlers; password reset revokes sessions.
- [x] Organization review and explicit initial admin appointment by iResearch Administrator; independent service activation.
- [x] Invitation-only ordinary membership, existing-account separation, expiry/revocation/single-use acceptance.
- [x] Privileged org-admin appointment/removal, last active admin guard, ordinary member deactivation and active-request ownership checks.
- [x] Internal role governance by Super Administrator; last Super Administrator protection.
- [x] Integration tests for cross-tenant denial, registration permissions, admin boundaries, session expiry, invitation replay, reset consumption, deactivation restrictions.
- [ ] Real verification/reset/invitation email delivery (blocked by user decision). New public registrations cannot sign in before verification; no fake verification shortcut exists.

Acceptance: independent registration → verified email → approval where required → login; invited user joins correct tenant; unauthorized/last-admin/cross-tenant actions fail. Development identities test the workspace while email delivery is disabled. This phase is **not accepted as fully complete** while email-dependent scenarios remain blocked.

## Phase 2 — Catalog and intake

- [x] Imported 24 exact English website products (19 services, 5 packages), official descriptions and source provenance, prices in halalas, VAT-included labels.
- [x] Public searchable services/packages and detail pages; audited admin visibility control; repeatable validated import.
- [x] B2C and B2B persisted drafts; custom enquiry drafts remain explicitly awaiting quotation conversion.
- [x] B2B approval/rejection/resubmission preserves request ID and decision history; self-approval audited; duplicate approvals prevented.
- [x] Immutable approved snapshot; post-approval clarifications are appended separately.
- [x] Approval before activation holds work; explicit service activation transactionally releases approved work exactly once.
- [x] Database checks prevent unapproved/unauthorized B2B submission and unpaid B2C submission.
- [ ] B2C real checkout, signature verification, reconciliation and webhook idempotency (provider deliberately blocked; webhook returns 503 and does not accept events).
- [ ] Quotation-to-request conversion (requires a business decision).
      Catalog administration currently uses verified imports and visibility controls. Package inclusions are preserved in the official descriptions; this release does not invent structured package-component mappings or prices.

Acceptance: real test-provider B2C payment → one Submitted transition; B2B reject/edit/resubmit/approve/activation → one Submitted transition; immutable requirements and isolation verified. B2C remains blocked.

## Phase 3 — Operations

- [x] Shared AM queue; no automatic assignment; exclusive five-minute server-enforced editing lease, renewal/release/expiry and audited admin override.
- [x] Transactional version checks, validation, client Action Required and response/resume flow.
- [x] Direct administrator researcher assignment/reassignment and history; assigned researcher queue. Former researchers lose request access after reassignment.
- [x] Researcher questions remain internal and are routed through AM.
- [x] Operations continue after organization service deactivation.
- [x] Read-only collaborator access grants/revocation, request ownership transfer, creator history preserved.
- [x] Optional dedicated organization AM and request-level AM appointments by internal administrators, separately audited; no automatic assignment.

Acceptance: browser-based member approval → AM lock/validate → admin assignment → assigned researcher; concurrent editor and stale-version tests fail correctly.

## Phase 4 — QA and delivery

- [x] Server-side transitions for versioned deliverable submission, QA approve/reject, AM delivery, owner accept/revise, scope assessment, cancellation and optional feedback.
- [x] QA cannot mutate deliverables; a rejected version cannot be resubmitted unchanged; revisions must pass QA again.
- [x] Only current owner can accept/revise; org admins can view without accepting another owner’s output.
- [x] Out-of-scope revision remains Scope Review with explicit separate-enquiry action; no automatic completion.
- [x] Internal approval required for post-submission cancellation.
- [x] Real PostgreSQL service-level lifecycle tests using clearly identified **document metadata fixtures**, not an implemented storage service.
- [ ] Private S3 object upload/download, size/type validation and malware scanning (blocked by user decision); no public storage or pretend download links.
- [ ] Browser end-to-end delivery/QA/client acceptance with real uploaded documents (blocked by storage).

Acceptance: actual private document upload → QA reject/new version/approve → delivery → owner revision → QA again → owner acceptance. Service-level fixture tests do not satisfy the real-file acceptance scenario.

## Phase 5 — Release

- [x] Transactional in-app notifications, blocked email outbox records, read/unread UI.
- [x] Database-enforced append-only audit and approved requirement history; paginated audit viewer.
- [x] Marketing access isolation; no fabricated acquisition metrics.
- [ ] Configured email background delivery worker with retry/idempotency (current worker only reports blocked records).
- [ ] Real-provider B2C and full real-file B2B E2E scenarios.
- [x] Local PostgreSQL backup/restore rehearsal, including user/request/catalog/audit counts and integrity triggers. Ignored snapshot retained for environment restoration.
- [ ] Security review, UAT, monitoring, production backup/restore, production provisioning/rollback and Saudi data-residency assessment.

Acceptance: all required specification scenarios execute against configured integrations; deployment, restore and rollback are tested; production decisions approved by the owner. **Do not call the complete MVP production-ready before this acceptance.**
