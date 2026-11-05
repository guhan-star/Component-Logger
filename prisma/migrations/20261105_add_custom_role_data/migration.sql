-- AlterTable: Add customRoleData to UserProfile for role-based persistence across switches
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "customRoleData" TEXT;
