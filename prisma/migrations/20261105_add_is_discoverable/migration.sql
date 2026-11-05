-- AlterTable
ALTER TABLE "UserPrivacySettings" ADD COLUMN IF NOT EXISTS "isDiscoverable" BOOLEAN NOT NULL DEFAULT true;

-- Ensure all existing records default to true while preserving explicit false
UPDATE "UserPrivacySettings" SET "isDiscoverable" = true WHERE "isDiscoverable" IS NULL;
