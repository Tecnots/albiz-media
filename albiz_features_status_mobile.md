# Albiz Media - Mobile & Native Feature Implementation Status Audit

This document maps all application modules, user interface elements, and native Capacitor plugin integrations (Haptics, Camera, Share, Toasts, Status Bars, and Keyboard handlers) to their implementation status on mobile devices (iOS / Android).

> [!NOTE]
> **Mobile Role Scope**: The mobile application is scoped strictly to **Normal** and **Circle** user roles. The **Admin Console** and **Author Management** interfaces are Web-only features and are excluded from this mobile status audit. On mobile, users can only submit circle upgrade requests, consume feed/circle content, and receive notifications about their request approvals or rejections.

---

## 1. Not Started
These elements are visible in the UI but lack any operational client page, trigger logic, or database/API backend.

### Settings Page
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/settings/page.tsx)
*   **Billing Switch Pill**: Clicking "Billing" under settings tabs list.
    *   *UI Result*: Displays static text placeholder `"Billing settings coming soon."`
*   **Security Switch Pill**: Clicking "Security" under settings tabs list.
    *   *UI Result*: Displays static text placeholder `"Security settings coming soon."`

---

## 2. Dummy / Mock Data
These interactive elements are functional on the client-side but use statically defined arrays, local state overrides, or programmatically generated random data, bypassing real database/API servers.

### Shorts (Short Video Feed)
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/shorts/page.tsx)
*   **Shorts Category Pills**: Toggling Tech, Startups, Business, Finance, etc.
    *   *Behavior*: Re-filters local programmatic mock array generated in-memory.
*   **Country Filter Dropdown**: Clicking country selector (US, India, UK, etc.).
    *   *Behavior*: Alters local state; no database filter query is triggered.
*   **Card Click (Grid item)**: Opens full-screen video player modal.
    *   *Behavior*: Displays statically loaded mock cards from Picsum.
*   **Play/Pause Video Body Trigger**: Clicking the video viewport area.
    *   *Behavior*: Toggles a local play state hook and shows play overlay icon.
*   **Volume Mute/Unmute Toggle (Volume2/VolumeX icon)**:
    *   *Behavior*: Toggles mute state locally in the player view.
*   **Like (Heart) Button**: Toggles fill state and increments local number counter.
    *   *Behavior*: Saved in local state; does not write to database.
*   **Comment (MessageCircle) Button**: Opens comments panel.
    *   *Behavior*: Renders mock comments list from static variables.
*   **Bookmark (Bookmark) Button**: Toggles saved state.
    *   *Behavior*: Local client-side hook state toggle.

### News Feed Content
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/page.tsx)
*   **News Feed Article Rows**: Clicking static articles in the feed.
    *   *Behavior*: Loaded statically from [data.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/lib/data.ts) (`newsArticles`) rather than fetched from the database on initial feed load.

### Sponsored Posts & Ads
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/page.tsx)
*   **Sponsored Cards**: Rendered dynamically in feed index loops.
    *   *Behavior*: Hardcoded in [data.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/lib/data.ts) (`sponsoredPosts`) and injected on the client side.

---

## 3. Partially Implemented Features
These features have active database models and operational APIs, but include testing shortcuts, temporary session data, missing integration steps, or localized fallback mocks.

### Circle Creator Upgrade Request Form
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/circle-upgrade/route.ts)
*   **Upgrade Trigger ("Apply for Circle" button)**: Emits `albiz-circle-upgrade` custom event.
    *   *Behavior*: Opens the overlay multi-step wizard.
*   **Registration Inputs (Full Name, Title, Company, LinkedIn, Website, Bio, Reason)**: Form fields.
    *   *Behavior*: Captures details correctly.
*   **Verification Document File Picker**: File browser uploader.
    *   *Behavior*: Saves documents to Azure Blob Storage container.
*   **Form Submit Button**: Submits the request.
    *   *Behavior*: Correctly logs data inside `CircleUpgradeRequest`, `CircleUpgradeRegistration`, and `CircleUpgradeDocument` tables.
    *   *Testing Bypass*: Immediately updates the user role to `CIRCLE` and `isPremium = true` upon submission for testing purposes, bypassing admin review. The request review process itself is Web-only.
    *   *Email Gap*: Automatic confirmation email dispatch is disabled and marked as `TODO`.

