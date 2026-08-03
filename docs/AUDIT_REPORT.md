# Pre-Backend Architecture Audit Report

**Date:** 2026-08-03  
**Project:** stitch_souqna — Multi-language marketplace with Next.js  
**Scope:** Full architectural review before PostgreSQL migration  
**Method:** Layer-by-layer inspection, no code modifications (except unifying search)

---

## Repository Pattern

### Findings

| Check | Status | Details |
|---|---|---|
| Every feature goes through repositories only | ✅ | `adRepository`, `commentRepository`, `favoriteRepository`, `reactionRepository`, `reportRepository`, `searchRepository`, `userRepository` all used |
| No component accesses mockDb directly | ✅ | Components use hooks, hooks use services/repos |
| No  duplicated business logic |⚠️ | `engagement.ts` still manages its own `favorites` Set and `reactions` Map — duplicates the new repos |
| No hidden localStorage usage | ✅ | No localStorage calls found |
| No hidden in-memory stores outside the repository layer | ⚠️ | `services/engagement.ts` maintains its own `Map<string, AdEngagement>` store that overlaps with `favoriteRepository` and `reactionRepository` |

### Issue: Engagement service still owns state

**File:** `services/engagement.ts`  
  
**Severity:** Medium**Description:** `engagementService` maintains its own in-memory store (`Map<string, AdEngagement>`) with reactions, favorites, and views. Meanwhile, `favoriteRepository` and `reactionRepository` also manage their own separate stores in `db.favorites` and `db.reactions`. These two stores are **not synchronized**. The engagement service is the source of truth for UI components (via `useReactions`, `useFavorite`), while the repositories are not yet wired into these hooks.

**Affected files:**
- `services/engagement.ts`
- `hooks/useReactions.ts`
- `hooks/useFavorite.ts`

**Fix:** After PostgreSQL migration, remove the `engagementService` and route all reaction/favorite operations through the repository layer. For now this is a dead-weight issue, not a data corruption issue, because the hooks only use `engagementService`.

---

## API Layer

### Findings

| Check | Status | Details |
|---|---|---|
| Every Route Handler is backend-ready | ✅ | API routes under `app/api/` are thin controllers — they call services/repos and return JSON |
| No mock-specific logic leaking into APIs | ✅ | No `mockDb` references in API routes |
|  Correct HTTP methods |⚠️ | Some endpoints use POST for operations that should be GET (read operations) |
| Proper status codes | ⚠️ | Missing error status codes (404, 401, 403) in some routes |
| Consistent request/response contracts | ⚠️ | Response shapes vary between endpoints — no unified API response format |

**Affected files:**
- `app/api/ads/[id]/reactions/route.ts`
- `app/api/ads/[id]/favorites/route.ts
`
- `app/api/ads/[id]/stats/route.ts`- `app/api/search/route.ts`

**Fixes:**
1. Add `application/json` content-type headers to all responses
2. Wrap all responses in a consistent `{ success, data, error }` envelope
3. Use
 proper HTTP status codes for errors4. Consider using an API response middleware

---

## Data Models

### Findings

| Check | Status | Details |
|---|---|---|
| Types are PG-compatible | ⚠️ | `postedAgoHours` is a computed number, not a timestamp |
| Missing timestamps | ⚠️ | `Reaction` and `Favorite` types lack `createdAt ` |
| Missing foreign keys |ℹ️ | FKs are implied but not typed (will be enforced by PG, not TS) |
| Missing enums | ⚠️ | `ReactionType`, `AdStatus`, `UserRole` should be TS enums or discriminated unions |
| Missing indexes (future) | ℹ️ | Will need indexes on `userId`, `adId`, `createdAt` in PG |

### Specific Issues

1
. **Reaction type lacks `createdAt`**   - **File:** `types/index.ts`
   - **Severity:** Low
   - **Fix:** Add `createdAt: string` to `Reaction` type for PG mapping

