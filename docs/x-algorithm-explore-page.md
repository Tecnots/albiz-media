# X-Algorithm: Explore Page Implementation

**Project:** Albiz Media
**Page:** /explore
**Status:** Production Ready
**Date:** June 2026

---

## 1. What Changed

Before this implementation, the Explore page:
- Fetched all users unranked (ordered by database ID ascending)
- Did all filtering and sorting client-side with simple string matching
- Showed every user type (NORMAL, CIRCLE, AUTHOR, ADMIN) with no distinction
- Had no personalization — anonymous and signed-in users saw identical results
- Had no pagination — loaded everyone at once

After this implementation:
- Server-side ranking using an additive scoring formula
- Only CIRCLE and AUTHOR users appear (the professional discovery surface)
- Personalization for signed-in users via mutual follows, affinity history, interest tags
- Stable ranks that do not change on refresh
- Infinite scroll with cursor-based pagination (20 per page)

---

## 2. Architecture

```
User opens Explore page
        │
        ▼
Browser sends GET /api/explore/users?tab=all&sub=top&cursor=0&limit=20
        │
        ▼
┌─────────────────────────────────────────────────┐
│          /api/explore/users  (server-side)       │
│                                                 │
│  Step 1: Load user context (parallel)           │
│  ├── Following IDs                              │
│  └── Interest tags                              │
│                                                 │
│  Step 2: Fetch candidate users (Prisma ORM)     │
│  └── role IN [CIRCLE, AUTHOR], not banned,      │
│      not deactivated, not self                  │
│                                                 │
│  Step 3: Tab filter (JS)                        │
│  └── All / Creators / Investor / CEO / Other    │
│                                                 │
│  Step 4: Sub-tab filter (JS)                    │
│  └── People / Companies keyword filter          │
│                                                 │
│  Step 5: Fetch 5 scoring signals (parallel)     │
│  ├── Content velocity  (PostLike + PostComment, │
│  │   last 7 days)                               │
│  ├── Social proof  (mutual follows count)       │
│  ├── Affinity  (engagement history, 30 days)    │
│  ├── Post tags  (interest match)                │
│  └── Total reach  (all-time likes + comments)  │
│                                                 │
│  Step 6: Score each candidate                   │
│  └── Additive base + role multiplier            │
│                                                 │
│  Step 7: Sort deterministically                 │
│  ├── Top/People/Companies: score DESC           │
│  └── Latest: user.id DESC (higher = newer)      │
│                                                 │
│  Step 8: Paginate (cursor + limit)              │
│                                                 │
│  Step 9: Return enriched response               │
│  └── rank, mutualFollows, isFollowing embedded  │
└─────────────────────────────────────────────────┘
        │
        ▼
Browser renders ranked user cards
Rank badges (#1, #2, #3) shown on Top sub-tab only
```

---

## 3. User Pool

Only two roles ever appear in Explore results:

| Role | Description |
|---|---|
| `CIRCLE` | Verified professional network members |
| `AUTHOR` | Platform authors with publishing access |

`NORMAL` and `ADMIN` accounts are excluded at the database query level, not filtered in JS. Banned and deactivated accounts are also excluded at query time.

---

## 4. Scoring Formula

### 4.1 Additive Base Score

```
baseScore = followerScore + reachScore + velocityScore + socialScore + affinityScore
```

Each signal contributes additive points. A user with zero followers and zero posts scores exactly **0**. This prevents empty profiles from floating to the top.

| Signal | Formula | Max Points | What it measures |
|---|---|---|---|
| `followerScore` | `log10(followers + 1) × 10` | ~30 pts | Platform authority |
| `reachScore` | `log10(allTimeLikes + allTimeComments×3 + 1) × 8` | ~24 pts | Total career engagement |
| `velocityScore` | `log10(last7dLikes + last7dComments×3 + 1) × 5` | ~15 pts | Current momentum |
| `socialScore` | `min(mutualFollows × 3, 15)` | 15 pts | How many of your follows also follow them |
| `affinityScore` | `min(recencyWeightedEngagement, 10)` | 10 pts | How often you engage with their content |

