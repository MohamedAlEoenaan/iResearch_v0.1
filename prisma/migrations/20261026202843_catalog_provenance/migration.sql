-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "Audit_actor_fk";

-- DropForeignKey
ALTER TABLE "AuthToken" DROP CONSTRAINT "AuthToken_user_fk";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_uploader_fk";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_user_fk";

-- DropForeignKey
ALTER TABLE "OrganizationApproval" DROP CONSTRAINT "Approval_user_fk";

-- DropForeignKey
ALTER TABLE "OrganizationInvitation" DROP CONSTRAINT "Invitation_inviter_fk";

-- DropForeignKey
ALTER TABLE "QAReview" DROP CONSTRAINT "QA_document_fk";

-- DropForeignKey
ALTER TABLE "QAReview" DROP CONSTRAINT "QA_reviewer_fk";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_am_fk";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_creator_fk";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_owner_fk";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_researcher_fk";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_snapshot_fk";

-- DropForeignKey
ALTER TABLE "RequestAccessGrant" DROP CONSTRAINT "Grant_user_fk";

-- DropForeignKey
ALTER TABLE "RequestLock" DROP CONSTRAINT "Lock_holder_fk";

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'SERVICE',
ADD COLUMN     "sourceVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "taxHandling" TEXT NOT NULL DEFAULT 'VAT_INCLUDED';
