# Stark Industries WMC — System Architecture

## Overview
**Stark Industries Warehouse Management & Control (WMC)** is a public cloud platform designed for multi-user electronic component management, inventory tracking, and collaborative hardware Bill of Materials (BOM) creation.

---

## 1. Multi-Tenant Zero-Leakage Data Model

```
                    ┌─────────────────────────┐
                    │    Authenticated User   │
                    └────────────┬────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
     ▼                           ▼                           ▼
┌──────────────┐         ┌──────────────┐            ┌──────────────┐
│   Private    │         │   Friends &  │            │ Collaborative│
│  Inventory   │         │  Discovery   │            │   Projects   │
└──────────────┘         └──────────────┘            └───────┬──────┘
                                                             │
                                                  ┌──────────┴──────────┐
                                                  ▼                     ▼
                                           ┌──────────────┐      ┌──────────────┐
                                           │  Team Roster │      │ Snapshot BOM │
                                           │  (Max 6 Mem) │      │  Allowlist   │
                                           └──────────────┘      └──────────────┘
```

### Key Security Invariants
1. **Zero Cross-Tenant Leakage**: Every inventory query is strictly scoped by `userId: session.user.id`.
2. **Private User Discovery**: User discovery requires an **exact username match**. There is no public user directory, browse-all interface, or email lookup.
3. **Canonical Friendship Model**: Friendships between two users `A` and `B` are uniquely indexed using canonical ordered IDs: `user1Id = min(A, B)` and `user2Id = max(A, B)`.
4. **Strict Team Cap**: Projects permit **at most 6 members total** (1 Owner + 5 Members). Acceptance is gated by an ACID transaction that verifies the member count before insertion.
5. **Snapshot-Based Collaborative BOM**: When an operator shares a component from their private inventory into a collaborative project BOM, the platform creates an immutable snapshot of approved technical fields only.

---

## 2. BOM Snapshot Allowlist vs. Private Field Separation

| Field Category | Copied to Collaborative BOM Snapshot | Kept 100% Private in Owner's Inventory |
|---|:---:|:---:|
| **Component Name** | ✅ Yes | — |
| **Category & Subcategory** | ✅ Yes | — |
| **Manufacturer & MPN** | ✅ Yes | — |
| **Model & Description** | ✅ Yes | — |
| **Technical Specifications (JSON)** | ✅ Yes | — |
| **Image & Datasheet URLs** | ✅ Yes | — |
| **Team BOM Notes** | ✅ Yes | — |
| **Quantity Required for Project** | ✅ Yes | — |
| **Available Stock / On-Hand Quantity** | ❌ **NEVER** | ✅ Private |
| **Purchase Price & Currency** | ❌ **NEVER** | ✅ Private |
| **Purchase Date** | ❌ **NEVER** | ✅ Private |
| **Supplier Name & Vendor Account** | ❌ **NEVER** | ✅ Private |
| **Storage Bin / Physical Location** | ❌ **NEVER** | ✅ Private |
| **Receipts & Invoices** | ❌ **NEVER** | ✅ Private |
| **Owner's Private Inventory Notes** | ❌ **NEVER** | ✅ Private |

---

## 3. Server-Side Authentication & Session Flow

1. **Password Security**: Passwords are hashed using `bcryptjs` with salt rounds = 12.
2. **Stateless JWT Sessions**: Sessions are encrypted and verified using `jose` with `HS256`. Minimum 32-character high-entropy secret enforced in production.
3. **HTTP-Only Cookies**: JWTs are stored exclusively in HTTP-only, secure, SameSite=Lax cookies, completely inaccessible to browser JavaScript.
4. **App Router Proxy (`src/proxy.ts`)**: Replaces legacy middleware to intercept protected routes while allowing Next.js dev server WebSockets and static assets without recursion or flickering.
5. **Rate Limiting**: Critical endpoints (`/api/auth/login`, `/api/auth/register`, `/api/friends/requests`, `/api/friends/search`) use sliding-window in-memory IP rate limiting to prevent brute force and enumeration.
