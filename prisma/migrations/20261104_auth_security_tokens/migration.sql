-- AlterTable: Add email verification and session versioning to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: Update EmailVerificationToken with tokenHash and usedAt
ALTER TABLE "EmailVerificationToken" ALTER COLUMN "newEmail" DROP NOT NULL;
ALTER TABLE "EmailVerificationToken" ALTER COLUMN "token" DROP NOT NULL;
ALTER TABLE "EmailVerificationToken" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT;
ALTER TABLE "EmailVerificationToken" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_idx" ON "EmailVerificationToken"("tokenHash");

-- CreateTable: PasswordResetToken
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey'
    ) THEN
        ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: UserSession
CREATE TABLE IF NOT EXISTS "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_sessionTokenHash_key" ON "UserSession"("sessionTokenHash");
CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX IF NOT EXISTS "UserSession_sessionTokenHash_idx" ON "UserSession"("sessionTokenHash");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserSession_userId_fkey'
    ) THEN
        ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
