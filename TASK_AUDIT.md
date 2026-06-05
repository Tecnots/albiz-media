# Task Audit — Albiz Media

Status key: ✅ complete · 🟡 partial · 🔴 dummy data · ⬜ not started

---

## Pages

### Feed / Home (`app/(main)/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Tab bar (For You, Following, Trending, Breaking) | ✅ | Switching works |
| Search bar with focus open/close | ✅ | |
| Content preference dropdown | ✅ | 12 topics, saves to user interests |
| Post cards (regular posts) | ✅ | Wired to real DB via `/api/posts` |
| Post author info (avatar, name, handle, badge) | ✅ | |
| Post stats row (views, likes, comments, shares) | ✅ | |
| Like button | ✅ | Wired to `/api/posts/[id]/like` |
| Comment button (expand section) | ✅ | Loads comments on demand |
| Share button + share popup | ✅ | WhatsApp, Twitter, Facebook, LinkedIn, copy link |
| Save/bookmark button | ✅ | Wired to `/api/saved` |
| Not interested button | ✅ | Wired to `/api/posts/[id]/not-interested` |
| Impression tracking (IntersectionObserver) | ✅ | Signals sent to `/api/posts/[id]/impression` |
| Comment input field | ✅ | |
| Comment list under post | ✅ | Flat list, no nested replies |
| Article side-panel (open on click) | ✅ | |
| Related articles in side panel | 🔴 | Hardcoded |
| Author card in side panel | ✅ | |
| News article cards | 🔴 | Hardcoded in `app/lib/data.ts` |
| Sponsored post cards | 🔴 | Hardcoded in `app/lib/data.ts` |
| Feed algorithm ranking (For You) | ✅ | X-Algorithm in `app/lib/algorithm/` |
| Trending tab feed | ✅ | Sorted by engagement/recency |
| Following tab feed | 🟡 | Uses follows list but may fall back |
| Breaking tab | 🔴 | No backend, pulls from hardcoded news |

---