**Interest match bonus** — added to base before multiplier:
```
interestBonus = 5 pts  if their post tags overlap with your selected interests
interestBonus = 0 pts  otherwise
```

### 4.2 Role / Verification Multiplier

Applied on top of the base score. Because it multiplies, it only benefits users who already have a real base score — it cannot inflate a zero-score profile.

```
multiplier = 1.0
  + 0.10  if verified
  + 0.05  if isPremium
  + 0.08  if role = AUTHOR
  + 0.06  if role = CIRCLE
  + 0.20  if viewing user is Circle/Author AND candidate is Circle/Author (peer boost)
```

### 4.3 Final Score

```
score = (baseScore + interestBonus) × multiplier
```

### 4.4 Worked Examples

**rana — 0 followers, no posts, verified:**
```
followerScore = log10(1) × 10 = 0
reachScore    = log10(1) × 8  = 0
velocityScore = log10(1) × 5  = 0
socialScore   = 0
affinityScore = 0
baseScore     = 0
multiplier    = 1.10  (verified)
score         = 0 × 1.10 = 0  → ranks last
```

**Jensen Huang — 1.2k followers, many posts, verified:**
```
followerScore = log10(1201) × 10 = 30.8
reachScore    = log10(51)   × 8  = 13.7
velocityScore = log10(11)   × 5  = 5.2
socialScore   = 0 (anonymous viewer)
affinityScore = 0 (anonymous viewer)
baseScore     = 49.7
multiplier    = 1.10  (verified)
score         = 49.7 × 1.10 = 54.6  → ranks high
```

---

## 5. Tabs

### Main Tabs

| Tab | API `tab` param | Filter Logic |
|---|---|---|
| All | `all` | No title filter |
| Creators | `creators` | `title` contains "creator" OR "founder" |
| Investor & Entrepreneur | `investor` | `title` contains "investor" OR "entrepreneur" |
| CEO | `ceo` | `title` contains "ceo" |
| Other | `other` | Excludes creator/founder/investor/entrepreneur/ceo |
| Followed | `followed` | Only users the current user follows (requires sign-in) |

Filtering is done in JavaScript after the DB fetch to avoid dynamic SQL.

### Sub-Tabs

| Sub-tab | API `sub` param | Behavior |
|---|---|---|
| Top | `top` | Sort by score DESC — full ranking with badges |
| Latest | `latest` | Sort by user `id` DESC (higher ID = joined more recently) |
| People | `people` | Exclude titles containing "inc", "ltd", "corp", "company", "studio" |
| Companies | `companies` | Include only titles containing those keywords |

---

## 6. Rank Badges

Rank badges `#1`, `#2`, `#3` with the AlbizLogo icon appear **only on the Top sub-tab**.

| Rank | Visual |
|---|---|
| #1 | Red badge (`bg-[#FFF0F0] text-[#F44444]`) + red card border + light red card background |
| #2 | Grey badge (`bg-[#f5f5f5] text-[#525252]`) |
| #3 | Grey badge |
| #4+ | No badge — clean card |

Badges are hidden on Latest, People, and Companies because those orderings are chronological or category-based, not merit-based. A badge on a chronological list would be misleading.

---

## 7. Rank Stability

Ranks are **fully deterministic** — the same page load always produces the same order because:

1. All scoring signals are real database values (follower count, PostLike count, PostComment count)
2. No random jitter is applied (the activity feed uses jitter for variety — the explore ranking intentionally does not)
3. As actual engagement happens in the real world (someone gains followers, gets more likes), the rank updates on the next page load

This means `#1` stays `#1` until someone else legitimately surpasses them.

---

## 8. User Type Behavior

### Anonymous (not signed in)

- Sees all Circle and Author accounts ranked by `followerScore + reachScore + velocityScore`
- Social proof = 0 (no follow graph to reference)
- Affinity = 0 (no engagement history)
- Interest match = 0 (no stored interests)
- Follow button opens auth modal
- "Followed" tab is hidden

