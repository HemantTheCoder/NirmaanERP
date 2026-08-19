# Nirmaan ERP

A modern, production-grade construction management ERP built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Recharts**, and **Supabase**.

---

## Features

- **Dashboard**: Real-time project KPIs, active project progress lists, and upcoming meeting widgets.
- **Projects**: Project CRUD, status lifecycle management (`planning`, `active`, `on_hold`, `completed`), and progress calculations.
- **My Workspace**: Interactive Drag-and-Drop Kanban Task Board (`todo`, `in_progress`, `review`, `done`) with real-time assignment guards.
- **Schedule & Calendar**: Month/Week view calendar with live RSVP buttons and text-only meeting minutes.
- **Notifications**: Low-overhead unread bell polling with automatic DB triggers for task assignments, meeting invites, and project status changes.
- **Reports & Analytics**: Recharts visual dashboards (Project Status Breakdown, Task Completion Trend, Team Workload, Project Progress Comparison, Delays & Daily Site PPC), date/project filter bar, per-card CSV export, and print-to-PDF formatting.
- **Admin Console**: User provisioning & invitation, dynamic role management, active/inactive status toggles (blocking deactivated users at proxy), 7-table orphan checks before deletion, last-admin protection guards, access-control matrix, and global session revocation.
- **Procurement**: Vendor directory and purchase orders with a draft → pending approval → approved → ordered → received workflow.
- **Subcontractor Management**: Contracts with retention %, and 3-axis (quality/timeliness/safety) performance ratings.
- **Inventory & Equipment**: Material stock tracking with an auto-syncing DB trigger on receipt/issue/return transactions, plus equipment status and maintenance logs.
- **RFIs & Change Orders**: RFI respond/close workflow; change orders with cost/schedule impact through a draft → pending approval → approved → implemented chain.
- **Delay Tracking & PPC**: Daily Progress Report checklists (planned vs. actually completed work items) compute a per-report PPC (Percent Plan Complete); a DB trigger alerts the project manager and admins when PPC falls below the 80% target. A separate delay log (at most one open delay per project, enforced by a partial unique index) tracks reason, rectification notes, and days-to-rectify, with a status badge on the project detail page and card, and a dedicated Delays & PPC section in Reports.
- **Contact & Messaging**: Read-only contact cards (`/profile/[userId]`) linked from task assignees, with a 1:1 direct-message chat panel delivered live via Supabase Realtime (`postgres_changes`) rather than polling — the first Realtime usage in the app.

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
│   │   ├── profile/      # Read-only contact card ([userId]) & chat
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
│   ├── projects/         # Project Cards, Modals, DelayStatusPanel
│   ├── profile/          # ContactCard, ChatPanel (Realtime)
│   ├── reports/          # ReportsView & Recharts cards
│   ├── schedule/         # CalendarView & Meeting Modals
│   └── workspace/        # KanbanBoard, KanbanColumn, TaskCard
├── lib/
│   ├── queries/          # Modular Supabase query layer (delays.ts, messages.ts, dpr.ts, etc.)
│   └── supabase/         # SSR & Client Supabase factories
├── supabase/
│   └── migrations/       # SQL Migrations (0001 to 0040 — see list below)
├── scripts/
│   └── seed-demo-data.ts # Demo data seeder
└── proxy.ts              # Route protection & deactivation (Next.js 16 renamed `middleware.ts` to `proxy.ts`)
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
7. `0007_leave_management.sql` — Leave management & notification triggers.
8. `0008_task_start_date.sql` — Task start date for Gantt timeline.
9. `0009_resource_allocation.sql` — Resource allocation tracking.
10. `0010_project_documents.sql` — Project documentation center.
11. `0011_profile_and_attendance.sql` — Profile & attendance (My Workspace additions).
12. `0012_grievances.sql` — Grievances & issue reporting.
13. `0013_client_portal.sql` — Client-specific portal view & RLS hardening.
14. `0014_safety_incidents.sql` — Safety incident & near-miss reporting.
15. `0015_notification_type_enum.sql` — Add `safety`/`grievance` to `notification_type` (isolated — `ALTER TYPE ... ADD VALUE` can't run inside a transaction with other DDL).
16. `0016_contractor_role_enum.sql` — Contractor role enum addition.
17. `0017_tendering.sql` — Tendering schema, tables & RLS policies.
18. `0018_tendering_notifications.sql` — Tendering triggers & automatic notifications.
19. `0019_fix_leave_notification_trigger.sql` — Fix `notify_leave_status()` trigger.
20. `0020_tender_detailed_terms.sql` — Detailed tender terms (EMD, fees, legal, window).
21. `0021_fix_resource_allocations_rls.sql` — Clean purge & fix `resource_allocations` RLS.
22. `0022_attendance_timestamptz.sql` — Attendance `TIMESTAMPTZ` column migration.
23. `0023_finance_budgeting.sql` — Finance & budgeting (lightweight).
24. `0024_punch_list.sql` — Punch list & defect tracking with photo annotation.
25. `0025_daily_progress_reports.sql` — Daily Progress Reports (DPR).
26. `0026_digital_signatures.sql` — Digital signature acknowledgments (append-only audit log).
27. `0027_geofenced_attendance.sql` — GPS-geofenced attendance check-in.
28. `0028_fix_meetings_rls.sql` — Fix meetings RLS for admin & PM visibility.
29. `0029_punch_photos_bucket.sql` — Dedicated public storage bucket for punch photos.
30. `0030_fix_users_signup_rls.sql` — Fix RLS policy on `public.users` for signup/profile creation.
31. `0031_fix_users_rls_policies.sql` — Restrict `public.users` INSERT/SELECT policies to `authenticated`.
32. `0032_procurement.sql` — Procurement: `vendors`, `purchase_orders`, `purchase_order_items`.
33. `0033_subcontractor_management.sql` — Subcontractor management: `subcontracts`, performance reviews.
34. `0034_inventory_equipment.sql` — Inventory & equipment tracking, with an auto-syncing stock trigger.
35. `0035_rfis_change_orders.sql` — RFIs & change orders.
36. `0036_dpr_checklist.sql` — DPR planned-vs-actual checklist (`dpr_checklist_items`) and PPC computation.
37. `0037_notification_type_delay_ppc.sql` — Add `ppc_below_target`/`delay_reported`/`delay_rectified`/`new_message` (isolated, same reason as 0015).
38. `0038_project_delays.sql` — Project delay tracking (`project_delays`, one open delay per project) & PPC-below-target alerting.
39. `0039_users_phone.sql` — Add `phone` column to `public.users`.
40. `0040_messages.sql` — 1:1 direct messaging (`messages`), Realtime-enabled, with a message-new-value guard trigger.

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
