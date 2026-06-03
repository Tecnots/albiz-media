# Albiz Media - Feature Implementation Status Audit

This document maps all main modules, sub-features, and minute interactive components (buttons, input fields, checkboxes, dropdowns, and overlays) to their current implementation status in the codebase. Use this to guide your feature development, database integration, and UI polishing.

---

## 1. Not Started
These elements are visible in the UI but lack any operational client page, trigger logic, or database/API backend.

### Settings Tabs - Billing & Security
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/settings/page.tsx)
*   **Billing Switch Pill**: Clicking "Billing" under settings tabs list.
    *   **UI Result**: Shows static text placeholder `"Billing settings coming soon."`
*   **Security Switch Pill**: Clicking "Security" under settings tabs list.
    *   **UI Result**: Shows static text placeholder `"Security settings coming soon."`

---

## 2. Dummy / Mock Data
These interactive elements are functional on the client-side but use statically defined arrays, local state overrides, or programmatically generated random data, bypassing real database/API servers.

### Shorts (Short Video Feed)
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/shorts/page.tsx)
*   **Shorts Category Pills**: Toggling Tech, Startups, Business, Finance, etc.
    *   **Behavior**: Re-filters local programmatic mock array generated in-memory.
*   **Country Filter Dropdown**: Clicking country selector (US, India, UK, etc.).
    *   **Behavior**: Alters local state; no database filter query is triggered.
*   **Card Click (Grid item)**: Opens full-screen video player modal.
    *   **Behavior**: Displays statically loaded mock cards from Picsum.
*   **Play/Pause Video Body Trigger**: Clicking the video viewport area.
    *   **Behavior**: Toggles a local play state hook and shows play overlay icon.
*   **Volume Mute/Unmute Toggle (Volume2/VolumeX icon)**:
    *   **Behavior**: Toggles mute state locally in the player view.
*   **Like (Heart) Button**: Toggles fill state and increments local number counter.
    *   **Behavior**: Saved in local state; does not write to database.
*   **Comment (MessageCircle) Button**: Opens comments panel.
    *   **Behavior**: Renders mock comments list from static variables.
*   **Bookmark (Bookmark) Button**: Toggles saved state.
    *   **Behavior**: Local client-side hook state toggle.

### News Feed Content
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/page.tsx)
*   **News Feed Article Rows**: Clicking static articles in the feed.
    *   **Behavior**: Loaded statically from [data.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/lib/data.ts) (`newsArticles`) rather than fetched from the database on initial feed load.

### Sponsored Posts & Ads
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/page.tsx)
*   **Sponsored Cards**: Rendered dynamically in feed index loops.
    *   **Behavior**: Hardcoded in [data.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/lib/data.ts) (`sponsoredPosts`) and injected on the client side.

### Admin Dashboard Analytics Metrics
**Source File**: [admin-data.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/admin/admin-data.ts)
*   **KPI Scorecards (Impressions, CTR, Revenue)**: Summary blocks in the admin page.
    *   **Behavior**: Values are statically hardcoded.
*   **Platform Activity Charts (Activity Trend, Device breakdown)**:
    *   **Behavior**: Renders static datasets.
*   **Admin Users Management Grid**: Table listing 50 user rows.
    *   **Behavior**: Seeded in-memory list from `generateAdminUsers`.
*   **Admin Posts Management Grid**: Table listing 30 post rows.
    *   **Behavior**: Seeded in-memory list from `generateAdminPosts`.

---

## 3. Partially Implemented Features
These features have active database models and operational APIs, but include testing shortcuts, temporary session data, missing integration steps, or localized fallback mocks.

### Circle Creator Upgrade Request Form
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/circle-upgrade/route.ts)
*   **Upgrade Trigger ("Apply for Circle" button)**: Emits `albiz-circle-upgrade` custom event.
    *   **Behavior**: Opens the overlay multi-step wizard.
*   **Registration Inputs (Full Name, Title, Company, LinkedIn, Website, Bio, Reason)**: Form fields.
    *   **Behavior**: Captures details correctly.