2. **Favorite type lacks `createdAt`**
   - **File:** `types/index.ts`
   - **Severity:** Low  
   - **Fix:** Add `createdAt: string` to `Favorite` type (already present in mockDb, just not in the type)

3. **ReactionRow and FavoriteRow missing from types**
   - **Status:** ✅ Fixed — added `ReactionRow` and `FavoriteRow` types to `types/index.ts`

4. **AdStatus as string literal union**
   - **File:** `types/index.ts`
   - **Severity:** Info
   - **Suggestion:** Convert to a const enum or discriminated union for
     PG compatibility: ```ts
     export const AD_STATUS = {
       PENDING: 'pending',
       APPROVED: 'approved',
       REJECTED: 'rejected',
     } as const;
     export type AdStatus = typeof AD_STATUS[keyof typeof AD_STATUS];
     ```

5. **Missing enum for ReactionType**
   - **File:** `types/index.ts`
   - **Suggestion:**
     ```ts
     export const REACTION_TYPES = ['like', 'love', 'funny', 'wow', 'sad'] as const;
     export type ReactionType = typeof REACTION_TYPES[number];
     ```

---

## Authentication

### Findings

| Check | Status | Details |
|---|---|---|
| API compatible with Auth.js | ✅ | API routes accept `viewerId` as a parameter |
| No demo user dependency in APIs | ⚠️ | `engagement.ts` references `DEMO_VIEWER_ID = "u-1"` for seeding |
| Manual viewerId reading | ⚠️ | Hooks read `user?.id ?? null` from AuthContext — not Auth.js compatible |

### Issues

1. **DEMO_VIEWER_ID in engagement.ts**
   - **File:** `services/engagement.ts` (line 53)
   - **Severity:** Low
   - **Fix:** This is only used for seeding deterministic data. Replace with a real user ID from Auth.js session when migrating.

2. **Manual viewerId from AuthContext**
   - **Files:** `hooks/useReactions.ts`, `hooks/useFavorite.ts`, `hooks/useComments.ts`
   - **Severity:** Medium
   - **Description:** All hooks read `user?.id` from `AuthContext` directly. After Auth.js migration, this will be provided by the session object.
   - **Fix:** The AuthContext already wraps Auth.js session data — no architectural change needed. The pattern `user?.id ?? null` is compatible.

3. **Cookie-based auth helpers**
   - **Files:** `lib/serverAuth.ts`, `lib/cookies.ts`
   - **Status:** ✅ Already designed for server-side auth — compatible with Auth.js cookies

---

## Search

### Findings

| Check | Status | Details |
|---|---|---|
| synonymDictionary is SSoT | ✅ | `SYNONYM_GROUPS` in `services/search/synonymDictionary.ts` is the single source of truth |
| Search is backend-ready | ✅ | `searchRepository.ts` is a pure function — swap for a DB query later |
| Search does not depend on UI state | ✅ | No component state in search logic |
| Duplicate synonym map removed | ✅ Fixed | `searchRepository.ts` now uses `getSynonymMap()` from `synonymDictionary.ts` |

### Issues

1. **Dead code: `buildTermToSynonymGroupMap` / `getTermToSynonymGroupMap`**
   - **File:** `services/repositories/searchRepository.ts` (lines ~100-120)
   - **Severity:** Low
   - **Fix:** These functions are no longer called after the `getSynonymMap()` unification. Remove them.

2. **synonymDictionary.ts uses `require`**
   - **File:** `services/search/synonymDictionary.ts` (line 724)
   - **Severity:** Medium
   - **Description:** `getExpandedTokens` function uses `require("@/utils/search")` instead of a proper import. This works at runtime but breaks static analysis and tree-shaking.
   - **Fix:** Import `normalizeSearchText` directly from `@/utils/search`.

---

## Admin System

### Findings

