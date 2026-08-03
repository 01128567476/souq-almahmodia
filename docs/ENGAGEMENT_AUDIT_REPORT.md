# Focused Audit: services/engagement.ts

**Date:** 2026-08-03


**Scope:** Services/engagement.ts only---

## 1. Does engagement.ts still own any state?

**YES.** `services/engagement.ts` owns **4 state containers**:

| # | State | Type | Line | Purpose |
|---|---|---|---|---|
| 1 | `store` | `Map<string, AdEngagement>` | Line 71 | Master store keyed by adId |
| 2 | `AdEngagement.reactions` | `Map<string, ReactionType>` | Line 65 (inside AdEngagement interface) | userId → reaction type per ad |
| 3 | `AdEngagement.favorites` | `Set<string>` | Line 68 (inside AdEngagement interface) | userIds who favorited per ad |
| 4 | `AdEngagement.views` | `number` | Line 66 | View count per ad |

Additionally, it seeds **synthetic data** via `ensureSeeded()` (lines 84-111), which creates deterministic `Map` and `Set` entries for every ad ID that is ever touched.

---

## 2. Does engagement.ts keep duplicate copies of reactions, favorites, engagement stats?

**YES. Complete duplicate.**

| Data | Owned by engagement.ts | Owned by reactionRepository | Owned by favoriteRepository |
|---|---|---|---|
| Reactions | `store.get(adId).reactions` (Map userId→type) | `db.reactions` (array of ReactionRow) | N/A |
| Favorites | `store.get(adId).favorites` (Set of userIds) | N/A | `db.favorites` (array of FavoriteRow) |
| Views | `store.get(adId).views` (number) | N/A | N/A |
| Engagement stats | Computed from `store` in `toStats()` | Computed in `getSummary()` | Computed in `countByAd()` |

**These two stores are NOT synchronized.** They write to different data structures:
- `engagement.ts` → `store: Map<string, AdEngagement>`
- `reactionRepository` → `db.reactions: ReactionRow[]`
- `favoriteRepository` → `db.favorites: FavoriteRow[]`

**Result:** If `reactionRepository.add()` creates a reaction in `db.reactions`, `engagementService.getReactions()` will NOT see it. They are two completely separate data stores.

---

## 3. Complete Data Flow Trace

### Reactions

```
UI (Reaction buttons, ad card)
  ↓
useReactions hook (hooks/useReactions.ts)
  ↓
engagementService.getReactions() / .setReaction() / .removeReaction()
  ↓
store.get       (adId).reactions (Map) ← engagement.ts OWN STATE
```

**Does NOT go through reactionRepository.**

The reactionRepository exists but is **never imported or called** by useReactions.

### Favorites

```
UI (Heart button, ad card)
  ↓
useFavorite hook (hooks/useFavorite.ts)
  ↓
engagementService.addFavorite() / .removeFavorite()
  ↓
store.get(adId).favorites (Set)        ← engagement.ts OWN STATE
```

**Does NOT go through favoriteRepository.**

The favoriteRepository exists but is **never imported or called** by useFavorite.

### Engagement Stats

```
UI (Ad card stats, My Ads page)
  ↓
useEngagementStatsBatch hook (hooks/useEngagementStats.ts)
  ↓
engagementService.getStatsBatch()
                         ↓
store.get(adId) ← engagement.ts OWN STATE

  ↓
toStats() — computes views, reactions, comments, favorites```

**Does NOT go through any repository.** The `toStats()` function:
- Reads `ad.views` from `store`
- Reads `ad.reactions.size` from `store`
- Reads `ad.favorites.size` from `store`
- Calls `commentRepository.countByAd()` for comments ✅ (this one uses repo)

### Comments

```
UI (Comment form, comment list)
  ↓
commentRepository (services/repositories/commentRepository.ts)
  ↓
db.comments
 (array)                    ← mockDb.ts```

✅ Comments already go through the repository. No engagement.ts dependency.

---

## 4. Write Operations Audit

| Write Operation | Source File | Line | Goes Through Repository? |
|---|---|---|---|
| `engagementService.setReaction()` | services/engagement.ts | 154-161 | ❌ Writes directly to `store.get(adId).reactions` |
| `engagementService.removeReaction()` | services/engagement.ts | 165-168 | ❌ Writes directly to `store.get(adId).reactions` |
| `engagementService.addFavorite()` | services/engagement.ts | 194-197 | ❌ Writes directly to `store.get(adId).favorites` |
| `engagementService.removeFavorite()` | services/engagement.ts | 201-204 | ❌ Writes directly to `store.get(adId).favorites` |
| `engagementService.recordView()` | services/engagement.ts | 208-211 | ❌ Writes directly to `store.get(adId).views` |
| `reactionRepository.upsert()` | services/repositories/reactionRepository.ts | 43-61 | ✅ Writes to `db.reactions` |
| `reactionRepository.remove()` | services/repositories/reactionRepository.ts | 67-71 | ✅ Writes to `db.reactions` |
| `favoriteRepository.add()` | services/repositories/favoriteRepository.ts | 63-76 | ✅ Writes to `db.favorites` |
| `favoriteRepository.remove()` | services/repositories/favoriteRepository.ts | 82-86 | ✅ Writes to `db.favorites` |