*   **Verification Document File Picker**: File browser uploader.
    *   **Behavior**: Saves documents to Azure Blob Storage container.
*   **Form Submit Button**: Submits the request.
    *   **Behavior**: Correctly logs data inside `CircleUpgradeRequest`, `CircleUpgradeRegistration`, and `CircleUpgradeDocument` tables.
    *   *Testing Bypass*: Immediately updates the user role to `CIRCLE` and `isPremium = true` upon submission for testing purposes, bypassing admin review.
    *   *Email Gap*: Automatic confirmation email dispatch is disabled and marked as `TODO`.

### E2E Encrypted Conversations
**Source File**: [crypto.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/lib/crypto.ts)
*   **Encryption Switch Toggle**: Slider in conversation header page.
    *   **Behavior**: Sets `encryptionEnabled = true` in the database `Conversation` table.
*   **Encrypted Message Send**: Message text fields.
    *   **Behavior**: Encrypts text using ECDH P-256 / AES-GCM and saves base64 ciphertext and IV to the database.
*   *Key Retention Gap*: Because the private key is unextractable, and the public key is not persisted locally, the client generates a fresh key pair and updates the database server on every page reload/session refresh. This makes older encrypted messages unreadable upon refresh.

### Social Connected Inbox (Omnichannel DMs)
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/social/threads/%5Bid%5D/messages/route.ts)
*   **Connect Platform Button**: Triggers OAuth redirections for connected networks.
    *   **Behavior**: Successfully handles webhook callbacks for Meta channels (Instagram, WhatsApp, Messenger, Facebook).
*   *Twitter/X*: Code is fully complete but requires a paid basic/higher developer API tier. Forbidden on free developer credentials.
*   *Telegram*: Outbound messages send successfully, but inbound webhook synchronization is missing.
*   *LinkedIn*: Message sending is explicitly hardcoded as "not supported".
*   **Send Failure Fallback**: If sending to the platform fails, the message is still saved to the local database as `outbound` so that the chat UI remains responsive in offline/development environments.

### Creator Analytics Dashboard
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/analytics/route.ts)
*   **Dashboard Stats (Total Views, Likes, Followers, Stories Views/Likes)**: Page summary metrics.
    *   **Behavior**: Aggregated and loaded via database transactions.
*   **Follower/Engagement Sparkline Charts**: Small line charts.
    *   **Behavior**: Populated using `Math.random()` values in the JSON API responses.

### Admin Live Visitors Globe
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/analytics/visitors/route.ts)
*   **Live Visitors Counter & Globe Dots**: Renders active logs from the `VisitorLog` table.
    *   **Behavior**: Live 30-minute visitor counters run database queries.
*   *Logging Gap*: General page views do not write to the `VisitorLog` table dynamically. Logs must be populated manually or through an external API tool for testing.

---

## 4. Completed Features
These features are fully implemented, database-backed, and functional.

### Activities Feed (Main Feed & Custom Posts)
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/page.tsx)
*   **Create Post Input & Submit Button**: Inserts new text post to `Post` table.
*   **Like (Heart) Toggle Button**: Updates post likes counter and writes to `PostLike` table.
*   **Comment (MessageCircle) Toggle**: Opens comments thread.
*   **Submit Comment Button**: Inserts row to `PostComment` database table.
*   **Delete Comment (Trash icon)**: Removes entry from `PostComment`. Only visible for own comments.
*   **Bookmark Save Toggle Button**: Saves bookmarked posts. Updates the `SavedPost` database model.
*   **Read (Eye) Expansion Button**: Expands long-form article paragraphs inline.
*   **Share (Share2) Button**: Triggers native Capacitor sharing or copies page link.

### Stories Module
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/page.tsx)
*   **Create Story Button**: Opens local file picker, uploads image to Azure Blob Storage, and inserts a row in `Story` table.
*   **Story Circle Trigger**: Click opens the slideshow overlay player.
*   **Story Viewer View Counter**: Auto-increments view metrics and inserts to `StoryView` database model.
*   **Like Story Button (Heart icon)**: Sets status in `StoryLike` database model.

