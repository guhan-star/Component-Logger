# Database Migration: SQLite to Supabase PostgreSQL

This document outlines the migration procedure from local SQLite development databases to cloud-hosted Supabase PostgreSQL.

---

## 1. Schema Files

- **Production Cloud Schema**: `prisma/schema.prisma`
  - `provider = "postgresql"`
  - `url = env("DATABASE_URL")` (Port 6543 / Transaction Pooler with PgBouncer)
  - `directUrl = env("DIRECT_URL")` (Port 5432 / Session direct connection for DDL)
- **Local Offline Testing Schema**: `prisma/schema.sqlite.prisma`
  - `provider = "sqlite"`
  - `url = "file:./dev.db"`

---

## 2. One-Time Data Migration Script

To transfer pre-existing SQLite inventory records into PostgreSQL:

```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

The script performs the following safe steps:
1. Verifies connectivity to the destination PostgreSQL database.
2. Backs up the SQLite database to `prisma/dev.db.backup`.
3. Ensures all pre-existing records without a `userId` are attributed to the primary operator account (`operator@stark.wmc`).
4. Migrates records in dependency order:
   - `User` & `UserSettings`
   - `UserDropdownValue`
   - `Component` & `TechnicalSpec`
   - `InventoryTransaction`
   - `BorrowRecord` & `LendRecord`
   - `PurchaseItem`
   - `Project`, `ProjectMember`, `ProjectBomItem`
5. Reports migration status and total row count.

---

## 3. Rollback Strategy

If a cloud migration needs to be rolled back:
1. Re-point environment configuration `DATABASE_URL` and `DIRECT_URL` to the backup PostgreSQL instance.
2. For local testing, restore the SQLite backup:
   ```bash
   copy prisma/dev.db.backup prisma/dev.db
   npx prisma db push --schema=prisma/schema.sqlite.prisma
   ```
