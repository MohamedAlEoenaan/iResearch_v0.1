# Source development specification

Imported from the user-provided development specification. The application release is **V0.1** per the user; V2 in this source is a document label. This is reference material, subordinate to subsequent user decisions recorded in IMPLEMENTATION_PLAN.md.

iResearch V2.0 — Codex Development Handoff

Status: Implementation-ready baseline | Version: 1.0 | Date: 2026-10-26

1. Goal and delivery definition

Build a production-oriented, responsive, accessible iResearch web application supporting B2C individual customers, B2B organizations, and internal fulfillment in one codebase. This is a rebuild, not a cosmetic refresh. The first release must include both B2C and B2B. Do not build a fake prototype that bypasses permissions or stores business data only in memory.

Definition of MVP complete: a B2C user can purchase a catalog service through a verified payment provider, and a B2B organization can register, receive approval/activation, invite members, approve requests and submit work under its agreement. Both can proceed through AM validation, admin researcher assignment, researcher submission, QA, delivery, client acceptance or revision, and completion, with access control, notifications and audit events. Real external services may be configured through environment variables and adapters; never pretend unconfigured integrations are live.

2. Approved business rules (non-negotiable)

B2C and B2B are separate account types. An account belongs to at most one organization and cannot also act as an individual account. Separate accounts are required for personal and organizational use.

An organization registers itself. iResearch Administrator approves registration. Registration approval grants workspace access, but service authorization is a separate switch; an organization cannot send new requests into operations until service access is active.

Organization users join by invitation only. Multiple Organization Administrators are permitted. Only an iResearch Administrator can appoint, promote, demote, or remove an Organization Administrator. Do not leave an active organization with zero active administrators.

Organization Members can create multiple independent requests. Every B2B request requires approval by an Organization Administrator; administrators may self-approve. Rejection requires a reason and returns the same request for editing/resubmission, retaining its ID and approval history.

On organization approval, original requirements become immutable. Later information is appended as clarifications, with audit records. If service authorization is not active, an approved request is held outside operational Submitted until authorized.

B2B contract negotiation, contract management, invoicing, billing and financial settlement are outside the platform. There is no per-request gateway payment for B2B. B2C catalog requests require successfully verified payment before operational Submitted.

Organization Administrator can view all organization requests and all documents. Members see their own requests by default; admins may grant other members request access. Only the current request owner can accept deliverables or request revisions, even when an Organization Administrator can view them.

Request owner and Organization Administrators may respond to operational information requests. The organization administrator or request owner may request cancellation. After operational submission, internal approval is required for cancellation.

Organization Administrator can transfer ownership of an active request to another active member of the same organization; preserve original creator. An employee with active owned requests cannot be deactivated until those requests are transferred.

Deactivating organization service access prevents new submissions but does not interrupt existing requests; existing users can continue required actions.

Dedicated organization Account Manager is optional. Request-level AM is optional; unassigned requests are processed from a shared AM queue. Do not auto-assign AMs. Multiple AMs can read the same request; only one AM may edit at a time using a server-enforced expiring lock, with explicit release and admin override.

iResearch Administrator assigns Researchers directly; no researcher accept/reject step. Researchers never communicate directly with clients; client questions are routed through AM.

QA can approve/reject with comments but cannot edit deliverables. Rejected deliverables return to Researcher and require QA re-review.

After QA approval, AM delivers the output. Request owner can accept (Completed) or request revision. AM reviews scope first; within-scope revisions return to Researcher and QA; out-of-scope work creates a new request/custom quotation path.

Feedback after completion is optional. No client review deadline or auto-accept in MVP. No SLA or VIP logic.

B2C quotation only for custom/non-catalog work; catalog services/packages are fixed-price. Import current website catalog as a seed/import, do not invent service names/prices.

3. Technical architecture — implementation defaults