### Direct Messaging (Standard chats)
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/messages/page.tsx)
*   **New Message button & User Search picker**: Searches circle members via `getCircleUsers` and launches chat thread.
*   **Message textarea input & Send button**: Inserts messages into `Message` database model.
*   **Chat Message Hover Options**:
    *   `Edit` button: Toggles text input, updates `Message` text, sets `edited = true`.
    *   `Delete` button: Sets message as deleted.
    *   `Bookmark/Save` button: Saves message index reference.
*   **Typing status indicator**: Displays active typing notification based on last inputs.

### NextAuth Authentication & Credentials
**Source File**: [auth.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/auth.ts)
*   **Credentials Sign In/Sign Up Submit**: Validates forms against user records.
*   **Google Sign In Button**: Integrates with Google OAuth to retrieve credentials and logs in or creates new user profiles.
*   **Deactivate Account Button**: Prompts confirmation and sets `deactivatedAt` timestamp.
*   **Delete Account Button**: Deletes profile data and records.

### Custom Domains Configuration
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/settings/page.tsx)
*   **Connect Custom Domain Button**: Saves domain to user settings.
*   **Verify DNS Button**: Queries CNAME mapping and TXT verification records.
*   **Remove Custom Domain Button**: Clears domain column.
*   **Show Albiz Media Badge Switch**: Toggles `showBranding` boolean field in the database.

### Personalization Wizard
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/settings/page.tsx)
*   **Guided Onboarding Modal**: Opens configuration guide.
*   **Interest Topic Cards**: Click cards to select/unselect. Saves topics into `UserInterest` table.
*   **Suggested Creators Follow Buttons**: Toggle `UserFollow` database entries.

### Privacy & Safety Settings
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/settings/page.tsx)
*   **Blocked Users list - Unblock Button**: Removes record from `BlockedUser` table.

### Bookmarks Collections
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/saved/page.tsx)
*   **Create Folder Collection Button**: Opens name input modal and saves to `UserCollection` table.
*   **Delete Folder Collection Button**: Deletes the collection row.

### User Profile Editor
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/[handle]/page.tsx)
*   **Cover / Avatar Photo Picker**: Triggers file selection, uploads to Azure Storage, updates profile URL.
*   **Profile Details Fields (Name, Title, Location, Website, Bio)**: Text inputs.
*   **Location Dropdowns (Country, State, City)**: Select dropdown inputs.
*   **Experience Manager (Add, Edit, Delete Experience)**: Updates `UserExperience` database model.
*   **Education Manager (Add, Edit, Delete Education)**: Updates `UserEducation` database model.
*   **Skills Manager (Add, Remove Skills)**: Updates `UserSkill` database model.
*   **Interests Manager (Add, Remove Interests)**: Updates `UserInterest` database model.
*   **Custom Profile Tabs Creator (Add, Edit title/content, Delete Tab)**: Updates `UserCustomTab` database model.
*   **Story Highlights Manager**:
    *   *Add Highlight bubble button*: Creates bubble.
    *   *Archive story picker checkboxes*: Aggregates selected archived images.
    *   *Upload story image button*: Adds stories.
    *   *Delete Highlight bubble button*: Clears highlight collection.
    *   *Save and Cancel buttons*: Commits changes.

### Admin Dashboard (Actions)
**Source Files**: Located inside the [admin](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/admin) directory.
*   **Approve / Reject Request Buttons**: Updates status on upgrade logs.
*   **Feature / Pin Post Toggle Button**: Alters status inside `Post` table.
*   **Delete Post Button**: Removes post, logging the ban action.
*   **User Role Selector Dropdown**: Toggles roles (`NORMAL`, `CIRCLE`, `AUTHOR`, `ADMIN`).
*   **Ban / Unban User Button**: Updates banned state on target users.
*   **Admin Settings Submit Button**: Updates preset values in the `AdminSetting` database model.
