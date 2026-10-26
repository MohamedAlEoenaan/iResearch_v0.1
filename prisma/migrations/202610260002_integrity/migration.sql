-- Account types and tenant membership are database invariants, not browser input.
ALTER TABLE "User" ADD CONSTRAINT "User_account_tenant" CHECK (("accountType" = 'ORGANIZATION' AND "organizationId" IS NOT NULL) OR ("accountType" <> 'ORGANIZATION' AND "organizationId" IS NULL));
ALTER TABLE "Request" ADD CONSTRAINT "Request_account_tenant" CHECK (("accountType" = 'ORGANIZATION' AND "organizationId" IS NOT NULL) OR ("accountType" = 'INDIVIDUAL' AND "organizationId" IS NULL));
ALTER TABLE "Request" ADD CONSTRAINT "Request_creator_fk" FOREIGN KEY ("createdById") REFERENCES "User"(id);
ALTER TABLE "Request" ADD CONSTRAINT "Request_owner_fk" FOREIGN KEY ("currentOwnerId") REFERENCES "User"(id);
ALTER TABLE "Request" ADD CONSTRAINT "Request_researcher_fk" FOREIGN KEY ("researcherId") REFERENCES "User"(id);
ALTER TABLE "Request" ADD CONSTRAINT "Request_am_fk" FOREIGN KEY ("requestAmId") REFERENCES "User"(id);
ALTER TABLE "Request" ADD CONSTRAINT "Request_snapshot_fk" FOREIGN KEY ("lockedRequirementsSnapshotId") REFERENCES "RequestRequirementVersion"(id);
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploader_fk" FOREIGN KEY ("uploadedBy") REFERENCES "User"(id);
ALTER TABLE "QAReview" ADD CONSTRAINT "QA_document_fk" FOREIGN KEY ("deliverableDocumentId") REFERENCES "Document"(id);
ALTER TABLE "QAReview" ADD CONSTRAINT "QA_reviewer_fk" FOREIGN KEY ("reviewerId") REFERENCES "User"(id);
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "Invitation_inviter_fk" FOREIGN KEY ("invitedBy") REFERENCES "User"(id);
ALTER TABLE "RequestAccessGrant" ADD CONSTRAINT "Grant_user_fk" FOREIGN KEY ("userId") REFERENCES "User"(id);
ALTER TABLE "RequestLock" ADD CONSTRAINT "Lock_holder_fk" FOREIGN KEY ("holderAmId") REFERENCES "User"(id);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_fk" FOREIGN KEY ("userId") REFERENCES "User"(id);
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_user_fk" FOREIGN KEY ("userId") REFERENCES "User"(id);
ALTER TABLE "OrganizationApproval" ADD CONSTRAINT "Approval_user_fk" FOREIGN KEY ("approverId") REFERENCES "User"(id);
ALTER TABLE "AuditEvent" ADD CONSTRAINT "Audit_actor_fk" FOREIGN KEY ("actorId") REFERENCES "User"(id);
ALTER TABLE "Service" ADD CONSTRAINT "Service_amount_nonnegative" CHECK (amount >= 0);
ALTER TABLE "Document" ADD CONSTRAINT "Document_size_positive" CHECK (size > 0 AND size <= 26214400);

CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable'; END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER requirements_append_only BEFORE UPDATE OR DELETE ON "RequestRequirementVersion" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION enforce_request_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_row "User"%ROWTYPE; snapshot_row "RequestRequirementVersion"%ROWTYPE;
BEGIN
  SELECT * INTO owner_row FROM "User" WHERE id = NEW."currentOwnerId";
  IF NOT owner_row.active OR owner_row."accountType" <> NEW."accountType" OR owner_row."organizationId" IS DISTINCT FROM NEW."organizationId" THEN
    RAISE EXCEPTION 'Request owner must be an active account in the same tenant';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."lockedRequirementsSnapshotId" IS NOT NULL AND (NEW.requirements IS DISTINCT FROM OLD.requirements OR NEW.title IS DISTINCT FROM OLD.title OR NEW."serviceId" IS DISTINCT FROM OLD."serviceId" OR NEW."lockedRequirementsSnapshotId" IS DISTINCT FROM OLD."lockedRequirementsSnapshotId") THEN
    RAISE EXCEPTION 'Approved requirements and snapshot reference cannot change';
  END IF;
  IF NEW."lockedRequirementsSnapshotId" IS NOT NULL THEN
    SELECT * INTO snapshot_row FROM "RequestRequirementVersion" WHERE id = NEW."lockedRequirementsSnapshotId";
    IF snapshot_row."requestId" IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Snapshot belongs to another request'; END IF;
  END IF;
  IF NEW."operationalStatus" = 'SUBMITTED' AND (TG_OP = 'INSERT' OR OLD."operationalStatus" IS NULL) THEN
    IF NEW."intakeStatus" <> 'SUBMITTED' THEN RAISE EXCEPTION 'Operational submission requires submitted intake'; END IF;
    IF NEW."accountType" = 'ORGANIZATION' THEN
      IF NOT EXISTS (SELECT 1 FROM "Organization" WHERE id = NEW."organizationId" AND "serviceAuthorized" AND "workspaceActive") OR NEW."lockedRequirementsSnapshotId" IS NULL OR NOT EXISTS (SELECT 1 FROM "OrganizationApproval" WHERE "requestId" = NEW.id AND decision = 'APPROVED') THEN
        RAISE EXCEPTION 'Organization approval, immutable requirements and service authorization are required';
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM "PaymentTransaction" WHERE "requestId" = NEW.id AND status = 'SUCCEEDED' AND "verifiedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Verified payment required'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER request_integrity BEFORE INSERT OR UPDATE ON "Request" FOR EACH ROW EXECUTE FUNCTION enforce_request_integrity();
