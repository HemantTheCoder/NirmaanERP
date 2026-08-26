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