### Normal Signed-In User

- Full scoring: base + social proof + affinity + interest match
- Social proof: sees "2 mutual follows" if 2 of their follows also follow the candidate
- Affinity: users whose posts they have liked, commented, or dwelled on score higher
- Interest match: their selected topics from the preferences panel inform the 5-point bonus
- "Followed" tab shows only followed Circle/Author accounts, ranked by affinity

### Circle / Author User

- Same as normal signed-in, plus the **peer boost**:
- Other Circle/Author accounts get `+0.20` added to their multiplier when viewed by a Circle/Author user
- This surfaces the professional network more prominently for professional users
- Rationale: a Circle user discovering other Circle users is the core use case

---

## 9. Scoring Signals — Database Queries

All 5 signal queries run in parallel via `Promise.all`.

### Content Velocity (last 7 days)
```sql
SELECT p."userId",
  (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS velocity
FROM "Post" p
LEFT JOIN "PostLike" pl ON pl."postId" = p.id
LEFT JOIN "PostComment" pc ON pc."postId" = p.id
WHERE p."userId" = ANY($candidateIds::int[])
  AND p."createdAt" > NOW() - INTERVAL '7 days'
  AND (p.status = 'published' OR p.status IS NULL)
GROUP BY p."userId"
```

### Social Proof (mutual follows)
```sql
SELECT f2."followingId" AS "userId", COUNT(*) AS mutual
FROM "UserFollow" f1
JOIN "UserFollow" f2 ON f1."followingId" = f2."followerId"
WHERE f1."followerId" = $currentUser
  AND f2."followingId" = ANY($candidateIds::int[])
GROUP BY f2."followingId"
```
Reads: "for each person I follow (f1), find who they follow (f2), count how many of my follows also follow each candidate."

### Affinity (30-day engagement history, recency-weighted)
```sql
SELECT p."userId",
  SUM(pe.value * POWER(0.9, EXTRACT(EPOCH FROM (NOW() - pe."createdAt")) / 86400.0)) AS affinity
FROM "PostEngagement" pe
JOIN "Post" p ON p.id = pe."postId"
WHERE pe."userId" = $currentUser
  AND pe.action IN ('like', 'comment', 'dwell', 'follow_author')
  AND pe."createdAt" > NOW() - INTERVAL '30 days'
  AND p."userId" = ANY($candidateIds::int[])
GROUP BY p."userId"
```
Each engagement is weighted by `0.9^daysAgo` — yesterday's like is worth 0.9× today's, 10 days ago is worth 0.35×.

### Post Tags (interest match)
```sql
SELECT DISTINCT p."userId", UNNEST(p.tags) AS tag
FROM "Post" p
WHERE p."userId" = ANY($candidateIds::int[])
  AND (p.status = 'published' OR p.status IS NULL)
```

### Total Reach (all-time, stable rank anchor)
```sql
SELECT p."userId",
  (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS reach
FROM "Post" p
LEFT JOIN "PostLike" pl ON pl."postId" = p.id
LEFT JOIN "PostComment" pc ON pc."postId" = p.id
WHERE p."userId" = ANY($candidateIds::int[])
  AND (p.status = 'published' OR p.status IS NULL)
GROUP BY p."userId"
```

---

## 10. Pagination

- Default page size: 20
- Maximum page size: 50 (capped server-side)
- Cursor: integer offset into the sorted result set
- Response includes `nextCursor`, `hasMore`, `total`
- Infinite scroll: a sentinel `<div>` at the bottom of the list triggers the next page via `IntersectionObserver`

---

## 11. Frontend Behaviors

### Skeleton Loading

`UserCardSkeleton` renders 8 placeholder cards on first load. Initialized with `exploreLoading = true` so the skeleton shows on the very first render — no blank state or content flash.

### Tab and Sub-tab Switching