### E2E Encrypted Conversations
**Source File**: [crypto.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/lib/crypto.ts)
*   **Encryption Switch Toggle**: Slider in conversation header page.
    *   *Behavior*: Sets `encryptionEnabled = true` in the database `Conversation` table.
*   **Encrypted Message Send**: Message text fields.
    *   *Behavior*: Encrypts text payloads client-side. However, key pairs are regenerated on reload/refresh, breaking historical E2E message decryption.

### Social Connected Inbox (Omnichannel DMs)
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/social/threads/%5Bid%5D/messages/route.ts)
*   **Connect Platform Button**: Triggers OAuth redirections for connected networks.
    *   *Behavior*: Successfully handles webhook callbacks for Meta channels (Instagram, WhatsApp, Messenger, Facebook).
*   *Twitter/X*: Code is fully complete but requires a paid basic/higher developer API tier. Forbidden on free developer credentials.
*   *Telegram*: Outbound messages send to bot API, but inbound webhook sync is missing.
*   *LinkedIn*: Explicitly declared as unsupported.
*   **Send Failure Fallback**: If sending to the platform fails, the message is still saved to the local database as `outbound` so that the chat UI remains responsive in offline/development environments.

### Creator Analytics Dashboard
**Source File**: [route.ts](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/api/analytics/route.ts)
*   **Dashboard Stats (Total Views, Likes, Followers, Stories Views/Likes)**: Page summary metrics.
    *   *Behavior*: Aggregated and loaded via database transactions.
*   **Follower/Engagement Sparkline Charts**: Small line charts.
    *   *Behavior*: Populated using `Math.random()` values in the JSON API responses.

---

## 4. Completed Features
These features are fully implemented, database-backed, and functional.

### Activities Feed (Main Feed & Post Cards)
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

### Credentials / Social Sign-In
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

### Request Approval Notifications
**Source File**: [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/notifications/page.tsx)
*   **Mark all read button**: Updates unread fields in notifications database.
*   **Notifications filter tabs (Today, Yesterday, Earlier)**: Switch filters.
*   **Notification items for Follow, Like, Comment, and Circle Request events**: Navigates to corresponding chat/posts, showing alerts for circle request status updates (`CIRCLE_PENDING`, `CIRCLE_WELCOME`, `CIRCLE_REJECTED`).

---

## 5. Mobile Native Capacitor Integrations
These elements represent hardware, system, or OS-level integrations handled via Capacitor plugins.

### Completed (Mobile Native)
*   **Native Camera & Gallery Picker (Avatar selection)**: Clicking the profile avatar change camera icon in [page.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/[handle]/page.tsx).
    *   **Behavior**: Opens the native system Action Sheet with options: `Camera`, `Gallery`, or `Cancel`. Launches the device camera or gallery to crop and upload photos via `@capacitor/camera` and `@capacitor/action-sheet`.
*   **Vibration Feedback (Haptics)**: Clicking layout navigation buttons or the main float create (FAB) button in [layout.tsx](file:///d:/tecnots/workspace/capacitor%20projects/albiz-media/app/(main)/layout.tsx).
    *   **Behavior**: Triggers physical tactile impact responses (`ImpactStyle.Light` or `ImpactStyle.Medium`) via `@capacitor/haptics`.
*   **Native Share Sheet (Shorts / Posts / Profiles)**: Clicking the share buttons in card views.
    *   **Behavior**: Opens the system-native sharing panel using `@capacitor/share`. If run in a standard desktop web browser, it gracefully falls back to copying the text to the clipboard.
*   **Native Toast Notifications**: Triggered when copying links (such as custom profile URLs) in settings or profile views.
    *   **Behavior**: Triggers a native alert popup banner using `@capacitor/toast` instead of rendering standard HTML divs.
*   **Keyboard Safe Areas Layout Hook**: Monitored when a text input field (like chat message input) is active.
    *   **Behavior**: Monitors `keyboardWillShow` and `keyboardWillHide` via `@capacitor/keyboard` and sets the CSS variable `--keyboard-height` dynamically so that the text input shifts above the mobile soft keyboard.
*   **Android Hardware Back Button**: Pressing the physical back button on Android devices.
    *   **Behavior**: Listens for the event using `@capacitor/app` and triggers history backtracking or exits the application context safely.
*   **Local Network LAN Server Binding**:
    *   **Behavior**: The development server is bound to `0.0.0.0:3000` to allow local device testing over Wi-Fi.
