# Production Deployment Guide: Stark Industries WMC

This guide explains how to deploy **Stark Industries Warehouse Management & Control (WMC)** to **Vercel** with **Supabase PostgreSQL** and **Supabase Storage** on free tiers.

---

## 1. Prerequisites & Services

| Service | Tier | Purpose |
|---|---|---|
| **Vercel** | Hobby (Free) | Next.js 16 hosting with automatic CI/CD & SSL |
| **Supabase** | Free Tier | Cloud PostgreSQL database & private object storage |
| **GitHub** | Free | Source code repository (`https://github.com/guhan-star/Component-Logger`) |

---

## 2. Step 1: Provision Cloud Database & Storage (Supabase)

1. Log in to [Supabase](https://supabase.com) and click **New project**.
2. Set a project name (e.g. `stark-industries-wmc`), database password, and select your preferred AWS region.
3. Once initialized, navigate to **Project Settings** → **Database**:
   - Locate the **Connection string** section.
   - Select **URI** mode:
     - **Transaction Pooler (port 6543)**: This is your `DATABASE_URL` (ideal for serverless Vercel functions).
     - **Session / Direct Connection (port 5432)**: This is your `DIRECT_URL` (used by Prisma during migration deployments).
4. Navigate to **Storage** → **Buckets**:
   - Create the following private buckets:
     - `component-images` (Private)
     - `datasheets` (Private)
     - `receipts` (Private)
     - `project-attachments` (Private)

---

## 3. Step 2: Configure Environment Variables

Prepare your environment configuration. In Vercel Project Settings → Environment Variables:

```bash
# Cloud Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Production Authentication Secret (Required in production: minimum 32 chars)
# Generate with: openssl rand -base64 48
AUTH_SECRET="your-high-entropy-production-secret-min-32-chars-long"

# Next.js Environment
NODE_ENV="production"

# Supabase Storage & API Keys
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"
```

---

## 4. Step 3: Run Database Migrations

Before deploying or upon first linking the database, apply the PostgreSQL DDL migrations located in `prisma/migrations/0_init/migration.sql`:

```bash
# Run Prisma migrate deploy using the direct PostgreSQL URL
npx prisma migrate deploy
```

To seed the initial administrative operator account (`operator@stark.wmc`):

```bash
npx tsx scripts/seed-main-operator.ts
```

---

## 5. Step 4: Deploy to Vercel

### Option A: Via Vercel Web Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com/new).
2. Select your repository: `guhan-star/Component-Logger`.
3. Framework Preset: **Next.js**.
4. Root Directory: `./`.
5. Build Command: `prisma generate && next build`.
6. Add the environment variables configured in Step 2.
7. Click **Deploy**.

### Option B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel link
vercel env pull
vercel --prod
```

Your cloud warehouse will be accessible globally via your free Vercel subdomain:
`https://your-project.vercel.app`

---

## 6. Zero Data Leakage Verification Checklist

- [x] Unauthenticated requests to `/components`, `/projects`, `/friends`, `/settings` are redirected to `/login`.
- [x] User registrations require unique usernames, email validation, and strong passwords (minimum 8 characters, letters and numbers).
- [x] All inventory components, stock counts, transactions, and purchases are strictly isolated by `userId`.
- [x] Friend discovery functions exclusively via exact username matches — zero public member directories or email enumeration.
- [x] Project teams enforce a strict cap of 6 members (1 Owner + up to 5 members).
- [x] Collaborative BOM items copy an explicit allowlist snapshot and never expose personal stock quantities, purchase costs, storage bins, or private notes.
