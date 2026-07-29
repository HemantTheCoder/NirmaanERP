# Nirmaan ERP

A modern construction management ERP built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 16 (App Router)             |
| Language    | TypeScript 5                        |
| Styling     | Tailwind CSS v4                     |
| Auth / DB   | Supabase (Postgres + Auth + Storage)|
| Icons       | Lucide React                        |
| Deploy      | Vercel                              |

---

## Project Structure

```
├── app/
│   ├── (auth)/           # Login & signup pages (no sidebar)
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/      # Authenticated shell — sidebar + header
│   │   ├── layout.tsx    # Validates session, fetches profile
│   │   ├── dashboard/    # Dashboard with KPIs, progress, meetings
│   │   ├── projects/     # Phase 2: project CRUD
│   │   ├── workspace/    # Phase 2: personal task board
│   │   ├── schedule/     # Phase 2: Gantt / calendar
│   │   ├── reports/      # Phase 2: analytics
│   │   └── admin/        # Admin-only settings
│   ├── layout.tsx        # Root HTML shell, fonts, global CSS
│   └── page.tsx          # Redirects "/" → "/dashboard"
├── components/
│   ├── auth/             # LoginForm, SignupForm
│   ├── dashboard/        # KpiCard, ProjectProgressList, UpcomingMeetings
│   └── layout/           # AppShell, Sidebar, Header
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # Browser client
│   │   └── server.ts     # Server component client
│   └── utils.ts          # cn() utility
├── types/
│   └── database.ts       # TypeScript types matching the DB schema
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql
├── middleware.ts          # Session refresh + route protection
├── .env.example
└── .env.local            # ← fill this in (never commit)
```

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/your-org/nirmaan-erp.git
cd nirmaan-erp
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Copy your **Project URL** and **anon public key** from  
   `Project Settings → API`

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Apply the database schema

Open the Supabase **SQL Editor** and paste the contents of  
`supabase/migrations/0001_initial_schema.sql`, then run it.

> This creates all tables, enums, RLS policies, and a trigger that  
> auto-creates a `public.users` profile row on every new signup.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## User Roles

| Role              | Description                         |
|-------------------|-------------------------------------|
| `admin`           | Full access — promoted manually in Supabase table editor |
| `project_manager` | Create/manage projects and tasks    |
| `site_staff`      | View tasks, log attendance          |
| `client`          | Read-only project visibility        |

> **Security note:** The signup form intentionally omits `admin` from the  
> role dropdown. To promote yourself to admin, run this in the SQL editor:  
> `UPDATE public.users SET role = 'admin' WHERE email = 'you@example.com';`

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**

The build should succeed with zero configuration — no custom build command needed.

---

## Roadmap

- **Phase 1 (current):** Foundation + navigation shell + dashboard
- **Phase 2:** Project CRUD, My Workspace task board, Supabase real-time
- **Phase 3:** Schedule / Gantt, Reports / analytics
- **Phase 4:** Admin panel, role management

---

## License

MIT © Nirmaan ERP
