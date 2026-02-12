-- DropIndex
DROP INDEX IF EXISTS "drive_files_driveId_key";

-- AlterTable
ALTER TABLE "drive_files" ADD COLUMN "userEmail" TEXT NOT NULL DEFAULT '';

-- Remove default after backfill
ALTER TABLE "drive_files" ALTER COLUMN "userEmail" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "drive_files_driveId_userEmail_key" ON "drive_files"("driveId", "userEmail");
