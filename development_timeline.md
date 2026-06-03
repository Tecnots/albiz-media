# Albiz Media Implementation Timeline

*   **Timeline Start Date**: June 1, 2026
*   **Timeline End Date**: June 30, 2026
*   **Total Duration**: 30 Calendar Days

---

### Completed Tasks (Prior to June 1, 2026)

#### User Activities Feed
*   **Create Post Text Input** (`app/(main)/page.tsx`): Saves post content draft in local text state.
*   **Submit Post Button** (`app/(main)/page.tsx`): Writes a new post row into the database `Post` model.
*   **Post Like Button (Heart)** (`app/(main)/page.tsx`): Inserts a record in `PostLike` model and increments visual counters.
*   **Comments Drawer Button (MessageCircle)** (`app/(main)/page.tsx`): Expands/collapses the comments overlay sheet.
*   **Send Comment Input & Button (ArrowUp)** (`app/(main)/page.tsx`): Inserts a new row in `PostComment` model.
*   **Delete Comment Button (Trash icon)** (`app/(main)/page.tsx`): Deletes comment rows for owned entries.
*   **Save/Bookmark Button** (`app/(main)/page.tsx`): Toggles saved state inside the `SavedPost` model.
*   **Share Post Button (Share2)** (`app/(main)/page.tsx`): Calls the `@capacitor/share` native sheet on mobile or copies links on web.
*   **Read inline paragraph expander (Eye icon)** (`app/(main)/page.tsx`): Expands full text inline.

#### User Stories Module
*   **Create Story File Picker Button** (`app/(main)/page.tsx`): Opens storage files, uploads images to Azure Blob containers, and saves database rows to `Story`.
*   **Story Viewer view counter** (`app/(main)/page.tsx`): Increments story views count automatically upon display.
*   **Like Story Button (Heart)** (`app/(main)/page.tsx`): Updates stats in `StoryLike` database model.

#### Direct Messages & Group Chat
*   **New Message button & User Search input** (`app/(main)/messages/page.tsx`): Retrieves circle profiles and starts chats.
*   **Direct Message Send Textarea & Button** (`app/(main)/messages/page.tsx`): Inserts standard text payloads into the `Message` model.
*   **Message Edit Button** (`app/(main)/messages/page.tsx`): Updates message records and tags `edited = true`.
*   **Message Delete Button** (`app/(main)/messages/page.tsx`): Deletes message entries dynamically.
*   **Save Message Bookmark Button** (`app/(main)/messages/page.tsx`): Indexes the message inside user bookmarks.
*   **Typing state indicator** (`app/(main)/messages/page.tsx`): Listens for active typing input triggers.

#### Personalization Onboarding
*   **Interest Topic Selection Cards** (`app/components/OnboardModal.tsx`): Saves selection indices to `UserInterest` model.
*   **Suggested Creators Follow Buttons** (`app/components/OnboardModal.tsx`): Writes follow relationships to `UserFollow` database table.

#### User Profile Editor
*   **Cover & Avatar Image Pickers** (`app/(main)/[handle]/page.tsx`): Uploads files to Azure Storage and updates profile URLs.
*   **Experience Manager Add/Edit/Delete Buttons** (`app/(main)/[handle]/page.tsx`): Manages records in `UserExperience` model.
*   **Education Manager Add/Edit/Delete Buttons** (`app/(main)/[handle]/page.tsx`): Manages records in `UserEducation` model.
*   **Skills Manager tag elements** (`app/(main)/[handle]/page.tsx`): Inserts and deletes skills from `UserSkill` model.
*   **Highlights Collection Manager (Archive story pickers)** (`app/(main)/[handle]/page.tsx`): Aggregates archived photos.

#### Custom Domains config
*   **Domain connection form & input** (`app/(main)/settings/page.tsx`): Configures custom domain string in DB.
*   **DNS Verification check button** (`app/(main)/settings/page.tsx`): Runs queries on target CNAME and TXT configurations.
*   **Remove Custom Domain button** (`app/(main)/settings/page.tsx`): Clears domain variables.
*   **Show Albiz Media Badge switch toggle** (`app/(main)/settings/page.tsx`): Toggles brand layout overlays.

#### Admin Control Actions
*   **Upgrade request Approve/Reject triggers** (`app/admin/circle-upgrades/page.tsx`): Updates verify state in `CircleUpgradeRequest`.
*   **Pin/Feature Post toggle switch** (`app/admin/content/page.tsx`): Toggles global database pin variables.
*   **Delete Post button** (`app/admin/content/page.tsx`): Triggers hard delete.
*   **User Role selection dropdown** (`app/admin/users/page.tsx`): Toggles target database roles (`NORMAL`, `CIRCLE`, `AUTHOR`, `ADMIN`).
*   **Ban/Unban User action button** (`app/admin/users/page.tsx`): Toggles banned login configurations.

---

### Phase 1: Database Migration & Feed Dynamic Integrations (June 1 - June 8)

*   **Task 1.1: News Feed Database Integration** (June 1 - June 3)
    *   *Audit Status*: Currently Mock Data (`data.ts` static `newsArticles` array).
    *   *Sub-tasks*:
        *   Create `NewsArticle` schema inside Prisma and execute migration.
        *   Write dynamic API endpoint `/api/news` supporting paginated requests.
        *   Refactor the Home news feed layout to fetch articles from `/api/news`.
    *   *UI Elements*: News feed tab item switch pills, Read Article link clicks.
