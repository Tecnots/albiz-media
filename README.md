# Albiz Media

Social platform for thinkers, builders, and creators. Live at [https://albizmedia.com](https://albizmedia.com).

---

# Stack

- **Framework** — Next.js 16.1.1 (App Router)
- **Database** — PostgreSQL (Supabase) with Prisma ORM
- **Authentication** — NextAuth.js v5 (beta), JWT sessions
- **Styling** — Tailwind CSS v4, Framer Motion, Lucide Icons
- **Rich Text Editor** — Tiptap
- **Email** — Nodemailer (SMTP)
- **Storage** — Azure Blob Storage
- **Native Mobile** — Capacitor 8 (Android & iOS)
- **Deployment** — Vercel (Tecnots Team)

---

# Project Structure

```text
app/
  (main)/          User-facing application
  admin/           Admin dashboard
  api/             API routes
  lib/             Shared utilities

lib/
  prisma.ts        Prisma client singleton

prisma/
  migrations/      Database migrations
  schema.prisma    Prisma schema
  seed.ts          Seed script

capacitor.config.ts
```

---

# Getting Started

Install dependencies:

```bash
pnpm install
```

Copy the environment file:

```bash
cp .env.example .env
```

Configure all required environment variables.

Apply existing database migrations:

```bash
npx prisma migrate deploy
```

Start the development server:

```bash
pnpm dev
```

Open:

```
http://localhost:3000
```

---

# Environment Variables

| Variable | Description |
|-----------|-------------|
| DATABASE_URL | Supabase pooled connection (PgBouncer - port 6543) |
| DIRECT_URL | Direct PostgreSQL connection (port 5432) used for Prisma migrations |
| NEXTAUTH_URL | Application URL |
| NEXTAUTH_SECRET | Secret used to sign JWTs |
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret |
| SMTP_HOST | SMTP Host |
| SMTP_PORT | SMTP Port |
| SMTP_SECURE | true for SSL |
| SMTP_USER | SMTP Username |
| SMTP_PASS | SMTP Password |
| SMTP_FROM | Sender email |
| SMTP_FROM_NAME | Sender display name |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | Google Maps API Key |
| NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID | Google Maps Map ID |
| NIA_API_KEY | NIA AI API Key |

> **DATABASE_URL** is used by the application at runtime.
>
> **DIRECT_URL** is used by Prisma for schema migrations.

---

# Available Scripts

| Command | Description |
|----------|-------------|
| pnpm dev | Start development server |
| pnpm build | Generate Prisma client and build production app |
| pnpm start | Start production server |
| pnpm db:push | Push schema changes directly to the database (local prototyping only) |
| pnpm db:seed | Seed the database |
| pnpm cap:sync | Sync Capacitor project |
| pnpm cap:open:ios | Open iOS project |
| pnpm cap:open:android | Open Android project |

---

# Database Workflow

This project uses **Prisma Migrations**.

## Development

When modifying `prisma/schema.prisma`, create and apply a migration:

```bash
npx prisma migrate dev
```

This will:

- Generate a migration
- Apply it locally
- Update the Prisma Client

If you are only experimenting locally and do not want to create a migration yet, you may use:

```bash
pnpm db:push
```

This is intended **only for local prototyping** and should **not** be used in production workflows.

## Production & CI

Production and Preview deployments automatically execute:

```bash
npx prisma migrate deploy
```

using the committed migration files inside:

```text
prisma/migrations/
```

`migrate deploy` only applies reviewed migration files and does not modify the database schema directly from `schema.prisma`.

The Prisma Client is automatically regenerated during the build process.

---

# Deployment

The application is deployed to **Vercel** under the **Tecnots** team.

Production URL:

https://albizmedia.com

Deploy manually:

```bash
vercel --prod --scope tecnots
```

Environment variables are managed through the Vercel project settings.

---

# Mobile (Capacitor)

The user-facing application is wrapped using **Capacitor 8**.

The admin dashboard is excluded from native builds.

The mobile application loads the deployed website inside a native WebView because the project relies on:

- Server Side Rendering (SSR)
- API Routes
- Authentication
- Dynamic rendering

Development:

```bash
pnpm cap:run:android:dev

pnpm cap:run:ios:dev
```

Production:

```bash
pnpm cap:run:android:prod

pnpm cap:run:ios:prod
```

Development with Live Reload:

```bash
pnpm cap:run:android:dev:live

pnpm cap:run:ios:dev:live
```

---

# Authentication

Authentication is powered by **NextAuth.js v5 (beta)**.

Supported methods:

- Email & Password (Credentials)
- Google OAuth
- Firebase Authentication (mobile)

Features:

- JWT Sessions
- Email Verification
- Password hashing using scrypt
- Two-Factor Authentication
- Role-based authorization

Roles:

- NORMAL
- CIRCLE
- AUTHOR
- EDITOR
- ADMIN

---

# Storage

Media uploads are stored in **Azure Blob Storage**.

The application resolves media URLs automatically before serving them to clients.

---

# Technology Summary

- Next.js 16
- React 19
- Prisma ORM
- PostgreSQL (Supabase)
- NextAuth.js v5
- Tailwind CSS v4
- Framer Motion
- Tiptap Editor
- Azure Blob Storage
- Capacitor 8
- Firebase
- Vercel