Use a modular monolith in one repository: - Next.js App Router, TypeScript strict mode, React Server Components for read views and server-side mutation endpoints/actions with explicit authorization. - PostgreSQL; Prisma ORM with checked-in migrations and seed data. - Tailwind CSS, shadcn/ui, React Hook Form, Zod; responsive accessible interface. - Auth.js (or another maintained secure session implementation if compatibility requires) with hashed passwords, verified email, secure HttpOnly cookies, CSRF protection, session rotation and password reset. - Private S3-compatible object storage; server-authorized uploads/downloads, size/type checks, random object keys, malware scanning integration point, no public buckets. - Notification outbox table + background worker/queue. Transactional email provider behind an interface. In-app notifications are first-class. - B2C payment provider adapter with server-side signature verification, idempotent webhook processing and reconciliation state. Payment provider is not yet selected: provide a local sandbox/mock adapter strictly for development and mark it clearly; never use mock success in production. - Vitest for unit/integration tests; Playwright for end-to-end; CI runs typecheck, lint, migration check and tests. - Docker Compose for local PostgreSQL + application; .env.example, reproducible startup, seed accounts without hardcoded production passwords. - Recommended hosting: managed PostgreSQL, private object storage, server runtime supporting background jobs. Final provider and Saudi data residency/compliance require confirmation before production. - Use server-side authorization for every data query, mutation and file URL. Never trust tenant IDs or role fields submitted by browser. - Avoid overengineering: no microservices, Kubernetes, event bus, or contract management module for MVP.

4. Roles and permission boundaries

Role

Primary rights

Restrictions

Individual Client

Own drafts, B2C checkout, own request history/files, respond to Action Required, accept/revise deliverable, optional feedback

No other users’ data or internal workflow

Organization Member

Own org drafts, submit for approval, own requests, review/accept own deliverables

No approval/payment/admin powers

Organization Administrator

Approve/reject org requests incl. own; invite/manage ordinary members; all org requests/files; reply to client-info requests; request cancellation; transfer request owner

Cannot appoint/remove other org admins; cannot accept another owner’s deliverable

Marketing

Marketing content and aggregate acquisition reporting

No client research documents or operational changes

Account Manager

Shared queue, validate, request info, communicate, deliver QA-approved work, review revision scope

Cannot assign researcher or perform QA

Researcher

Assigned work and versioned deliverables; ask AM for client info

No direct client contact or QA approval

QA

Review and approve/reject researcher deliverables with comments

Cannot edit researcher deliverables

iResearch Administrator

Organization approvals/service authorization; privileged org admin management; researcher assignment; user/catalog/workflow administration; lock override

Cannot erase audit trail

Super Administrator

Above plus critical system and integration governance

All actions audited

Use permissions (e.g., organization.approve_request, request.accept_deliverable) rather than relying solely on display role names.

5. Lifecycle and approval subflow

B2C intake

Draft → [verified gateway success] → Submitted. Payment failure/incomplete checkout leaves request in Draft; payment statuses are recorded in PaymentTransaction, not as request lifecycle states.

B2B pre-operational subflow

Draft → Pending Organization Approval → (Rejected → Draft for Revision → Pending Organization Approval)* → Approved / Awaiting Service Authorization → Submitted. These are intake/approval states, distinct from the operational request lifecycle. Approved requirements are frozen in a versioned snapshot. The system must prevent duplicate approvals or duplicate Submitted transitions.

Shared operational lifecycle

Submitted → Ready for Assignment → In Progress → QA Review → Ready for Delivery → Client Review → Completed. Branches: Pending Client Information, Revision Required, Scope Review, Cancelled. - Submitted: AM validates; incomplete goes to Pending Client Information; complete to Ready for Assignment. - Ready for Assignment: iResearch Administrator assigns Researcher → In Progress. - In Progress: Researcher submits deliverable → QA Review; client clarification via AM → Pending Client Information → In Progress. - QA Review: approve → Ready for Delivery; reject → Revision Required → QA Review. - Ready for Delivery: AM sends approved deliverable → Client Review. - Client Review: request owner accepts → Completed, or requests revision → Scope Review. - Scope Review: AM confirms within scope → In Progress/Researcher revision → QA Review; out of scope → new request/custom quotation, original request remains pending resolution under an explicit UI action (do not silently mark Completed). - Cancelled: prior to operational Submitted, client/org may cancel according to intake permissions; afterward cancellation request requires iResearch internal approval.

Client-facing status mapping

Draft/approval UI shows a clear approval label. Operational statuses map: - Submitted, Ready for Assignment → Order Confirmed - In Progress, QA Review, Revision Required, Ready for Delivery → In Progress - Pending Client Information → Action Required - Client Review → Ready for Review - Scope Review → Revision Under Review (working label) - Completed → Completed - Cancelled → Cancelled Never show internal QA/assignment details in client screens.