Every tab or sub-tab change:
1. Clears the current user list
2. Resets cursor to 0
3. Calls `loadFeed(0, newTab, newSub)` immediately
4. Shows skeleton while new results load

### Client-Side Search

Search filters the already-loaded result set instantly (no API round-trip). When the search query is cleared, the server-ranked order is restored. Infinite scroll is disabled while searching.

### Mutual Follows Label

When `user.mutualFollows > 0`, a small label appears below the user's title:
```
👥  2 mutual follows
```
This uses the `Users` icon from Lucide, not an emoji.

### isFollowing State

The API embeds `isFollowing: true/false` per user based on the current user's follow list. This is used to initialize the follow button state — no separate API call needed on the client.

---

## 12. API Reference

### GET /api/explore/users

Returns server-ranked Circle and Author users.

**Parameters:**

| Parameter | Values | Default | Description |
|---|---|---|---|
| `tab` | `all`, `creators`, `investor`, `ceo`, `other`, `followed` | `all` | Category filter |
| `sub` | `top`, `latest`, `people`, `companies` | `top` | Sort/filter mode |
| `cursor` | number | `0` | Pagination offset |
| `limit` | number | `20` | Results per page (max 50) |

**Response:**
```json
{
  "users": [
    {
      "id": 12,
      "name": "Jensen Huang",
      "handle": "jhuang",
      "title": "CEO & Co-founder",
      "avatar": "https://...",
      "verified": true,
      "isPremium": false,
      "hasStory": false,
      "role": "CIRCLE",
      "followers": "1.2k",
      "followingCount": "45",
      "bio": "...",
      "location": "California",
      "website": "https://...",
      "joinedDate": "Jan 2024",
      "isFollowing": false,
      "mutualFollows": 2,
      "score": 54.6,
      "rank": 1
    }
  ],
  "nextCursor": 20,
  "hasMore": true,
  "total": 48
}
```

---

## 13. File Structure

```
albiz-media/
├── app/
│   ├── api/
│   │   └── explore/
│   │       └── users/
│   │           └── route.ts          ← Server-side ranking pipeline
│   ├── (main)/
│   │   └── explore/
│   │       └── page.tsx              ← Frontend: skeleton, infinite scroll, badges
│   └── lib/
│       └── api.ts                    ← getExploreFeed() client method
└── docs/
    └── x-algorithm-explore-page.md  ← This document
```

---

## 14. How Rank Improves Over Time

A Circle or Author user's rank improves when:

| Action | Signal | Effect |
|---|---|---|
| Gains followers on the platform | `followers` field | `followerScore` increases |
| Their posts get liked | `PostLike` table | `reachScore` + `velocityScore` increase |
| Their posts get commented on | `PostComment` table | `reachScore` + `velocityScore` increase (×3 weight) |
| Current viewer engages with their content | `PostEngagement` table | `affinityScore` increases for that viewer |
| Current viewer follows people who also follow them | `UserFollow` table | `socialScore` increases for that viewer |

The rank is recalculated on every page load from live database counts, so improvements are reflected immediately.

---

## 15. Comparison: Before vs After

| Aspect | Before | After |
|---|---|---|
| Ranking location | Client-side JS | Server-side database queries |
| Formula | Single sort by follower count (naive string parse) | Additive multi-signal formula |
| Empty profile handling | Empty profiles ranked same as real ones (floor=1 bug) | Empty profiles score 0, rank last |
| Personalization | None — same order for all users | Social proof + affinity + interest match |
| User pool | All roles including NORMAL | CIRCLE and AUTHOR only |
| Rank stability | Changed on every JS state change | Deterministic — changes only when real data changes |
| Pagination | None — full fetch at once | Infinite scroll, 20 per page |
| Loading state | No skeleton — blank white flash | 8 skeleton cards on first load |
| Rank badges | Hardcoded `idx === 0` | Real rank from server, Top sub-tab only |
| Anonymous experience | Same as signed-in | Reduced (no social/affinity signals) but works fully |
