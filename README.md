# Stark Industries WMC — Multi-User Cloud Platform & Collaborative BOM

An industrial-grade, cloud-hosted inventory management and collaborative hardware Bill of Materials (BOM) platform for electronic components, laboratory stock, custody tracking, and procurement pipelines.

Built with **Next.js 16 (App Router, Turbopack)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM with PostgreSQL**.

---

## 🌟 Key Features

### 1. 🌐 Public Cloud Platform with 100% Private Inventories
- **Public Website & Registration**: Users can register and access the terminal from anywhere on a free Vercel subdomain (`https://*.vercel.app`).
- **Complete Tenant Isolation**: Every component, stock quantity, transaction log, and purchase is strictly scoped by `userId`. Users can never see or access another operator's private inventory.

### 2. 👥 Private Friends & Exact Username Discovery
- **Exact Discovery Only**: Search and connect with peers via exact username matches (`@ironman`). Zero public directory, zero browsing, zero email enumeration.
- **Mutual Friendships**: Canonical friendship relationships (`user1Id < user2Id`) with states `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`.
- **Pre-requisite for Collaboration**: Only accepted friends can be invited into project BOM teams.

### 3. 🚀 Collaborative Projects & Strict 6-Member Teams
- **Strict Cap**: Each project allows a maximum of **6 members total** (1 Owner + up to 5 members), enforced atomically in database transactions.
- **Granular Roles**:
  - `OWNER`: Full administrative control, can update/delete project, invite/remove members, and manage BOM items.
  - `EDITOR`: Can add/edit/delete BOM snapshot items and invite accepted friends.
  - `VIEWER`: Read-only access to the team roster and shared BOM snapshot items.

### 4. 🔒 Snapshot-Based Collaborative BOM
- **Strict Field Allowlist**: Sharing a part into a team BOM creates a project-owned snapshot copying ONLY technical specifications (name, MPN, manufacturer, specs, datasheet, required quantity, notes).
- **Zero Leakage**: Teammates **NEVER** see personal stock counts, purchase costs, storage locations, suppliers, receipts, or private notes.
- **Custom / Planned Parts**: Add planned components directly to the BOM with team notes.

### 5. 🛡️ Industrial Security & Session Protection
- **Tamper-Proof Authentication**: Stateless HTTP-only, SameSite=Lax JWT cookies signed with `jose` (HS256) and salted password hashing with `bcryptjs`. Minimum 32-character secret required in production.
- **Next.js 16 Proxy Architecture**: `src/proxy.ts` protects private routes with zero HMR WebSocket interference or UI flickering.
- **Rate Limiting**: Sliding-window rate limiters prevent brute-force login and registration abuse.
- **Formula Injection Sanitization**: All CSV and Excel imports/exports sanitize dangerous formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`).

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js 16 (React 19, Turbopack, App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 (Industrial Stark Graphite & Amber Palette) |
| **Database & ORM** | PostgreSQL (Supabase) via Prisma ORM |
| **Storage** | Supabase Private Object Storage Buckets |
| **Hosting** | Vercel (Hobby / Free Tier) |
| **Authentication** | `jose` JWT cookies + `bcryptjs` password hashing |
| **Data & Spreadsheets**| SheetJS (`xlsx`) + PapaParse (formula-injection protected) |
| **Icons & QR** | Lucide React + QRCode |

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/guhan-star/Component-Logger.git
cd Component-Logger
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET` (minimum 32 characters) are set.

### 3. Generate Prisma Client & Migrate
```bash
npx prisma generate
npx prisma migrate deploy
```

For offline local development, a SQLite dev schema is also provided:
```bash
npx prisma db push --schema=prisma/schema.sqlite.prisma
```

### 4. Seed Primary Operator Account
```bash
npx tsx scripts/seed-main-operator.ts
```

### 5. Run Verification Test Suite
```bash
npx tsx tests/multi-user-platform.test.ts
```

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Stark Industries control terminal.

---

## 📚 Documentation

- [Deployment Guide (Vercel & Supabase)](docs/DEPLOYMENT.md)
- [System Architecture & Security Invariants](docs/ARCHITECTURE.md)
- [Database Migration Guide](docs/DATABASE-MIGRATION.md)

---

## 📜 License

MIT License. Designed and engineered for **Stark Industries Warehouse Management & Control**.
