# Backend Migration Report — Stitch Souqna

**Date:** 8/3/2026  
**Status:** ✅ Repository Layer Complete — Ready for Database Setup

---

## Table of Contents

1. [Completed Tasks](#completed-tasks)
2. [Database Schema](#database-schema)
3. [Repository Layer](#repository-layer)
4. [What Has Been Done](#what-has-been-done)
5. [What Remains](#what-remains)
6. [Next Steps](#next-steps)

---

## Completed Tasks

### 1. Database Schema Design (`drizzle/schema/`)

| File | Description | Status |
|---|---|---|
| `enums.ts` | All PostgreSQL ENUM types | ✅ Done |
| `tables.ts` | All 14 tables with columns, constraints, indexes | ✅ Done |
| `relations.ts` | Foreign keys and relations | ✅ Done |
| `index.ts` | Barrel export | ✅ Done |

#### Tables Created (14 total)

| # | Table | Columns | Primary Key | Notes |
|---|---|---|---|---|
| 1 | **users** | 13 columns | `id UUID` | UUID primary key, role enum, soft delete |
| 2 | **categories** | 8 columns | `slug TEXT` | Slug as PK, hidden flag, sort order |
| 3 | **products** | 22 columns | `id UUID` | FK→users, FK→categories, status enum, expiration |
| 4 | **ad_images** | 5 columns | `id UUID` | FK→products, isPrimary, sortOrder |
| 5 | **comments** | 8 columns | `id UUID` | FK→users, FK→products, self-reference for nesting |
| 6 | **reactions** | 5 columns | `id UUID` | FK→users, FK→products, composite unique (user+product+type) |
| 7 | **favorites** | 4 columns | `id UUID` | FK→users, FK→products, unique (user+product) |
| 8 | **reports** | 8 columns | `id UUID` | FK→users, FK→products, status enum |
| 9 | **notifications** | 7 columns | `id UUID` | FK→users, FK→products, type enum |
| 10 | **audit_logs** | 7 columns | `id UUID` | FK→users, action enum |
| 11 | **moderation_events** | 7 columns | `id UUID` | FK→users, action enum |
| 12 | **pins** | 6 columns | `id UUID` | FK→users, FK→products, expiry date |
| 13 | **user_settings** | 5 columns | `id UUID` | FK→users, unique (user_id) |
| 14 | **username_history** | 5 columns | `id UUID` | FK→users, tracks username changes |

#### ENUM Types Created (6 total)

| ENUM Name | Values | Used In |
|---|---|---|
| `ad_status` | pending, approved, rejected, hidden, expired, sold, deleted | products.status |
| `product_condition` | new, excellent, good, fair | products.condition |
| `notification_type` | ad_approved, ad_rejected, ad_expired, new_comment, new_reaction, report_resolved, pinned, featured | notifications.type |
| `report_status` | pending, reviewed, resolved | reports.status |
| `report_reason` | spam, inappropriate, wrong_category, fake, scam, other | reports.reason |
| `moderation_action` | created, edited, approved, rejected, hidden, unhidden, deleted, pinned, unpinned, featured, unfeatured, renewed | audit_logs.action, moderation_events.action |

#### Indexes Created

| Table | Index Name | Columns | Type |
|---|---|---|---|
| products | idx_products_owner_id | owner_id | B-tree |
| products | idx_products_status | status | B-tree |
| products | idx_products_category_status | category_slug, status | Composite |
| products | idx_products_pinned | pinned, pinned_at, created_at | Composite |
| products | idx_products_expires_at | expires_at | B-tree |
| ad_images | idx_ad_images_ad_id | ad_id | B-tree |
| ad_images | unique_ad_primary_image | ad_id, is_primary | Unique |
| comments | idx_comments_ad_id | ad_id | B-tree |
| comments | idx_comments_parent_id | parent_id | B-tree (self-reference) |
| comments | idx_comments_author_id | author_id | B-tree |
| comments | idx_comments_is_deleted | is_deleted | B-tree |
| reactions | idx_reactions_product_id | product_id | B-tree |
| reactions | idx_reactions_user_id | user_id | B-tree |
| reactions | unique_user_product_reaction | user_id, product_id, type | Unique |
| favorites | idx_favorites_ad_id | ad_id | B-tree |
| favorites | idx_favorites_user_id | user_id | B-tree |
| favorites | unique_user_favorite | user_id, ad_id | Unique |
| reports | idx_reports_ad_id | ad_id | B-tree |
| reports | idx_reports_reporter_id | reporter_id | B-tree |
| reports | idx_reports_status | status | B-tree |
| notifications | idx_notifications_user_id | recipient_id | B-tree |
| notifications | idx_notifications_ad_id | ad_id | B-tree |
| notifications | idx_notifications_is_read | is_read | B-tree |
| audit_logs | idx_audit_logs_actor_id | actor_id | B-tree |
| audit_logs | idx_audit_logs_target_id | target_id | B-tree |
| moderation_events | idx_moderation_events_ad_id | ad_id | B-tree |
| moderation_events | idx_moderation_events_actor_id | actor_id | B-tree |
| pins | idx_pins_ad_id | ad_id | B-tree |
| pins | idx_pins_owner_id | owner_id | B-tree |
| pins | idx_pins_expiry_date | expiry_date | B-tree |
| user_settings | unique_settings_user_id | user_id | Unique |

---

### 2. Utility Functions (`lib/db-utils.ts`)

| Function | Description |
|---|---|
| `delay<T>(data: T, ms?: number): Promise<T>` | Simulates database latency for realistic testing |
| `clone<T>(data: T): T` | Deep clones data to prevent mutation |

---

### 3. Repository Layer (`services/repositories/`)

All 10 repositories have been migrated from mockDb to Drizzle ORM:

| # | Repository | File | Methods | Status |
|---|---|---|---|---|
| 1 | **User** | `userRepository.ts` | 8 methods | ✅ Done |
| 2 | **Category** | `categoryRepository.ts` | 5 methods | ✅ Done |
| 3 | **Ad** | `adRepository.ts` | 21 methods | ✅ Done |
| 4 | **Comment** | `commentRepository.ts` | 10 methods | ✅ Done |
| 5 | **Reaction** | `reactionRepository.ts` | 6 methods | ✅ Done |
| 6 | **Favorite** | `favoriteRepository.ts` | 5 methods | ✅ Done |
| 7 | **Report** | `reportRepository.ts` | 6 methods | ✅ Done |
| 8 | **Notification** | `notificationRepository.ts` | 6 methods | ✅ Done |
| 9 | **Audit** | `auditRepository.ts` | 4 methods | ✅ Done |
| 10 | **Settings** | `settingsRepository.ts` | 3 methods | ✅ Done |

#### Ad Repository — Image Mapping

The ad repository includes a batch image loading system that prevents N+1 queries:

```typescript
// BEFORE: N+1 queries
// For 20 products = 1 products query + 20 image queries = 21 queries

// AFTER: 2 queries (batch loading)
// For 20 products = 1 products query + 1 batch image query = 2 queries
```

**How batch image loading works:**

1. Fetch products from `products` table
2. Collect all product IDs into an array
3. Single query: `SELECT * FROM ad_images WHERE ad_id IN ('id1', 'id2', ...)`
4. Group images by `ad_id`
5. Map images to each product:
   - `product.image` = primary image (`isPrimary=true`), fallback to first image
   - `product.images` = all images sorted by `isPrimary DESC, sortOrder ASC`

---

### 4. Audit Logger Service (`services/auditLogger.ts`)

Replaced mockDb direct writes with fire-and-forget Drizzle inserts:

| Method | Table | Description |
|---|---|---|
| `logAudit()` | audit_logs | Base fire-and-forget insert |
| `logModerationEvent()` | moderation_events | Base fire-and-forget insert |
| `logAdApproved()` | moderation_events | Convenience wrapper |
| `logAdRejected()` | moderation_events | Convenience wrapper |
| `logUserSuspended()` | audit_logs | Convenience wrapper |
| 25+ convenience methods | — | All existing wrappers preserved |

---

### 5. Build Fixes

| File | Issue | Fix |
|---|---|---|
| `users/[id]/page.tsx` | generateStaticParams queried DB at build time | Added `export const dynamic = 'force-dynamic'` |
| `category/[slug]/page.tsx` | generateStaticParams queried DB at build time | Added `export const dynamic = 'force-dynamic'` |

---

## Database Schema Details

### Full Schema ERD

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
     │   users      │1 │   products       │    1│ ad_images  │
│──────────────│─────│──────────────────│─────│──────────────│
│ id (PK)      │     │ id (PK)          │     │ id (PK)      │
    │ google_id    │     │ category_slug(FK)│ │ ad_id (FK)   │
│ email        │     │ owner_id (FK)    │     │ image_url    │
│ name         │     │ title            │     │ sort_order   │
│ username     │     │ description      │     │ is_primary   │
│ role         │     │ price            │     │ created _at   │
│ avatar       │     │ currency         │    └──────────────┘
│        bio          │     │ condition │
│ phone        │     │ location         │     ┌──────────────┐
│ joined_at    │     │ seller_name      │ 1   │  comments    │
│ created_at   │     │ seller_phone     │─────│──────────────│
      │ updated_at   │     │ status           │     │ id (PK)│
└──────────────┘     │ expires_at       │     │ ad_id (FK          )   │
                     │ pinned │     │ author_id(FK)│
                     │ pinned_at        │     │ parent_id(FK)│
                     │ rejection_reason │             │ body │
                     │ admin_notes      │     │ is_deleted   │
                      └──────────────────┘     │ created_at  │
┌──────────────────   ┐                         └──────────────┘
│ categories     │
│────────    ──────────│ ┌──────────────┐     ┌──────────────┐
│ slug (PK)        │ 1   │  reactions   │    1│  favorites   │
│ name             │─────│──────────────│─────│──────────────│
│ name_en          │     │ id (PK)      │     │ id (PK)      │
│ name_ar          │     │ user_id (FK) │     │ user_id (FK) │
│ icon             │     │ product_id(FK│     │ ad_id (FK)   │
│ order            │     │ type         │     │ created     _at   │
│ hidden           │     │ created_at   │└──────────────┘
│ created_at       │     └──────────────┘
│ updated_at       │
└──────────────────┘     ┌──────────────┐

┌──────────────┐     ┌──────────────────┐
│   reports    │     │  notifications   │
│──────────────│     │──────────────────│
│ id (PK)      │     │ id (PK)          │
│ ad_id (FK)   │     │ recipient_id(FK) │
│ reporter_id(FK)│   │ ad_id (FK)       │
│             reason       │     │ type │
│ status       │     │ title            │
│  description │     │ body             │
│  created_at   │     │ is_read         │
└──────────────
                     ┘     │ created_at       │└──────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  audit_logs      │     │moderation_events │     │    pins      │
│──────────────────│     │──────────────────│     │──────────────│
│ id (PK)          │     │ id (PK)          │     │ id (PK)      │
│ actor_id (FK)    │     │ actor_id (FK)    │     │ owner_id(FK) │
│ action           │     │ action           │     │ ad_id  (FK)  │
│ target_type      │     │ target_type      │     │ is_pinned    │
│ target_id  (FK)  │     │ target_id  (FK)  │     │ expiry_date  │
│ note             │     │ note             │     │ created_at   │
│ created_at       │     │ created_at       │     └──────────────┘
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ user_settings    │     │username_history  │
│──────────────────│     │──────────────────│
│ id (PK)          │     │ id (PK)          │
│ user           _id  (FK)    │     │ user_id  (FK)    │
│ theme │     │ username         │
        │ language │     │ changed_at       │
│ created_at       │     │ expires_at       │
└──────────────────┘     └──────────────────┘
```

---

## What Has Been Done

### ✅ Database Schema

- [x] 6 ENUM types defined
- [x] 14 tables created with proper columns
- [x] All primary keys are UUID
- [x] All foreign keys defined with proper constraints
- [x] 30+ indexes created for performance
- [x] Soft delete fields on products, comments
- [x] Expiration dates on products, pins
- [x] Timestamps on all tables

### ✅ Repository Layer

- [x] 10 repositories migrated from mockDb to Drizzle
- [x] All 73 methods implemented
- [x] Image batch loading (N+1 fix)
- [x] delay/clone utilities extracted
- [x] Audit logging replaced with Drizzle
- [x] All repositories compile without errors

###

 ✅ Build- [x] `npm run lint` — passes (only pre-existing img warnings)
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run build` — 71 pages compiled successfully

### ✅ Files Created/Modified

| Category | Files |
|---|---|
| Schema | `drizzle/schema/enums.ts`, `tables.ts`, `relations.ts`, `index.ts` |
| Utils | `lib/db-utils.ts` |
| Repositories | All 10 files in `services/repositories/` |
| Audit | `services/auditLogger.ts` |
| Build Fixes | `users/[id]/page.tsx`, `category/[slug]/page.tsx` |

---

## What Remains

### 🔴 Database Setup (CRITICAL — Must Do First)

| Step | Command | Description |
|---|---|---|
| 1 | Set DATABASE_URL | Configure `.env.local` with Neon or local PostgreSQL |
| 2 | `npx drizzle-kit generate` | Generate migration files from schema |
| 3 | `npx drizzle-kit push` | Apply schema to database |
| 4 | Seed data | Insert initial categories, demo  users if needed |

###🟡 API Route Updates (High Priority)

| API Route | Repository | Status |
|---|---|---|
| `/api/ads` | adRepository.create | ✅ Done |
| `/api/ads/[id]` | adRepository.update/remove | ✅ Done |
| `/api/ads/[id]/approve` | adRepository.approve | ✅ Done |
| `/api/ads/[id]/reject` | adRepository.reject | ✅ Done |
| `/api/ads/[id]/reactions` | reactionRepository | ✅ Done |
| `/api/ads/[id]/favorites` | favoriteRepository | ✅ Done |
| `/api/ads/[id]/comments/*` | commentRepository | ✅ Done |
| `/api/users` | userRepository | ✅ Done |
| `/api/users/[id]` | userRepository | ✅ Done |
| `/api/categories` | categoryRepository | ✅ Done |
| `/api/categories/[slug]` | categoryRepository | ✅ Done |
| `/api/settings` | settingsRepository | ✅ Done |

**Note:** API routes already import repositories. The repository calls will work once the database is connected.

### 🟡 Image Upload to Cloudflare R2 (Medium Priority)

| Step | Description |
|---|---|
| 1 | Install `@cloudflare/workers-types` |
| 2 | Configure R2 bucket in `.env.local` |
| 3 | Create image upload API route |
| 4 | Store returned R2 URL in `ad_images.image_url` |
| 5 | Frontend already expects `product.image` and `product.images` |

### 🟡 Authentication with Auth.js (Medium Priority)

| Step | Description |
|---|---|
| 1 | Install `@auth/core`, `next-auth` |
| 2 | Configure Google OAuth provider |
| 3 | Create `/api/auth/[...auth]` route |
| 4 | Migrate from cookie-based demo auth |
| 5 | Update `lib/serverAuth.ts` |

### 🟢 Admin Dashboard (Low Priority)

| Feature | Repository | Status |
|---|---|---|
| Ad moderation | adRepository.list/pending/reported | ✅ Repo Done |
| User management | userRepository.list | ✅ Repo Done |
| Category management | categoryRepository | ✅ Repo Done |
| Report management | reportRepository | ✅ Repo Done |
| Audit log viewer | auditRepository.getAuditLog | ✅ Repo Done |
| Pin system | adRepository.setPinned | ✅ Repo Done |

### 🟢 Features to Implement (Low Priority)

| Feature | Description |
|---|---|
| Email notifications | Send email on ad approval/rejection |
| Password hashing | bcrypt/argon2 for user passwords |
| Rate limiting | API rate limiting middleware |
| Pagination | Cursor-based or offset pagination |
| Search | Full-text search with PostgreSQL |
| Cache layer | Redis for hot data |
| Background jobs | Cron for expired ads cleanup |

---

## Next Steps (In Order)

### Phase 1: Database Setup (DO THIS NOW)

```bash
# 1. Set up Neon database
# Go to https://neon.tech → Create project → Copy connection string

# 2. Update .env.local
DATABASE_URL=postgresql://xxx@ep-yyy.us-east-1.postgres.neon.tech/souqna

# 3. Generate and apply migration
npx drizzle-kit generate
npx drizzle-kit push

# 4. Test connection
npm run dev
```

### Phase 2: Verify API Routes

```bash
# Start dev server
npm run  dev

# Test basic endpoints:
# GET /api/categories
# POST /api/ads
# GET  /api/users
```

### Phase 3: Image Upload

```bash
# Create upload endpoint
# POST /api/upload/image
# Store in R2, save URL to ad_images table
```

### Phase 4: Authentication

```bash
# Install Auth.js
npm install @auth/core next-auth

# Configure Google OAuth
# Create /api/auth/[...auth] route
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  Pages + Components + Hooks + i18n                          
                             │
└────────────────────────────┬────────────────────────────────┘ │
                             ▼
┌────────────────────────────────────────────────────────────                        ─┐
│                    API Routes (/api/) │
│                      Each route calls one or more repositories│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                            │
│ 10 repositories — 73 methods total                           │
                   │  All use Drizzle ORM, no mockDb references│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                                                Drizzle Schema │
│   14 tables + 6 enums + 30+ indexes                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Neon / Local)                        │
│  Data stored with proper relations, constraints, indexes     │
└─────────────────────────────────────────────────────────────┘
```

---

## Final Checklist

| Area | Status |
|---|---|
| Database schema | ✅ Complete |
| Repository layer | ✅ Complete |
| Image batch loading (N+1 fix) | ✅ Complete |
| Audit logging | ✅ Complete |
| Build passes | ✅ Complete |
| Database connection | 🔴 Pending |
| API route testing | 🔴 Pending |
| Cloudflare R2 upload | 🔴 Pending |
| Auth.js migration | 🔴 Pending |
| Email notifications | 🟢 Future |
| Password hashing | 🟢 Future |
| Rate limiting | 🟢 Future |
| Pagination | 🟢 Future |
| Full-text search | 🟢 Future |

---

**Generated:** 8/3/2026  
**Repository Count:** 10  
**Method Count:** 73  
**Table Count:** 14  
**Enum Count:** 6  
**Index Count:** 30+