# Stark Industries WMC — Component Logger

An industrial-grade, local-first inventory management and control system for electronic components, laboratory stock, custody tracking, and procurement pipelines. Built with **Next.js 16 (App Router, Turbopack)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM with SQLite**.

---

## 🌟 Key Features

### 1. 📦 Electronic Component Inventory Management
- **Hardware Catalog**: Track SKU/Component ID, MPN, generic part numbers, specifications, condition, and unit valuation (INR).
- **Dynamic Stock Balances**: Real-time KPI metrics for Owned, Available, Reserved, In-Use, Lent Out, and Borrowed items.
- **Search & Advanced Filters**: Multi-criteria filtering by ownership (`Mine` vs `Borrowed`), type/category, and status.
- **Quick Stock Adjustments**: Instant stock in/out adjustments with audit logs.
- **Storage QR Codes**: Auto-generated QR codes encoding component data for instant labeling and physical part scanning.

### 2. 🔐 Authentication & Role-Based Access Control (RBAC)
- **Secure Operator Terminal**: Tamper-proof session management using signed HTTP-only JWT cookies (`jose`) and salted hashing (`bcryptjs`).
- **Operator Main Account**: Complete administrative control to manage inventory, audit logs, and system settings.
- **Next.js 16 Proxy Architecture**: Route guard protection with zero-leak redirection.

### 3. 🤝 Custody & Loans Tracking
- **Borrowed Assets**: Record equipment and ICs borrowed from peers with expected return dates.
- **Lent Out Components**: Track parts lent to team members with automatic stock reservation.
- **1-Click Return Workflow**: Instant stock replenishment and loan status reconciliation.

### 4. 📁 Projects & Bill of Materials (BOM)
- **Project Tracking**: Manage embedded system builds and hardware projects.
- **BOM Stock Reservation**: Directly reserve parts from warehouse stock for active builds.

### 5. 🛒 Purchase List & Pipeline
- **Replenishment Pipeline**: Track needed parts from initial request through ordering and delivery.
- **1-Click Intake**: Add received items directly into warehouse inventory.

### 6. 📄 Receipt Review & Assisted Component ID
- **Invoice Line Item Review**: Stage and commit multiple line items from supplier bills.
- **Assisted IC Identification**: Search and cross-reference visible chip markings against existing stock.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (React 19, Turbopack, App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (Industrial Dark Stark Palette)
- **Database & ORM**: SQLite via Prisma ORM (`prisma/schema.prisma`)
- **Authentication**: `jose` JWT cookies + `bcryptjs`
- **Spreadsheets & Data**: SheetJS (`xlsx`) + PapaParse
- **Icons & QR**: Lucide React + QRCode

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/guhan-star/Component-Logger.git
cd Component-Logger
npm install
```

### 2. Set Up Database & Seed Operator Account
```bash
npx prisma db push
npx tsx scripts/seed-main-operator.ts
```

### 3. Launch Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 🔑 Default Credentials
- **Username / Email**: `operator@stark.wmc` (or `operator`)
- **Password**: `operator123`

---

## 🧪 Automated Testing

Run the automated integration tests:
```bash
# Test authentication and session route guards
npx tsx tests/auth-test.ts

# Test inventory lifecycle and transactions
npx tsx tests/api-test.ts
```

---

## 🗄️ Backup & Restore Guide

Your complete database resides in SQLite:
```
prisma/dev.db
```
- **To Back Up**: Copy `prisma/dev.db` to your backup drive or cloud storage.
- **To Restore**: Replace `prisma/dev.db` with your backup copy. No external database services or cloud connections required!

