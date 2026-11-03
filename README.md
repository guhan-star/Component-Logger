# Stark Industries WMC — Component Logger

An industrial-grade, cloud-hosted electronics and hardware inventory management, custody tracking, and collaborative Bill of Materials (BOM) platform.

Built with **Next.js 16 (App Router, Turbopack)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM with PostgreSQL**.

---

## 🌟 Key Capabilities

### 1. 👤 Complete Operator Profile & Identity System (`/profile`)
- **Core Identity**: Profile picture upload (JPEG, PNG, WebP with client crop/preview, max 5MB, private object storage), display name, handle, biography, calculated age (auto-calculated from DOB).
- **Academic Background**: College / university, department, degree, course, specialization, academic status (Studying, Graduated, Postgraduate, Other), graduation years, college email, portfolio/GitHub/LinkedIn/website links.
- **Professional & Engineering Domains**: Professional title, organization, years of experience, interactive skills tag management, programming languages, and hardware focus areas.
- **Component Logger Preferences**: Preferred measurement unit, currency (INR ₹ default), date format, theme (Stark Dark, High-Contrast Light, System), default inventory view (Table / Cards), notification toggles.
- **Field-Level Privacy Controls**: Granular server-side visibility rules (public, friends, private). Strict zero-leakage guarantee: email address, mobile number, precise DOB, and physical address are **ALWAYS strictly private** and never exposed to other users or search endpoints.
- **Account Security**: Password change with current password verification, session metadata, and multi-step account deletion safeguards preventing project abandonment.

### 2. 🔄 Authoritative Custody Lifecycle & Concurrency Control
- **Unified Return Service**: All return operations across Inventory, Custody & Loans, and APIs route through `@/lib/custody-service.ts`.
- **Atomic Concurrency Protection**: Atomic transactions prevent overselling, negative stock, and duplicate returns.
- **Historical Record Preservation**: Component records are never deleted upon return of borrowed items, preserving full audit and transaction history.
- **Direct Name Input**: Supports arbitrary friend or external contact names in lending without requiring pre-registration.

### 3. 🧾 Receipt Review Staging & Atomic Batch Commit (`/receipt-review`)
- **Review Before Commit**: Staging pipeline for procurement invoices.
- **File Upload Validation**: Supports JPEG, PNG, WebP, and PDF receipts (max 10MB) with format validation and preview.
- **Transparent Mode**: Clearly identifies manual staging vs AI extraction.
- **Atomic Database Commit**: Single transaction endpoint (`/api/receipts/commit`) validates prices, quantities, and prevents duplicate invoice commits.

### 4. 🌐 Distributed Rate Limiting & Storage Security
- **Multi-Instance Rate Limiting**: Upstash Redis REST API sliding-window rate limiting for serverless edge and Node.js routes with in-memory fallback.
- **Private Object Storage**: Scoped Supabase storage paths (`{userId}/{timestamp}-{cleanName}`) with strict ownership verification preventing cross-user IDOR access. Server-side operations strictly require service-role credentials.

### 5. 👥 Collaborative Projects & BOM Sharing (Max 6 Members)
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
| **Authentication** | `jose` JWT cookies + `bcryptjs` password hashing |
| **Rate Limiting** | Upstash Redis REST API + Sliding Window Memory Fallback |
| **Spreadsheets** | SheetJS (`xlsx`) + PapaParse (Formula-injection sanitized) |

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

Ensure `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET` (minimum 32 characters) are set.

### 3. Database Migration & Client Generation
```bash
npx prisma generate
npx prisma migrate deploy
```

For offline local development using SQLite:
```bash
npx prisma db push --schema=prisma/schema.sqlite.prisma
```

### 4. Run Verification Test Suite
```bash
npx tsx tests/comprehensive-launch-readiness.test.ts
```

### 5. Start Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🔒 Security & Admin Provisioning

- **Admin Provisioning**: Administrative roles are never automatically assigned during public registration. Use the secure CLI tool:
  ```bash
  npx tsx scripts/manage-admin.ts promote <user-email>
  ```
- **Zero-Directory Leakage**: Discovery searches require exact username matches (`@handle`). Wildcard searches, public member directories, and email enumeration are strictly disabled.