| Feature | Repository | API | Admin Page | Backend-Ready |
|---|---|---|---|---|
| Approve | ✅ | ✅ | ✅ | ✅ |
| Reject | ✅ | ✅ | ✅ | ✅ |
| Pin | ✅ | ✅ | ✅ | ✅ |
| Unpin | ✅ | ✅ | ✅ | ✅ |
| Delete | ✅ | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ | ✅ |
| Audit Logs | ✅ | ✅ | ✅ | ✅ |
| Notifications | ℹ️ | ℹ️ | ✅ | ⚠️ |

### Issues

1. **Admin notifications lack repository**
   - **File:** `services/auditLogger.ts`
   - **Severity:** Low
   - **Description:** Audit logs are written to `db.auditLogs` directly. There is no `auditLogRepository`.
   - **Fix:** Create `auditLogRepository` before PostgreSQL migration.

2. **Admin page uses direct `db` access**
   - **Files:** `components/dashboard/AdminPage.tsx`
   - **Severity:** Low
   - **Description:** Admin page reads from `db.ads`, `db.reports`, `db.auditLogs` through repository functions — already compliant.
   - **Status:** ✅ Already uses repositories.

---

## Comments

### Findings

| Feature | Status |
|---|---|
| CRUD | ✅ |
| Replies (nested) | ✅ |
| Soft delete | ⚠️ |
| Repository | ✅ |
| API | ✅ |
| Permissions | ✅ |

### Issues

1. **Soft delete uses `isDeleted` flag**
   - **File:** `types/index.ts` — `Comment.isDeleted: boolean`
   - **Severity:** Info
   - **Note:** This is the correct approach for PostgreSQL — `is_deleted BOOLEAN NOT NULL DEFAULT FALSE`. No redesign needed.

2. **Reply structure uses `parentId`**
   - **File:** `types/index.ts` — `Comment.parentId`
   - **Status:** ✅ Correct for PG — maps to `parent_id UUID NULL REFERENCES comments(id)`

---

## Favorites

### Findings

| Feature | Status |
|---|---|
| Repository | ✅ (`favoriteRepository.ts`) |
| Persistence strategy | ✅ In-memory → replaceable with Drizzle |
| Future DB mapping | ✅ |

### Future PostgreSQL Mapping

```sql
CREATE TABLE favorites (
  id       TEXT PRIMARY KEY, -- 'fav-1', 'fav-2'
  user_id TEXT NOT NULL,     -- userId
  ad_id TEXT NOT NULL,       -- adId
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Unique constraint: (user_id, ad_id)
-- Index: user_id, ad_id
```

### Issues
- **None** — The repository interface and type (`FavoriteRow`) are designed correctly for PG migration.

---

## Reactions

### Findings

| Feature | Status |
|---|---|
| Repository | ✅ (`reactionRepository.ts`) |
| Future DB mapping | ✅ |
| UI compatibility | ✅ |

### Future PostgreSQL Mapping

```sql
CREATE TABLE reactions (
  id TEXT PRIMARY KEY,       -- 'reaction-1'
  ad_id TEXT NOT NULL,       -- adId
  user_id TEXT NOT NULL,     -- userId
  type TEXT NOT NULL CHECK (type IN ('like', 'love', 'funny', 'wow', 'sad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Unique constraint: (ad_id, user_id) — one reaction per user per ad
-- Index: ad_id, user_id
```

### Issues
- **None** — The repository interface and type (`ReactionRow`) are designed correctly for PG migration.

---

## Notifications

### Findings

| Feature | Status |
|---|---|
| Architecture | ✅ In-memory store, no repository yet |
| Future DB compatibility | ✅ |
| Auth.js compatibility | ✅ |

### Issues

1. **No notification repository**
   - **File:** `services/db/mockDb.ts` (notifications managed directly)
   - **Severity:** Medium
   - **Fix:** Create `notificationRepository` before PostgreSQL migration.

2. **Notification structure is PG-ready**
   - `Notification` type has `id`, `userId`, `type`, `message`, `read`, `createdAt`, `adId` — all map cleanly to PG columns.

---

## Reports

### Findings

| Feature | Status |
|---|---|
| Moderation flow | ✅ |
| Repository | ✅ (`reportRepository.ts`) |
| API | ✅ |
| Admin page | ✅ |

