-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dedicatedAmId" UUID;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_user_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_dedicatedAmId_fkey" FOREIGN KEY ("dedicatedAmId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "Invitation_inviter_fk" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_creator_fk" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_owner_fk" FOREIGN KEY ("currentOwnerId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_researcher_fk" FOREIGN KEY ("researcherId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_am_fk" FOREIGN KEY ("requestAmId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_snapshot_fk" FOREIGN KEY ("lockedRequirementsSnapshotId") REFERENCES "RequestRequirementVersion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationApproval" ADD CONSTRAINT "Approval_user_fk" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RequestAccessGrant" ADD CONSTRAINT "Grant_user_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploader_fk" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QAReview" ADD CONSTRAINT "QA_reviewer_fk" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QAReview" ADD CONSTRAINT "QA_document_fk" FOREIGN KEY ("deliverableDocumentId") REFERENCES "Document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RequestLock" ADD CONSTRAINT "Lock_holder_fk" FOREIGN KEY ("holderAmId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "Audit_actor_fk" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