### Explore (`app/(main)/explore/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Search bar with close button | ✅ | |
| Category tabs (All, Creators, Investor, CEO, Other, Followed) | ✅ | |
| Sub-tabs (Top, Latest, People, Companies) | ✅ | |
| User cards (avatar, name, title, badge) | ✅ | Real data from `/api/users` |
| Rank badge (#01) on top user | 🔴 | Computed in frontend, not from DB |
| Follow button on user card | ✅ | Wired to `/api/follow` |
| Trending topics carousel | 🔴 | Hardcoded list, fallback from `data.ts` |

---

### Analytics (`app/(main)/analytics/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Date range dropdown (7d, 30d, 90d, 1y, all) | ✅ | UI works, data may not reflect selection |
| Tab bar (Overview, Content, Audience, Reach) | ✅ | Tabs switch correctly |
| Stats cards (Views, Likes, Followers, Engagement) | 🟡 | Fetches from `/api/author/stats` for Circle users only, zeros otherwise |
| Sparkline micro-charts on stat cards | 🟡 | Render but default to zero values |
| Area chart (Views over time) | 🟡 | SVG renders but uses default empty data |
| Engagement breakdown (pie: Likes, Comments, Shares) | 🟡 | SVG renders but uses default data |
| Follower growth chart | 🟡 | UI present, hardcoded default data |
| Top cities bar chart | 🔴 | Hardcoded `defaultFollowerDemographics` |
| Age distribution chart | 🔴 | Hardcoded |
| Gender split | 🔴 | Hardcoded |
| Devices chart | 🔴 | Hardcoded |
| Content performance table (top posts) | 🟡 | Partial — may show zeros for new accounts |

---

### Messages (`app/(main)/messages/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Conversation list | ✅ | Real DB via `/api/conversations` |
| Conversation search bar | ✅ | |
| Unread badge on conversation | ✅ | |
| Direct messages tab | ✅ | |
| Social inbox tab | ✅ | Instagram/Twitter DMs |
| Chat window (message bubbles) | ✅ | |
| Message input field | ✅ | |
| Send button | ✅ | |
| Typing indicator (animated dots) | ✅ | |
| Message status (sent/read indicators) | ✅ | |
| Message date separators | ✅ | |
| Edit message | ✅ | |
| Delete message | ✅ | |
| Copy message (context menu) | ✅ | |
| Save message | ✅ | |
| Attachment picker button | ✅ | |
| Image attachment upload + preview | ✅ | Azure Blob |
| Document attachment upload + preview | ✅ | |
| Audio attachment + player | ✅ | |
| Attachment preview before send | ✅ | |
| Encryption toggle | 🟡 | Toggle UI exists, actual E2EE unclear |
| Call button (audio) | ⬜ | Modal opens but no WebRTC backend |
| Call button (video) | ⬜ | Modal opens but no WebRTC backend |
| New conversation modal | ✅ | |
| Chat search within conversation | ✅ | |
| Social thread view (Instagram/Twitter) | ✅ | |
| Reply to social DM | ✅ | |

---

### Notifications (`app/(main)/notifications/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Notification list | ✅ | Real data from `/api/notifications` |
| Filter buttons (All, Unread, Follow, Like, Comment, etc.) | ✅ | |
| Mark all as read button | ✅ | |
| Individual unread indicator dot | ✅ | |
| Notification avatar + action text | ✅ | |
| Timestamp | ✅ | |
| Follow/accept action inside notification | ✅ | |
| Date grouping (Today, Yesterday, Earlier) | ✅ | |
| Deduplication by user + type | ✅ | |
| Email notification delivery | 🟡 | Framework via Nodemailer, not fully tested |
| Push notifications | ⬜ | Firebase setup present, not integrated |

---

### User Profile (`app/(main)/[handle]/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Cover photo | ✅ | Editable by owner |
| Avatar with upload | ✅ | |
| Name, handle, title | ✅ | |
| Bio | ✅ | |
| Location, website, join date | ✅ | |
| Followers/Following/Posts stats | ✅ | |
| Follow button | ✅ | |
| Message button | ✅ | |
| Share profile button | ✅ | |
| More options menu | ✅ | Block, mute, report |
| Block user | ✅ | |
| Mute user | ✅ | |
| Circle badge | ✅ | Based on role |
| Tab navigation (Posts, Articles, Highlights, About, Saves) | ✅ | |
| Posts tab content | ✅ | Real posts from DB |
| Articles tab content | ✅ | |
| Highlights tab | 🟡 | Schema exists, UI may be incomplete |
| Saves tab (visible to owner) | ✅ | |
| About tab — Education | 🔴 | Deterministically generated, not from real DB entries |
| About tab — Experience | 🔴 | Generated |
| About tab — Skills | 🔴 | Generated |
| About tab — Interests | 🔴 | Generated |
| Communities section | 🔴 | Hardcoded list |
| Net worth / global rank | 🔴 | Hardcoded examples |
| Related profiles carousel | ✅ | From `/api/users/suggested` |
| Circle upgrade request form (modal) | ✅ | Multi-step, document upload |

---

### Saved Posts (`app/(main)/saved/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| All saved posts view | ✅ | |
| Collection tabs | ✅ | |
| Create new collection button + modal | ✅ | |
| Search saved posts | ✅ | |
| Remove from saved (menu) | ✅ | |

---

### Circle (`app/(main)/circle/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Member list with ranks | 🔴 | Hardcoded from `data.ts` |
| Rank badges (#01, #02 …) | 🔴 | Hardcoded |
| Follow/view actions on members | ✅ | |
| Circle-only posts feed | 🔴 | Hardcoded from `data.ts` |
| Circle gate on restricted posts | ✅ | `<CircleGate>` component |

---

### Shorts (`app/(main)/shorts/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Category filter tabs | 🔴 | Hardcoded categories |
| Country filter dropdown | 🔴 | Hardcoded |
| Video player (play, pause) | ⬜ | UI only — no real video URLs |
| Sound toggle | ⬜ | UI only |
| Progress bar | ⬜ | UI only |
| Creator profile overlay | 🔴 | Hardcoded creators array |
| Like button | ⬜ | No backend wiring |
| Comment button | ⬜ | No backend wiring |
| Share button | ⬜ | No backend wiring |
| Save button | ⬜ | No backend wiring |
| Vertical scroll feed | ⬜ | UI renders but no real content |
| Video upload flow | ⬜ | Not started |
| Video encoding/delivery pipeline | ⬜ | Not started |

---

### Settings (`app/(main)/settings/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Tab navigation | ✅ | |
| Personalization — topic checkboxes | ✅ | Saved via `/api/interests` |
| Personalization — suggested users to follow | ✅ | From `/api/users/suggested` |
| Account — email display | ✅ | |
| Account — email verification status | ✅ | |
| Account — change password form | ✅ | |
| Privacy — blocked users list | ✅ | |
| Privacy — muted users list | ✅ | Via `/api/user/mute` |
| Privacy — domain settings | 🟡 | Routes exist, DNS verification unclear |
| Notifications — per-type toggles | ✅ | Saved via `/api/settings/notifications` |
| Language & Region — language dropdown | ✅ | |
| Language & Region — timezone dropdown | ✅ | |
| Language & Region — region dropdown | ✅ | |
| Account deactivation | ✅ | Soft-delete via `/api/users/deactivate` |

---

### Auth Pages

| Page / Element | Status | Notes |
|----------------|--------|-------|
| Signup form (email, password) | ✅ | |
| Login form | ✅ | |
| Email verification page | ✅ | Token-based |
| Resend verification link | ✅ | |
| Forgot password form | ✅ | |
| Reset password form | ✅ | |
| Accept invite page | ✅ | |
| OAuth login buttons | 🟡 | NextAuth configured, may need provider keys |
| Onboarding interest selection modal | ✅ | Shown after signup |
| Ban guard overlay | ✅ | Shows if user is banned |

---

### Article Detail (`app/article/[id]/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Full article content rendering (TipTap HTML) | ✅ | |
| Author profile card | ✅ | |
| Like/save/share actions | ✅ | |
| Related articles | 🔴 | Hardcoded |
| Comment section | 🟡 | Comments model exists, UI integration unclear |

---

### Author Studio — Create Article (`app/authors/create/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Title input | ✅ | |
| Description input | ✅ | |
| TipTap rich text editor | ✅ | Bold, italic, underline, align, links, images, YouTube |
| Image upload with crop modal | ✅ | |
| Tag input with autocomplete | ✅ | |
| Custom tag creation | ✅ | |
| Readability score badge (Flesch-Kincaid) | ✅ | |
| AI suggestion button | ✅ | Claude API via `/api/author/ai` |
| AI tone/length/topic suggestions | ✅ | |
| Save as draft button | ✅ | |
| Submit for review button | ✅ | |
| Keyboard shortcuts overlay | ✅ | |
| SEO description field | ✅ | |
| Section/category selector | ✅ | |

---

### Author Studio — My Articles (`app/authors/my-articles/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Queue / Published tabs | ✅ | |
| Status filter buttons (Draft, Submitted, Under Review, etc.) | ✅ | |
| Article rows with status badges | ✅ | |
| Edit action | ✅ | |
| Delete action + confirmation dialog | ✅ | |
| Submit action | ✅ | |
| Views/engagement stats per article | 🟡 | Shows zeros for new articles |
| Pagination | ✅ | |

---

### Admin — Dashboard (`app/admin/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Total users stat card | ✅ | |
| Total posts stat card | ✅ | |
| Active users (24h) stat card | ✅ | |
| New signups (7d) stat card | ✅ | |
| Circle members count | ✅ | |
| Pending approvals count | ✅ | |
| Flagged content count | ✅ | |
| Activity log feed | ✅ | Real from `ActivityLog` table |

---

### Admin — Circle Upgrades (`app/admin/circle-upgrades/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Request list | ✅ | |
| Search requests | ✅ | |
| Status filter (Pending, Approved, Rejected) | ✅ | |
| Request detail modal | ✅ | |
| Document preview | ✅ | |
| Approve button | ✅ | Sends email, updates user role |
| Reject button + reason field | ✅ | Sends email |
| Pagination | ✅ | |

---

### Admin — Users (`app/admin/users/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| User list with search | ✅ | |
| Ban/unban action | ✅ | |
| Role assignment | ✅ | |
| Activity history | ✅ | |

---

### Admin — Content Moderation (`app/admin/content/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Flagged posts list | ✅ | |
| Approve post action | ✅ | |
| Remove post action | ✅ | |
| Reason tracking | ✅ | |

---

### Admin — Analytics / Globe (`app/admin/analytics/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| 3D globe visitor visualization | ✅ | react-globe.gl |
| Traffic by country | ✅ | From `VisitorLog` table |
| Traffic by device | ✅ | |
| Traffic by referrer | 🟡 | May need more data |

---

### Admin — News Editor (`app/admin/news/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| TipTap WYSIWYG editor | ✅ | Full toolbar |
| Title, description, tags fields | ✅ | |
| Author field | ✅ | |
| Category selector | ✅ | |
| Image upload | ✅ | |
| YouTube embed | ✅ | |
| Publish action | ✅ | |

---

### Admin — Notifications (`app/admin/notifications/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Create notification form | ✅ | |
| Target audience selector | ✅ | All users, Circle members, etc. |
| Schedule sending | 🟡 | UI present, scheduling reliability unclear |

---

### Admin — Settings (`app/admin/settings/page.tsx`)

| Element | Status | Notes |
|---------|--------|-------|
| Feature toggles | ✅ | |
| Email configuration fields | ✅ | |
| Domain settings | 🟡 | |
| Rate limit config | ✅ | |

---

## Shared Components

| Component | Status | Notes |
|-----------|--------|-------|
| Right sidebar — suggested profiles | ✅ | From `/api/users/suggested` |
| Right sidebar — ad card | 🔴 | Hardcoded placeholder |
| Stories carousel (`RecentStories`) | 🟡 | Fetch wired, create/view UI partial |
| Story creation (image + text overlay) | 🟡 | Upload works, text positioning UI present |
| Story text position/scale controls | 🟡 | UI present, persistence unclear |
| Story video recording | ⬜ | Not started |
| Story expiry (24h auto) | ✅ | |
| Story views counter | 🟡 | |
| Story likes | 🟡 | |
| Story viewers list | 🟡 | |
| Verified badge | ✅ | |
| Circle welcome modal | ✅ | Shown after approval |
| Onboard interest modal | ✅ | |
| Avatar crop modal | ✅ | |
| File upload (drag-drop) | ✅ | |
| Circle upgrade form (multi-step) | ✅ | |

---

## Data Still Hardcoded / Needs Real Backend

| Item | File | Notes |
|------|------|-------|
| News articles | `app/lib/data.ts` | Replace with real CMS content |
| News authors | `app/lib/data.ts` | |
| Sponsored posts | `app/lib/data.ts` | Replace with ad management system |
| Trending topics list | `app/lib/data.ts` | Should be computed from post hashtags |
| Fallback users list | `app/lib/data.ts` | Used when API is slow/fails |
| Circle members + ranks | `app/lib/data.ts` | Should come from DB query |
| Circle posts | `app/lib/data.ts` | |
| User education (profile About) | `app/(main)/[handle]/page.tsx` | Generated from seeded RNG |
| User experience (profile About) | `app/(main)/[handle]/page.tsx` | |
| User skills (profile About) | `app/(main)/[handle]/page.tsx` | |
| User interests (profile About) | `app/(main)/[handle]/page.tsx` | |
| User net worth / global rank | `app/(main)/[handle]/page.tsx` | |
| User profile view count / search count | `app/(main)/[handle]/page.tsx` | |
| Related articles (feed side panel + article page) | Multiple | |
| Ad card in sidebar | `app/lib/shared-components.tsx` | |
| Shorts creators array | `app/(main)/shorts/page.tsx` | |
| Shorts video titles | `app/(main)/shorts/page.tsx` | |
| Analytics demographics (cities, age, gender, devices) | `app/(main)/analytics/page.tsx` | `defaultFollowerDemographics` |
| Analytics sparkline/chart data | `app/(main)/analytics/page.tsx` | Defaults to zero arrays |

---

## Not Started

| Feature | Notes |
|---------|-------|
| Video upload pipeline | Shorts backend — encoding, storage, delivery |
| Video streaming/playback | CDN delivery for shorts |
| WebRTC audio calls | Call modal is a placeholder |
| WebRTC video calls | |
| Full-text post search | Only message search exists |
| Nested comment replies | Currently flat list |
| Article version history | Edits overwrite in place |
| Story video recording | Camera API not implemented |
| Web push notifications | Firebase SDK present, service worker missing |
| Auto-post to social media | Scheduling feature |
| Mobile app (Capacitor iOS/Android) | Package configured, incomplete |
| Wallet / Web3 integration | Schema tag exists, no implementation |
| Custom user tabs (UserCustomTab) | Schema exists, no UI in profile |
| E2EE message encryption (active) | Crypto lib present, unclear if enforced |
| DNS verification for custom domains | Routes exist, full flow incomplete |
| Batch email scheduling | Framework exists (Nodemailer), no scheduler |
| Real-time social media webhooks | Webhook routes defined, reliability untested |