### Future PostgreSQL Mapping

```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Issues
- **None** — Reports architecture is solid.

---

## File Upload Architecture

### Findings

| Feature | Status |
|---|---|
| Cloudflare R2 ready | ✅ |
| Image URLs are external | ✅ |
| No UI redesign needed | ✅ |

### Issues

1. **Image URLs are external already**
   - **Files:** `types/index.ts` — `Product.image: string`
   - **Status:** ✅ URLs are strings — swap to Cloudflare R2 signed URLs when ready. No UI changes needed.

2. **No upload service exists yet**
   - **Severity:** Info
   - **Note:** Will need to create an upload service that integrates with Cloudflare R2 pre-signed URLs.

---

## Database Migration Readiness

### Repository Migration Readiness

| Repository | Ready for Drizzle | UI Impact |
|---|---|---|
| `adRepository` | ✅ | None |
| `commentRepository` | ✅ | None |
| `favoriteRepository` | ✅ | None |
| `reactionRepository` | ✅ | None |
| `reportRepository` | ✅ | None |
| `searchRepository` | ✅ | None |
| `userRepository` | ⚠️ | Minor |

### Issues

1. **userRepository has DirectoryUser type**
   - **File:** `services/repositories/userRepository.ts`
   - **Severity:** Medium
   - **Description:** `DirectoryUser` is a directory/seller type with `phone`, `location`. The `User` type in `types/index.ts` is different (extended profile with username fields). These two types need to be unified into a single `User` model for PG.
   - **Fix:** Merge `DirectoryUser` into `User` type, or create a repository that bridges between them.

---

## Performance

### Bottlenecks at Scale (100k users, 1M ads)

| Area | Status | Details |
|---|---|---|
| Search (in-memory iteration) | ❌ | `searchGlobalMixed` iterates ALL ads — O(n) per query. Will need PG full-text search. |
| Reaction/Favorite counts | ❌ | Computed per-ad from in-memory store. Needs aggregation in PG. |
| Ad listing (in-memory filter) | ⚠️ | `adRepository.listPublic()` filters entire array. Needs PG pagination + WHERE. |
|  Comment listing |⚠️ | `commentRepository.listByAd()` filters all comments. Needs PG query. |
| Engagement stats | ⚠️ | `engagementService.getStatsBatch()` iterates Map. Needs PG query. |

### Specific Bottlenecks

1. **No pagination in ad listing**
   - **File:** `services/repositories/adRepository.ts`
   - **Severity:** High
   - **Fix:** Add `limit`/`offset` parameters to `listPublic()` — this is critical for 1M+ ads.

2. **No pagination in comment listing**
   - **File:** `services/repositories/commentRepository.ts`
   - **Severity:** High
   - **Fix:** Add `limit`/`offset` to `listByAd()` — critical for popular ads.

3. **Search scales linearly with ad count**
   - **File:** `services/repositories/searchRepository.ts`
   - **Severity:** High
   - **Fix:** Replace with PostgreSQL full-text search (`to_tsvector` / `tsquery`).

---

## Code Smells

### Duplicated Code

1. **Duplicate synonym map builder**
   - **Files:** `services/repositories/searchRepository.ts` + `services/search/synonymDictionary.ts`
   - **Status:** ✅ Fixed — searchRepository now uses `getSynonymMap()`. The old functions are dead code (unused).

2. **`engagement.ts` and `favoriteRepository` both manage favorites**
   - **Files:** `services/engagement.ts`, `services/repositories/favoriteRepository.ts`
   - **Severity:** Medium
   - **Fix:** Unify on `favoriteRepository` after PG migration.

3. **`engagement.ts` and `reactionRepository` both manage reactions**
   - **Files:** `services/engagement.ts`, `services/repositories/reactionRepository.ts`
   - **Severity:** Medium
   - **Fix:** Unify on `reactionRepository` after PG migration.

4. **Duplicate DEMO_VIEWER_ID / CURRENT_USER_ID**
   - **Files:** `services/engagement.ts` (`DEMO_VIEWER_ID`), `services/products.ts` (`CURRENT_USER_ID`)
   - **Severity:** Low
   - **Fix:** Define once in `constants/demo.ts` or `lib/constants.ts`.

### Dead Code

1. **`buildTermToSynonymGroupMap` / `getTermToSynonymGroupMap` in searchRepository.ts**
   - **Severity:** Low
   - **Fix:** Remove these functions — no longer called.

2. **`tokenize` imported but unused in searchRepository.ts**
   - **File:** `services/repositories/searchRepository.ts` (line 63)
   - **Severity:** Low
   - **Fix:** Remove `tokenize` from the import.

### TODOs / Technical Debt

1. **`synonymDictionary.ts` uses `require`**
   - **File:** `services/search/synonymDictionary.ts` (line 724)
   - **Severity:** Medium
   - **Fix:** Proper import instead of `require`.

2. **`mockDb` types use `any`**
   - **File:** `services/db/mockDb.ts`
   - **Severity:** Low
   - **Fix:** Replace with proper types when creating repositories.

### Inconsistent Naming

1. **`userId` vs `user_id` vs `viewerId`**
   - **Severity:** Medium
   - **Description:** Codebase uses `userId` in types, `viewerId` in hooks, `user_id` in API paths. Unify on `userId` everywhere (TS layer) and let PG use `user_id` (SQL layer).

2. **`postedAgoHours` vs `createdAt`**
   - **Severity:** Low
   - **Description:** `Product` uses `postedAgoHours` (computed number) instead of `createdAt` (timestamp). PG should store `created_at TIMESTAMPTZ` and compute `postedAgoHours` in the presentation layer.

---

# Summary

## Critical Issues (MUST be fixed before backend)

None. The architecture is solid and does not block PostgreSQL migration.

## Recommended Improvements (should fix before production)

1. **Add pagination to `adRepository.listPublic()` and `commentRepository.listByAd()`** — critical for 100k+ users
2. **Unify `User` and `DirectoryUser` types** — prevents schema duplication in PG
3. **Remove dead code** — `buildTermToSynonymGroupMap`, `tokenize` import, duplicate DEMO_VIEWER_ID
4. **Fix `require` in `synonymDictionary.ts`** — proper ES module import
5. **Unify naming convention** — `userId` everywhere in TS layer
6. **Replace `postedAgoHours` with `createdAt` in data model** — compute in presentation layer
7. **Convert `AdStatus` and `ReactionType` to const enums** — better PG type safety

## Nice To Have

1. Add `auditLogRepository`
2. Add `notificationRepository`
3. Create unified API response envelope
4. Add Drizzle schema migration scripts
5. Add database index definitions

---

# Final Verdict

## Ready For PostgreSQL: **PASS**

The repository pattern is established, data models are PG-compatible, and hooks are abstraction-layer agnostic. The engagement service owns parallel state but it does not corrupt data.

## Ready For Drizzle: **PASS**

All repositories have async interfaces. Each repository can be rewritten as Drizzle queries without UI changes. The `FavoriteRow` and `ReactionRow` types are ready for Drizzle mapping.

## Ready For Auth.js: **PASS**

AuthContext provides `user?.id` which is Auth.js compatible. API routes accept user IDs as parameters. Server-side auth helpers already use cookies.

## Ready For Cloudflare R2: **PASS**

Image URLs are already strings. Swapping to R2 signed URLs requires only updating the URL source — no UI changes needed.

## Ready For Production: **FAIL**

### Why FAIL:

1. **No pagination** — At 100k users / 1M ads, the O(n) search and listing will time out. Pagination must be added before production.
2. **Duplicate state** — `engagement.ts` and the new repositories manage overlapping favorites/reactions state. This will cause inconsistency under real load.
3. **No audit log or notification repositories** — These will need to be created before production.
4. **No input validation middleware** — API routes accept raw body without validation at the middleware level.