**Conclusion:** Every write to reactions/favorites/views goes through `engagementService` directly, bypassing both `reactionRepository` and `favoriteRepository`.

---

## 5. Read Operations Audit

| Read Operation | Source File | Line | Reads From |
|---|---|---|---|
| `engagementService.getReactions()` | services/engagement.ts | 148-150 | `store` (engagement.ts state) |
| `engagementService.getStats()` | services/engagement.ts | 173-175 | `store` (engagement.ts state) |
| `engagementService.getStatsBatch()` | services/engagement.ts | 179-188 | `store` (engagement.ts state) |
| `useReactions()` | hooks/useReactions.ts | 34-44 | `engagementService` |
| `useFavorite()` | hooks/useFavorite.ts | 52-54 | `engagementService` |
| `useEngagementStatsBatch()` | hooks/useEngagementStats.ts | 36-37 | `engagementService` |

**Every UI component that reads reaction/favorite/stat data reads from `engagementService`, which reads from `store` — NOT from repositories.**

---

## 6. State Pattern Search

### `new Map(` in project (non-node_modules)

| File | Line | Purpose | Affects Reactions/Favorites? |
|---|---|---|---|
| `services/engagement.ts` | 71 | `const store = new Map<string, AdEngagement>()` | **YES** — master store |
| `services/engagement.ts` | 89 | `const reactions = new Map<string, ReactionType>()` | **YES** — per-ad reactions |
| `services/engagement.ts` | 96 | `const favorites = new Set<string>()` | **YES** — per-ad favorites |
| `utils/search.ts` | — | `categoryNames: Map<string, string>` | No |
| `lib/validation.ts` | — | `RESERVED_USERNAMES = new Set([...])` | No |
| `lib/usernameValidator.ts` | — | `RESERVED_USERNAMES = new Set([...])` | No |
| `hooks/useClientSearch.ts` | — | `categoryNames = new Map()` | No |
| `services/repositories/adRepository.ts` | — | `expiredSet = new Set(expiredAdIds)` | No |
| `services/repositories/searchRepository.ts` | — | `originalSet = new Set(originalTokens)` | No |
| `services/repositories/reportRepository.ts` | — | `ids = new Set(adIds)` | No |

### `CURRENT_USER_ID` / `DEMO_VIEWER_ID` / `DEMO_ADMIN_ID` usage

| File | Line | Purpose | Affects Reactions/Favorites? |
|---|---|---|---|
| `services/engagement.ts` | 53 | `const DEMO_VIEWER_ID = "u-1"` | **YES** — seeds demo favorites |
| `services/products.ts` |  3,15 | `import { CURRENT_USER_ID }` | No — only for ad ownership |
| `constants/demo.ts` | — | `export const CURRENT_USER_ID = DEMO_USER_ID` | No — re-export |
| `app/api/ads/route.ts` | — | `ownerId: CURRENT_USER_ID` | No — ad creation |
| `app/api/ads/[id]/approve/route.ts` | — | `actorId: DEMO_ADMIN_ID` | No — admin action |
| `lib/serverAuth.ts` | — | `DEMO_ADMIN_ID, DEMO_USER_ID` | No — auth helper |

**Key finding:** `DEMO_VIEWER_ID = "u-1"` in `engagement.ts` line 53 is used to seed deterministic favorites (line 102: `favorites.add(DEMO_VIEWER_ID)`). This mirrors `CURRENT_USER_ID` from `constants/demo.ts` — duplicate definition.

---

## 7. Should engagement.ts be deleted or wrapped?

**Answer: A) Remain as a thin compatibility wrapper — for now.**

### WHY it cannot be deleted yet:

1. **All 3 hooks import directly from `engagementService`:**
   - `hooks/useReactions.ts` — imports `engagementService`, calls `.getReactions()`, `.setReaction()`, `.removeReaction()`, `.getReactions()` (retry)
   - `hooks/useFavorite.ts` — imports `engagementService`, calls `.addFavorite()`, `.removeFavorite()`
   - `hooks/useEngagementStats.ts` — imports `engagementService`, calls `.getStatsBatch()`

2. **No API routes exist for reactions or favorites:**
   - `app/api/ads/[id]/reactions/route.ts` — **DOES NOT EXIST**
   - `app/api/ads/[id]/favorites/route.ts` — **DOES NOT EXIST**
   - `app/api/ads/[id]/stats/route.ts` — **DOES NOT EXIST**

3. **The hooks call `engagementService` directly from the browser** — this is a client-side in-memory service, not an API client. It has no network layer.

4. **Deleting it today would break:**
   - `useReactions()` hook → reaction buttons on every ad card
   - `useFavorite()` hook → heart toggle on every ad card
   - `useEngagementStatsBatch()` hook → view/reaction/comment/favorite counts on every ad card