*   **Task 1.2: Sponsored Posts & Ads Database Migration** (June 4 - June 5)
    *   *Audit Status*: Currently Mock Data (`data.ts` static `sponsoredPosts` array).
    *   *Sub-tasks*:
        *   Create `AdCampaign` model containing target URLs, image assets, and slots.
        *   Implement the `/api/ads` endpoint.
        *   Refactor sponsored cards inside the feed mapping loop to pull from dynamic campaigns.
    *   *UI Elements*: Sponsored card action links, Close Ad cross icons.
*   **Task 1.3: Shorts video database & stream handlers** (June 6 - June 8)
    *   *Audit Status*: Currently Mock Data (hardcoded client state arrays in `/shorts/page.tsx`).
    *   *Sub-tasks*:
        *   Create `Short`, `ShortLike`, and `ShortComment` tables in Prisma.
        *   Write API `/api/shorts` for database querying and comments insertion.
        *   Configure media upload handlers to stream MP4 files directly to Azure containers.
    *   *UI Elements*: Like heart toggle button, Comments sheet toggle trigger, Bookmark toggle button, Volume mute/unmute icon trigger, Play/Pause viewport touch click area.

---

### Phase 2: Key Persistence, Billing & Security controls (June 9 - June 14)

*   **Task 2.1: E2E Message Key Persistence in IndexedDB** (June 9 - June 10)
    *   *Audit Status*: Currently Partially Done (ECDH public keys reset in memory on page refresh).
    *   *Sub-tasks*:
        *   Refactor `crypto.ts` to check and load keys inside client IndexedDB rather than local memory.
        *   Implement a sync script to write public keys to the server database once on initial setup.
    *   *UI Elements*: Encryption switcher slider toggle, Lock indicators inside conversation list headers.
*   **Task 2.2: Settings - Billing Settings Implementation** (June 11 - June 12)
    *   *Audit Status*: Currently Not Started (displays static Billing settings placeholder).
    *   *Sub-tasks*:
        *   Integrate Stripe subscriptions SDK and create billing checkout endpoints.
        *   Develop Stripe payment webhooks to update user membership status to Circle/Premium.
    *   *UI Elements*: Billing Switch tab pill, Subscribe to Premium button, Payment checkout forms, Billing tier subscription selection cards.
*   **Task 2.3: Settings - Account Security Settings** (June 13 - June 14)
    *   *Audit Status*: Currently Not Started (displays static Security settings placeholder).
    *   *Sub-tasks*:
        *   Wire API forms to update passwords and clear session tokens.
        *   Implement client check inputs for Two-Factor Authentication (2FA) verification setup.
    *   *UI Elements*: Security Switch tab pill, Password Update submit button, Active sessions list "Revoke" button, 2FA Switch checkbox.

---

### Phase 3: Omnichannel inbox webhooks & Verification queue (June 15 - June 20)

*   **Task 3.1: Omnichannel Social Inbox Webhooks** (June 15 - June 17)
    *   *Audit Status*: Currently Partially Done (Meta callback handler complete; Twitter API basic block; Telegram webhook missing).
    *   *Sub-tasks*:
        *   Implement bot message webhook handlers for Telegram inside `app/api/social/webhook/[platform]`.
        *   Setup mock API credentials switcher for Twitter/X developer Basic accounts.
    *   *UI Elements*: Connect Telegram button, Connect Twitter/X account credentials button.
*   **Task 3.2: Circle Verification Queue Workflow** (June 18 - June 20)
    *   *Audit Status*: Currently Partially Done (Testing bypass automatically upgrades role on form submit; mail confirmation missing).
    *   *Sub-tasks*:
        *   Remove auto-approval test scripts in `/api/circle-upgrade` and set initial registration status to `PENDING`.
        *   Wire transaction mailers (NodeMailer) to notify users of upgrade queue reviews.
    *   *UI Elements*: Submit Upgrade form button, Admin queue review "Approve" button, Admin queue review "Reject" button.

---

### Phase 4: Analytics Logging, KPI Metrics & Dashboards (June 21 - June 30)

*   **Task 4.1: Request Tracker Middleware & Live Globe** (June 21 - June 23)
    *   *Audit Status*: Currently Partially Done (Globe counter is live, but visitor logs are not written dynamically on pages visits).
    *   *Sub-tasks*:
        *   Create standard Next.js request middleware to check user IP address, parse geolocation, and insert rows into `VisitorLog`.
    *   *UI Elements*: Globe zoom control buttons, Active region indicators.
*   **Task 4.2: Admin Console KPI Metrics & Server-side Tables** (June 24 - June 26)
    *   *Audit Status*: Currently Mock Data (`admin-data.ts` uses static datasets for grids and charts).
    *   *Sub-tasks*:
        *   Aggregate actual database transaction numbers (User, Post, Ad campaigns) to supply dashboard stats.
        *   Update Admin grids (users and posts tables) to load server-side paginated results.
    *   *UI Elements*: Grids pagination "Next / Prev" page buttons, Column sort order buttons.
*   **Task 4.3: Creator Analytics charts aggregation** (June 27 - June 30)
    *   *Audit Status*: Currently Partially Done (follower and engagement sparkline charts use `Math.random()`).
    *   *Sub-tasks*:
        *   Write database queries in `/api/analytics` to count comments, likes, and views grouped by custom intervals.
    *   *UI Elements*: Analytics date range dropdown filters, Export reports CSV button.
