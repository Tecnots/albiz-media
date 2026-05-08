# Connecting Real Platforms

Your callback URL pattern is: `https://yourdomain.com/api/social/callback/<platform>`  
Your webhook URL pattern is: `https://yourdomain.com/api/social/webhook/<platform>`

> [!IMPORTANT]
> While developing locally, none of the platforms accept `localhost` as a callback or webhook URL. Use [ngrok](https://ngrok.com) or [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) to get a public HTTPS tunnel:
> ```
> ngrok http 3000
> ```
> Then set `APP_URL=https://xxxx.ngrok-free.app` in `.env` and restart dev server.

---

## 1. Add to `.env`

```env
# Shared across all Meta platforms (WhatsApp, Instagram, Facebook, Messenger)
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=any_random_secret_you_choose   # e.g. albiz_webhook_verify

# Twitter / X
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# Telegram (no OAuth — just the bot token)
TELEGRAM_BOT_TOKEN=

# Public URL (required for OAuth callbacks and webhooks)
APP_URL=https://xxxx.ngrok-free.app   # replace with your tunnel URL
```

Restart the dev server after editing `.env`.

---

## 2. WhatsApp Business

### What you need
A **Meta for Developers** account + a **WhatsApp Business** app.

### Steps

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → **Business** type
2. Add product: **WhatsApp**
3. Under *WhatsApp → API Setup*, copy:
   - **Phone Number ID** (this is your `platformUserId` in the DB)
   - **WhatsApp Business Account ID**
4. Under *App Settings → Basic*, copy **App ID** → `META_APP_ID`  
   and **App Secret** → `META_APP_SECRET`
5. Under *WhatsApp → Configuration → Webhook*:
   - Callback URL: `https://yourdomain.com/api/social/webhook/whatsapp`
   - Verify Token: the value you set for `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: **messages** field
6. To connect: visit `https://yourdomain.com/api/social/connect/whatsapp?userId=<yourUserId>`

### Required permissions
`whatsapp_business_management`, `whatsapp_business_messaging`

> [!NOTE]
> You need to use a **test phone number** Meta provides until your app is approved for production. Replies via the API only work within a **24-hour messaging window** after the customer messages you first (WhatsApp Business policy).

---

## 3. Instagram

### What you need
The same Meta app as WhatsApp + an **Instagram Business or Creator account** linked to a Facebook Page.

### Steps

1. In your Meta app → Add product: **Instagram**
2. Under *App Settings → Basic*, the same `META_APP_ID` / `META_APP_SECRET` apply
3. Under *Instagram → Webhooks*:
   - Callback URL: `https://yourdomain.com/api/social/webhook/instagram`
   - Verify Token: same `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: **messages** field
4. To connect: visit `https://yourdomain.com/api/social/connect/instagram?userId=<yourUserId>`

### Required permissions
`instagram_business_manage_messages`, `instagram_business_basic`

> [!IMPORTANT]
> `instagram_business_manage_messages` requires **Advanced Access** approval from Meta. While in development mode, only test users added to your app can connect.

---

## 4. Facebook / Messenger

### Steps

1. Same Meta app → Add product: **Messenger**
2. Under *Messenger → Webhooks*:
   - Callback URL: `https://yourdomain.com/api/social/webhook/messenger`
   - Verify Token: same `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: **messages**, **messaging_postbacks**
3. Link a Facebook Page to your app (required for Messenger)
4. To connect: visit `https://yourdomain.com/api/social/connect/messenger?userId=<yourUserId>`

### Required permissions
`pages_messaging`, `pages_manage_metadata`, `pages_show_list`

> [!NOTE]
> In development, only app admins and test users can interact. Submit for App Review to get production access.

---

## 5. Twitter / X

### What you need
A [Twitter Developer Portal](https://developer.twitter.com) account with a project and app that has **OAuth 2.0 + User Context** enabled.

### Steps

1. Go to [developer.twitter.com/en/portal](https://developer.twitter.com/en/portal) → Create Project → Create App
2. Under *App Settings → User Authentication Settings*:
   - OAuth 2.0: **On**
   - Type of App: **Web App**
   - Callback URI: `https://yourdomain.com/api/social/callback/twitter`
   - Website URL: your domain
3. Copy **Client ID** → `TWITTER_CLIENT_ID`  
   Copy **Client Secret** → `TWITTER_CLIENT_SECRET`
4. Under *Products → Account Activity API* (needs **Elevated** or **Enterprise** access):
   - Register a webhook URL: `https://yourdomain.com/api/social/webhook/twitter`
5. To connect: visit `https://yourdomain.com/api/social/connect/twitter?userId=<yourUserId>`

### Required scopes
`tweet.read users.read dm.read dm.write offline.access`

> [!IMPORTANT]
> DM access (`dm.read`, `dm.write`) requires applying for **Elevated** access in the developer portal. The free Basic tier does **not** include DM permissions.

---

## 6. Telegram

Telegram uses a **Bot API** — no OAuth. You get a bot token and register a webhook.

### Steps

1. Open Telegram → message **@BotFather** → `/newbot` → follow prompts
2. Copy the bot token (format: `123456:ABC-DEF...`) → `TELEGRAM_BOT_TOKEN`
3. Register the webhook by calling this URL once (replace with your values):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://yourdomain.com/api/social/webhook/telegram
   ```
4. Verify it worked:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```
5. To create a `SocialConnection` row for Telegram, run this in Prisma Studio or a script:
   ```ts
   await prisma.socialConnection.upsert({
     where: { userId_platform: { userId: 1, platform: "telegram" } },
     create: { userId: 1, platform: "telegram", platformUserId: "bot", platformHandle: "@YourBotName", accessToken: process.env.TELEGRAM_BOT_TOKEN!, active: true },
     update: { active: true },
   });
   ```

> [!NOTE]
> Users must message your bot first before it can reply to them (Telegram requirement). Once the webhook is registered, all messages to your bot flow into the Social inbox automatically.

---

## Webhook — what happens on first message

When any platform sends a webhook event to your app, the handler:
1. Finds the matching `SocialConnection`
2. **Upserts a `SocialThread`** keyed by `(connectionId, externalUserId)` — one thread per contact
3. Saves the `SocialMessage` linked to that thread with `direction: "inbound"`
4. Increments `unreadCount` on the thread

The message immediately appears in the **Social** tab in `/messages`.

---

## Quick test (no real account needed)

You can manually POST a fake webhook to verify the thread/message pipeline:

```bash
curl -X POST https://yourdomain.com/api/social/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "contacts": [{"wa_id": "919876543210", "profile": {"name": "Test User"}}],
          "messages": [{"id": "wamid.test1", "from": "919876543210", "text": {"body": "Hello from WhatsApp!"}}]
        }
      }]
    }]
  }'
```

This will create a thread and message in the DB (you need at least one active `SocialConnection` for `whatsapp` in the DB first).