### WHY it should remain as a wrapper:

The `engagementService` interface IS the contract the UI depends on:
```ts
getReactions(adId, viewerId) → Promise<ReactionSummary>
setReaction(adId, viewerId, type) → Promise<ReactionSummary>
removeReaction(adId, viewerId) → Promise<ReactionSummary>
getStats(adId, viewerId) → Promise<EngagementStats>
getStatsBatch(adIds, viewerId) → Promise<Record<string, EngagementStats>>
addFavorite(adId, viewerId) → Promise<EngagementStats>
removeFavorite(adId, viewerId) → Promise<EngagementStats>
recordView(adId) → Promise<void>
```

When the backend is ready, these method bodies can be replaced with `fetch(API_ROUTES.reactions(adId))` calls — **zero UI changes required**.

### When to delete:

Delete `engagement.ts` ONLY when:
1. API routes exist: `/api/ads/[id]/reactions`, `/api/ads/[id]/favorites`, `/api/ads/[id]/stats`
 2. All3 hooks are updated to call `fetch()` or a new `engagementApi` client instead of `engagementService`
3. `reactionRepository` and `favoriteRepository` are replaced with Drizzle queries

---

## 8. Migration Readiness

### Can reactionRepository connect to Drizzle → PostgreSQL without changing UI?

**YES.**

The `reactionRepository` interface:
```ts
upsert(input: { adId, userId, type }) → Promise<void>
remove(adId, userId) → Promise<void>
listByAd(adId) → Promise<ReactionRow[]>
get(adId, userId) → Promise<ReactionRow | null>
getViewerReactionType(adId, userId) → Promise<ReactionType | null>
getSummary(adId, viewerId) → Promise<ReactionSummary>
listByUser(userId) → Promise<ReactionRow[]>
```

- All methods are async ✅
- All return types map directly to Drizzle schema ✅
- `ReactionRow` type in `types/index.ts` has `{ id, adId, userId, type, createdAt }` ✅
- No UI component imports `reactionRepository` directly — hooks would need to be updated to call the repository instead of `engagementService`

**Prerequisite:** Update `useReactions()` hook to call `reactionRepository` instead of `engagementService`.

### Can favoriteRepository connect to Drizzle → PostgreSQL without changing UI?

**YES.**

The `favoriteRepository` interface:
```ts
add(input: { userId, adId }) → Promise<boolean>
remove(adId, userId) → Promise<void>
isFavorited(adId, userId) → Promise<boolean>
listByUser(userId) → Promise<FavoriteRow[]>
countByAd(adId) → Promise<number>
countByUser(userId) → Promise<number>
```

- All methods are async ✅
- All return types map directly to Drizzle schema ✅
- `FavoriteRow` type in `types/index.ts` has `{ id, userId, adId, createdAt }` ✅
- No UI component imports `favoriteRepository` directly — hooks would

 need to be updated**Prerequisite:** Update `useFavorite()` hook to call `favoriteRepository` instead of `engagementService`.

---

# Final Verdict

## Remaining Duplicate State

```
engagement.ts owns:
  store: Map<adId, { reactions: Map<userId, type>, favorites: Set<userId>, views: number }>

reactionRepository owns:
  db.reactions: ReactionRow[]

favoriteRepository owns:

  db.favorites: FavoriteRow[]```

All three are **independent and unsynchronized**. Writing to one is invisible to the others.

## Remaining Dependencies

| Component | Depends On | Does NOT Use |
|---|---|---|
| `useReactions()` | `engagementService` | `reactionRepository` |
| `useFavorite()` | `engagementService` | `favoriteRepository` |
| `useEngagementStatsBatch()` | `engagementService` | N/A |
| API routes (none for reactions/favorites) | N/A | N/A |

## Safe To Delete engagement.ts?

**NO**

**Reason:** All 3 hooks (`useReactions`, `useFavorite`, `useEngagementStatsBatch`) import directly from `engagementService`. Deleting it would break every ad card's reaction buttons, heart toggle, and view/reaction/favorite counts.

**When safe to delete:** After API routes + hook updates are in place.

## Safe To Start PostgreSQL Migration?

**NO**

**Files that must be fixed first:**

1. **`hooks/useReactions.ts`** — Must stop calling `engagementService` and start
 calling `reactionRepository`2. **`hooks/useFavorite.ts`** — Must stop calling `engagementService` and start calling `favoriteRepository`
3. **`hooks/useEngagementStats.ts`** — Must be rewritten to query an API endpoint (no repository equivalent exists for stats)
4. **`services/engagement.ts`** — Either deleted (if hooks use repos/API) or converted to an API client wrapper
5. **Create API route:** `app/api/ads/[id]/reactions/route.ts` (POST to upsert, GET to fetch)
6. **Create API route:** `app/api/ads/[id]/favorites/route.ts` (POST to add, DELETE to remove)
7. **Create API route:** `app/api/ads/[id]/stats/route.ts` (GET to fetch engagement stats)

**After these 7 files are fixed:** PostgreSQL migration is safe.