6. Database schema / ERD requirements

All primary keys UUID, createdAt, updatedAt, and soft deactivation where appropriate. Use foreign keys, unique constraints and indexes. Suggested entities:

User: id, email unique, password hash/identity reference, accountType (INDIVIDUAL|ORGANIZATION|INTERNAL), organizationId nullable, active, verifiedAt.

Role, Permission, UserRole (or explicit well-defined role enum + permission policy); org-scoped admin role only valid for organization users.

Organization: id, name, registrationStatus, workspaceActive, serviceAuthorized, serviceAuthorizationChangedAt, contact metadata.

OrganizationInvitation: orgId, email, tokenHash, invitedBy, expiresAt, acceptedAt, revokedAt.

ServiceCategory, Service, Package, PackageService, Price (currency, amount, tax handling, effective dates).

Request: id, accountType, organizationId nullable, createdById, currentOwnerId, service/package reference, intakeStatus, operationalStatus nullable, requestVersion, lockedRequirementsSnapshotId, optional requestAmId, researcherId nullable, cancellation data.

RequestRequirementVersion: requestId, version, payload, createdBy, immutableAfterApproval.

OrganizationApproval: requestId, attempt, decision, approverId, reason, decidedAt, submittedAt.

RequestAccessGrant: requestId, userId, grantType, grantedBy, revokedAt.

PaymentTransaction: requestId, provider, providerRef, amount, currency, status, verifiedAt, unique webhook/event IDs.

RequestAssignmentHistory: requestId, assignmentType, oldUserId, newUserId, actorId, timestamp.

RequestAction / ConversationMessage: requestId, authorId, audience, type, text, actionRequired, resolvedAt.

Document: requestId, uploadedBy, objectKey, fileName, MIME, size, kind, visibility, checksum, version.

QAReview: requestId, deliverableDocumentId, reviewerId, decision, comments, timestamp.

ClientRevision: requestId, ownerId, comments, scopeDecision, reviewedBy, timestamps.

CancellationRequest: requestId, requestedBy, reason, decision, decidedBy, timestamps.

RequestLock: requestId unique, holderAmId, leaseToken, expiresAt.

Notification, NotificationOutbox, AuditEvent: actor, tenant, entity, action, timestamp, metadata.

Integrity rules: B2B requests always have orgId; B2C never has orgId; organization request owner must belong to that organization; an operational B2B Submitted requires approved organization decision + service authorization at transition time; operational B2C Submitted requires verified successful payment; only one active request lock; one active organization admin minimum; active owner required for active organizational requests. Preserve history when owner changes.

ERD relationship sketch

Organization 1─N User, Organization 1─N Request, User 1─N Request (createdBy/currentOwner), Request 1─N Approval, Request 1─N Document, Request 1─N QAReview, Request 1─N Action, Request 1─N AuditEvent, Request 0..1─1 RequestLock, Service/Package 1─N Request.

7. Screens / navigation

Public: home, services/categories, packages, service detail, custom enquiry, sign-in, individual registration, organization registration. B2C: dashboard, drafts, checkout, requests, request detail/timeline, files, Action Required, deliverable review, feedback, profile. B2B Member: organization dashboard, new draft, approval submission/status, own requests, detail/files, Action Required, deliverable acceptance, profile. B2B Admin: organization overview, approval inbox, request approvals, all requests/files, members/invitations, access grants, ownership transfer, profile. AM: shared request queue, filter/status, request detail with lock state, validation, communications, delivery, scope review. Researcher: assigned queue, request detail, clarification via AM, deliverable versions, QA feedback. QA: pending reviews, compare versions, approve/reject with comments. iResearch Admin: organization registration queue, service activation, org-admin appointments, researcher assignment, service catalog, users, cancellation decisions, AM lock override. Super Admin: admin management, audit viewer, integration/configuration settings. Marketing: aggregated reporting/content interface; can be minimal for first milestone.

8. API / service boundaries

Organize server modules: auth, organizations, invitations, catalog, requests, organization-approvals, payments, am-queue, assignments, documents, qa, client-review, cancellations, notifications, audit, admin. Each module has validation schema, service layer, repository/database operations, policy checks, typed errors and tests. Make state transitions explicit functions with allowed source states and actor authorization; execute transition + audit + outbox atomically in DB transaction.

