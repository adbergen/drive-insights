-- CreateIndex
CREATE INDEX "drive_files_userEmail_trashed_idx" ON "drive_files"("userEmail", "trashed");

-- CreateIndex
CREATE INDEX "drive_files_userEmail_modifiedTime_idx" ON "drive_files"("userEmail", "modifiedTime");

-- CreateIndex
CREATE INDEX "drive_files_userEmail_ownerEmail_idx" ON "drive_files"("userEmail", "ownerEmail");
