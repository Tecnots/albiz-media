# Albiz Media

Social platform for thinkers, builders, and creators. Live at [albizmedia.com](https://albizmedia.com).

## Stack

- **Framework** — Next.js 16.1.1 (App Router, Turbopack)
- **Database** — PostgreSQL on Supabase via Prisma ORM
- **Auth** — NextAuth.js v4 (credentials + Google OAuth), JWT sessions
- **Styling** — Tailwind CSS v4, Framer Motion, Lucide icons
- **Rich text** — Tiptap editor
- **Email** — Nodemailer (Gmail SMTP)
- **File storage** — Azure Blob Storage
- **Native mobile** — Capacitor 8 (iOS + Android, user side only)
- **Deployment** — Vercel (team: Tecnots)

## Project structure

```
app/
  (main)/          # User-facing app (feed, explore, circle, shorts, messages, etc.)
  admin/           # Admin panel (users, content, approvals, analytics, etc.)
  api/             # All API routes
  lib/             # Shared utilities (auth, email, capacitor, etc.)
prisma/
  schema.prisma    # Database schema
  seed.ts          # Seed script
lib/
  prisma.ts        # Prisma client singleton (uses @prisma/adapter-pg)
capacitor.config.ts
```

## Getting started

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in the values (see [Environment variables](#environment-variables) below).

```bash
# Push schema to database
pnpm db:push

# Run dev server (binds to 0.0.0.0 for LAN access)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string (PgBouncer, port 6543) |
| `DIRECT_URL` | Supabase direct connection string (port 5432) — used for migrations |
| `NEXTAUTH_URL` | Full URL of the app (e.g. `https://albizmedia.com`) |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP port (465 for SSL) |
| `SMTP_SECURE` | `true` for SSL/TLS |
| `SMTP_USER` | SMTP username / sender address |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address |
| `SMTP_FROM_NAME` | From display name |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Google Maps map ID |
| `NIA_API_KEY` | Nia AI API key |

> `DATABASE_URL` is used at runtime (pooled). `DIRECT_URL` is used by Prisma migrations and `db push` only.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server on `0.0.0.0:3000` |
| `pnpm build` | Generate Prisma client + production build |
| `pnpm start` | Start production server |
| `pnpm db:push` | Push schema changes to the database |
| `pnpm db:seed` | Run the database seed script |
| `pnpm cap:sync` | Sync web build to Capacitor native projects |
| `pnpm cap:open:ios` | Open iOS project in Xcode |
| `pnpm cap:open:android` | Open Android project in Android Studio |

## Database

Schema is managed with Prisma. After changing `prisma/schema.prisma`, run:

```bash
pnpm db:push
```

For production, `db push` is run manually before deploying. The Prisma client is regenerated automatically during `pnpm build` (`prisma generate` is prepended to the build step).

## Deployment

Deployed to Vercel under the **Tecnots** team. The production URL is [albizmedia.com](https://albizmedia.com).

```bash
vercel --prod --scope tecnots
```

All environment variables are configured in the Vercel dashboard under the Tecnots team project.

## Mobile (Capacitor)

The user-facing side of the app is wrapped as a native app using Capacitor 8. The admin panel is excluded from native builds.

Capacitor uses a **server-based** approach — the WebView loads from the deployed URL (`albizmedia.com`) rather than a static bundle. This is required because the app uses SSR and API routes.

After making changes:

```bash
pnpm build
pnpm cap:sync
pnpm cap:open:ios      # then build + run from Xcode
pnpm cap:open:android  # then build + run from Android Studio
```

## Auth

- **Credentials login** — email + password via `/api/auth/login`. Passwords are hashed with scrypt.
- **Google OAuth** — via NextAuth.js. Creates a new user on first sign-in, links an `Account` record for subsequent logins.
- **Email verification** — new accounts receive a 24-hour verification token. Users must verify before logging in.
- **Roles** — `NORMAL`, `CIRCLE`, `AUTHOR`, `ADMIN`. Circle members get access to the private circle feed and messaging.