9. Security / quality baseline

Password hashing with Argon2id or maintained equivalent; no plaintext credentials.

Tenant scoping on all reads/writes, including nested joins and downloads. Test IDOR/cross-tenant access.

Secure HttpOnly session cookies, CSRF defense, rate limits on auth and invitations, secure reset flow, no credentials in logs.

S3 objects private; signed short-lived downloads only after policy check; validate upload size/type and protect file processing.

Audit all approvals, payments, access changes, transfers, state changes, AM lock operations, file downloads and privileged admin actions.

Database transactions + idempotency for webhook and approval transitions; optimistic version check alongside AM lock to protect against stale writes.

Pagination, indexes, error handling, structured logs, migrations, backups, monitoring.

Confirm applicable Saudi privacy/data residency obligations and sensitivity of research data before production launch. Do not claim compliance without assessment.

10. Delivery phases and acceptance

Phase 0 — Repo + setup: Next.js, DB, Prisma, auth scaffold, design system, CI, Docker, README, sample env, initial tests. docker compose up + documented commands start the application. Phase 1 — Identity + organizations: separate account types, org registration/admin approval, service activation, invitations, member administration, privileged org-admin appointments, tenant isolation tests. Phase 2 — Catalog + intake: real catalog seed/import; B2C draft/payment adapter; B2B draft/approval/rejection/resubmission, requirements lock, Submitted transitions. Phase 3 — Operations: shared AM queue + locks, validation, Action Required, researcher assignment and work queue. Phase 4 — QA + delivery: private documents/versioning, QA cycle, AM delivery, client review, scope review, cancellation, optional feedback. Phase 5 — Release: notification worker, audit viewer, complete E2E tests, security review, UAT, deploy/rollback instructions.

Every phase must include migrations, authorization tests, usable UI, and README updates. Do not mark a phase done until its acceptance tests pass.

11. Required E2E scenarios

B2C: sign up → draft → verified test payment → Submitted → full workflow → Completed.

B2B: register org → iResearch approve → activate services → invite member → member draft → org admin reject with reason → member edit/resubmit → org admin approve → Submitted → full workflow → member accepts.

Org admin self-approval is recorded.

Inactive organization cannot submit new work; existing requests remain actionable.

Organization Admin can read all org files but cannot accept another owner’s deliverable.

Transfer ownership; former owner loses acceptance permission; deactivation requires active request transfer.

Cross-tenant data and file access denied.

AM lock blocks simultaneous editors, expires and can be overridden with audit.

QA rejection returns to researcher; QA cannot edit uploaded deliverable.

Duplicate payment webhook does not create duplicate Submitted transitions.

Within-scope revision passes through QA again.

B2B request cannot enter Submitted without organization approval + service authorization.

12. Deliberately deferred details / defaults

Organization contract pricing, service restrictions, contract module and invoice management: out of scope.

Additional collaborator edit rights: default to view-only for shared access; owner and org admins retain specifically approved powers.

Multiple organization membership: not supported.

Automatic AM assignment: not supported.

Client auto-accept, SLA, priority, analytics sophistication: not supported.

Exact payment provider, email provider, cloud host, source catalog import and custom quotation conversion are external dependencies. Implement interfaces and test doubles; require real provider configuration before go-live.

For B2B approval before service activation, store APPROVED_WAITING_AUTHORIZATION; move to operational Submitted only on explicit authorized release/activation processing. Preserve approval snapshot.

For organization registration, collect minimal legal name, contact email and administrator details. Additional verification fields can be added without changing schema.

Organization Admin access to all org documents is explicit; collaborator access defaults to view-only.

For unresolved out-of-scope revision, leave request in Scope Review with clear client communication and explicit resolution action; do not auto-complete.

Role Marketing may be minimally implemented in MVP if release is time-constrained, but its access isolation must be enforced.

13. Engineering handoff instruction

Treat sections 1–11 as requirements. Section 12 lists safe implementation defaults and deferred choices. When blocked by an external dependency, build the interface, sandbox path and test coverage, mark the dependency in OPEN_DECISIONS.md, and continue other work. Do not ask for permission on every minor implementation detail; do not invent contractual or payment facts. Deliver actual working code, not mock-only screens.
