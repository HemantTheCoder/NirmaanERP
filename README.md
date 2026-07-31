# Nirmaan ERP

A modern, production-grade construction management ERP built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Recharts**, and **Supabase**.

---

## Features

- **Dashboard**: Real-time project KPIs, active project progress lists, and upcoming meeting widgets.
- **Projects**: Project CRUD, status lifecycle management (`planning`, `active`, `on_hold`, `completed`), and progress calculations.
- **My Workspace**: Interactive Drag-and-Drop Kanban Task Board (`todo`, `in_progress`, `review`, `done`) with real-time assignment guards.
- **Schedule & Calendar**: Month/Week view calendar with live RSVP buttons and text-only meeting minutes.
- **Notifications**: Low-overhead unread bell polling with automatic DB triggers for task assignments, meeting invites, and project status changes.
- **Reports & Analytics**: Recharts visual dashboards (Project Status Breakdown, Task Completion Trend, Team Workload, Project Progress Comparison), date/project filter bar, per-card CSV export, and print-to-PDF formatting.
- **Admin Console**: User provisioning & invitation, dynamic role management, active/inactive status toggles (blocking deactivated users at middleware), 7-table orphan checks before deletion, last-admin protection guards, access-control matrix, and global session revocation.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router & Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Database & Auth** | Supabase (Postgres, Row-Level Security, Auth) |
| **Charts & Data** | Recharts |
| **Drag & Drop** | `@dnd-kit/core` & `@dnd-kit/sortable` |
| **Icons** | Lucide React |

---

## Project Structure

```text
├── app/
│   ├── (auth)/           # Login & signup pages
│   ├── (dashboard)/      # Authenticated shell & pages
│   │   ├── admin/        # Admin console & role management
│   │   ├── dashboard/    # Main KPIs & project overview
│   │   ├── projects/     # Project management
│   │   ├── reports/      # Analytics & Recharts dashboards
│   │   ├── schedule/     # Calendar & meeting scheduling
│   │   ├── workspace/    # Kanban task board
│   │   ├── loading.tsx   # Dashboard loading skeleton
│   │   └── error.tsx     # Error boundary handler
│   ├── api/
│   │   └── admin/        # Isolated server-side API routes
│   ├── not-found.tsx     # Custom styled 404 page
│   ├── layout.tsx        # Root HTML shell & global CSS
│   └── page.tsx          # Root redirect
├── components/
│   ├── admin/            # UsersTab, RolesTab, SessionsTab, AdminView
│   ├── dashboard/        # KpiCard, ProjectProgressList, UpcomingMeetings
│   ├── layout/           # AppShell, Sidebar, Header, NotificationBell
│   ├── projects/         # Project Cards & Modals
│   ├── reports/          # ReportsView & Recharts cards
│   ├── schedule/         # CalendarView & Meeting Modals
│   └── workspace/        # KanbanBoard, KanbanColumn, TaskCard
├── lib/
│   ├── queries/          # Modular Supabase query layer
│   └── supabase/         # SSR & Client Supabase factories
├── supabase/
│   └── migrations/       # SQL Migrations (0001 to 0006)
├── scripts/
│   └── seed-demo-data.ts # Demo data seeder
└── proxy.ts              # Route protection & deactivation middleware
```

---

## Setup & Local Development

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/HemantTheCoder/NirmaanERP.git
cd NirmaanERP
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

### 3. Run Database Migrations

In your Supabase Dashboard **SQL Editor**, execute the migration files located in `supabase/migrations/` in sequential order:

1. `0001_initial_schema.sql` — Base tables, enums, RLS policies.
2. `0002_rls_hardening.sql` — RLS policy hardening for tasks & projects.
3. `0003_seed_data.sql` — Base project & task seeds.
4. `0004_scheduling.sql` — Meetings, attendees, minutes, notifications, and triggers.
5. `0005_reports_and_completed_at.sql` — Completion tracking & backfilling.
6. `0006_admin_users_is_active.sql` — User active/inactive status column.

### 4. Seed Realistic Demo Data

Run the seeder script to populate realistic accounts, projects, tasks, and meetings:

```bash
npx tsx scripts/seed-demo-data.ts
```

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Demo Accounts Reference

All demo accounts share the default password: **`Demo@1234`**

| Role | Name | Email | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | Rahul Sharma | `pm1@nirmaan.dev` | Full access, user management, reports, projects |
| **Project Manager** | Priya Patel | `pm2@nirmaan.dev` | Projects, tasks, schedule, reports |
| **Site Staff** | Amit Kumar | `siteeng1@nirmaan.dev` | My Workspace, task updates, schedule |
| **Site Staff** | Sneha Verma | `siteeng2@nirmaan.dev` | My Workspace, task updates, schedule |
| **Site Staff** | Vikas Singh | `siteeng3@nirmaan.dev` | My Workspace, task updates, schedule |
| **Site Staff** | Ananya Joshi | `siteeng4@nirmaan.dev` | My Workspace, task updates, schedule |
| **Client** | Vikram Mehta | `client1@nirmaan.dev` | Read-only project & workspace visibility |
| **Client** | Sunita Reddy | `client2@nirmaan.dev` | Read-only project & workspace visibility |

---

## License

MIT © Nirmaan ERP
