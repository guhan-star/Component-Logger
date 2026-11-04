# Stark Industries WMC — Component Logger

An industrial-grade, cloud-hosted electronics and hardware inventory management, custody tracking, and collaborative Bill of Materials (BOM) platform.

Built with **Next.js 16 (App Router, Turbopack)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM with PostgreSQL**.

---

## 🌟 Key Capabilities

### 1. 🛡️ Complete Authentication Security, Verification & Session Revocation
- **Cryptographic Email Verification (`/verify-email`)**: New registrations issue high-entropy 256-bit single-use verification tokens. Only SHA-256 token hashes are persisted to the database. Emails are transmitted via transactional provider (Resend).
- **Secure Password Recovery (`/forgot-password` & `/reset-password`)**: Generic responses prevent email enumeration. Tokens expire in 1 hour and are consumed atomically in single database transactions.
- **Mandatory Session Revocation**: Every session JWT embeds a per-user `sessionVersion` stamp. Password resets, password changes, and explicit session revocations immediately invalidate all existing sessions across all browsers and devices.
- **Dedicated Session Control (`/profile`)**: Operators can trigger *"Revoke All Other Sessions"* to immediately sign out any shared or legacy devices.

### 2. ⚡ Distributed Production Rate Limiter (Upstash Redis)
- **Shared Serverless Protection**: Shared multi-region rate limiting powered by atomic Upstash Redis REST pipelines (`INCR`, `EXPIRE NX`, `TTL`).
- **Fail-Closed Production Security**: In production (`NODE_ENV === 'production'`), sensitive authentication and abuse-prone endpoints (registration, login, password recovery, invitations) fail closed with controlled HTTP 503 responses if Upstash is unconfigured or unreachable.
- **Standard HTTP Headers**: Emits `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` with HTTP 429 upon rate limit exhaustion.
- **Reliable Client IP Detection**: Prioritizes `x-vercel-forwarded-for`, `cf-connecting-ip`, and proxy forwarding headers.

### 3. 👤 Operator Profile & Identity System (`/profile`)
- **Core Identity**: Profile picture upload (JPEG, PNG, WebP with client crop/preview, max 5MB, private object storage), display name, handle, biography, calculated age (auto-calculated from DOB).
- **Academic Background**: College / university, department, degree, course, specialization, academic status (Studying, Graduated, Postgraduate, Other), graduation years, college email, portfolio/GitHub/LinkedIn/website links.
- **Professional & Engineering Domains**: Professional title, organization, years of experience, interactive skills tag management, programming languages, and hardware focus areas.
- **Component Logger Preferences**: Preferred measurement unit, currency (INR ₹ default), date format, theme (Stark Dark, High-Contrast Light, System), default inventory view (Table / Cards), notification toggles.
- **Field-Level Privacy Controls**: Granular server-side visibility rules (public, friends, private). Strict zero-leakage guarantee: email address, mobile number, precise DOB, and physical address are **ALWAYS strictly private** and never exposed to other users or search endpoints.

### 4. 🔄 Authoritative Custody Lifecycle & Concurrency Control (`/loans`)
- **Unified Return Service**: All return operations across Inventory, Custody & Loans, and APIs route through `@/lib/custody-service.ts`.
- **Atomic Concurrency Protection**: Atomic transactions prevent overselling, negative stock, and duplicate returns.
- **Historical Record Preservation**: Component records are never deleted upon return of borrowed items, preserving full audit and transaction history.
- **Direct Name Input**: Supports arbitrary friend or external contact names in lending without requiring pre-registration.

### 5. 🧾 Receipt Review Staging & Atomic Batch Commit (`/receipt-review`)
- **Review Before Commit**: Staging pipeline for procurement invoices.
- **File Upload Validation**: Supports JPEG, PNG, WebP, and PDF receipts (max 10MB) with format validation and preview.
- **Transparent Mode**: Clearly identifies manual staging vs AI extraction.
- **Atomic Database Commit**: Single transaction endpoint (`/api/receipts/commit`) validates prices, quantities, and prevents duplicate invoice commits.

### 6. 👥 Collaborative Projects & BOM Sharing (Max 6 Members)
- **Strict 6-Member Teams**: Owner + up to 5 accepted friends enforced atomically in database transactions.
- **Snapshot-Based BOM**: Sharing components copies technical specs only, preserving complete privacy of personal stock, costs, storage, and suppliers.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js 16.4.3 (React 19, Turbopack, App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 (Industrial Stark Graphite & Amber Palette) |
| **Database & ORM** | PostgreSQL (Supabase) via Prisma ORM |
| **Storage** | Supabase Private Object Storage Buckets |
| **Hosting** | Vercel |
| **Authentication** | `jose` JWT cookies + `bcryptjs` password hashing + Session Revocation |
| **Rate Limiting** | Upstash Redis REST API (Atomic Pipelines + Fail-Closed) |
| **Email Service** | Resend REST API (Transactional Verification & Password Recovery) |
| **Automated Testing** | Vitest 5 + V8 Coverage Reporter |

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/guhan-star/Component-Logger.git
cd Component-Logger
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure the following variables are configured:
- `DATABASE_URL` & `DIRECT_URL`: Supabase PostgreSQL credentials.
- `AUTH_SECRET`: Minimum 32-character secure random string.
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: For distributed rate limiting.
- `RESEND_API_KEY`: For sending verification and reset emails.

### 3. Database Migration
```bash
npx prisma generate
npx prisma migrate deploy
```

For offline local development using SQLite:
```bash
npx prisma db push --schema=prisma/schema.sqlite.prisma
```

### 4. Running Tests & Quality Checks
Standard executable scripts:
```bash
# Static analysis and linting
npm run lint

# TypeScript static type check
npm run typecheck

# Automated test suite (unit + integration)
npm run test

# Watch mode during development
npm run test:watch

# Test coverage report
npm run test:coverage

# Production build verification
npm run build
```

### 5. Start Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🔒 Security Architecture Summary

- **Single-Use Tokens**: Verification and password recovery tokens use SHA-256 hashes with expiration. Tokens are consumed atomically and rejected on subsequent attempts.
- **Session Revocation**: Password reset or settings changes increment `sessionVersion`, invalidating tokens across all devices simultaneously.
- **Zero-Directory Leakage**: Discovery searches require exact username matches (`@handle`). Wildcards, directory enumeration, and email searches are blocked.
- **Admin Provisioning**: Administrative roles are never automatically assigned during public registration. Use the secure CLI tool:
  ```bash
  npx tsx scripts/manage-admin.ts promote <user-email>
  ```
