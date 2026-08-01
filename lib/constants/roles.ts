import type { UserRole } from "@/types/database";

export interface RoleDefinition {
  id: UserRole;
  title: string;
  badge: string;
  badgeStyle: string;
  iconName: "ShieldCheck" | "Briefcase" | "HardHat" | "Building2" | "Gavel";
  summary: string;
  capabilities: string[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: "admin",
    title: "Administrator",
    badge: "Full System Control",
    badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    iconName: "ShieldCheck",
    summary: "Full system access including user management, role assignment, session control, all projects, and system-wide reports.",
    capabilities: [
      "Provision, invite, update, or hard-delete user accounts (with 11-table orphan safety check).",
      "Manage user role assignments and trigger immediate session revocation/force sign-out.",
      "Create, edit, and delete all company construction projects.",
      "Access all executive reports, analytics dashboards, CSV data exports, and PDF reports.",
      "Full oversight of all tendering packages, bid evaluations, and trade contract awards.",
      "Access everything available to Project Managers, Site Staff, Clients, and Contractors."
    ],
  },
  {
    id: "project_manager",
    title: "Project Manager",
    badge: "Operations & Execution",
    badgeStyle: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    iconName: "Briefcase",
    summary: "Create and manage projects, approve leaves and resource requests, resolve safety incidents, and award trade tenders.",
    capabilities: [
      "Create, edit, and manage assigned construction projects and progress milestones.",
      "Approve or reject staff leave requests and site resource allocations.",
      "Schedule meetings, record attendance, and publish meeting minutes.",
      "Resolve and close reported safety incidents and site grievances with corrective action notes.",
      "Create, publish, evaluate subcontractor bids, and award trade contracts.",
      "View executive report cards, PPC metrics, and export project analytics."
    ],
  },
  {
    id: "site_staff",
    title: "Site Staff",
    badge: "Field Operations",
    badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    iconName: "HardHat",
    summary: "Manage assigned tasks on Kanban, request leaves, mark daily attendance, request resources, and report safety events.",
    capabilities: [
      "Manage assigned tasks via 4-column Kanban board (To Do, In Progress, Review, Done).",
      "Submit leave requests and track approval status.",
      "Daily biometric attendance check-in and check-out with automatic late status calculation.",
      "Request site equipment, materials, and labor allocations.",
      "File safety incident tickets, near-miss reports, and site grievances.",
      "View project schedules, meeting invites, and shared drawings."
    ],
  },
  {
    id: "client",
    title: "Client",
    badge: "Project Portal & Progress",
    badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    iconName: "Building2",
    summary: "View linked project progress, timeline, and shared drawings (excluding financial contracts), and approve milestones.",
    capabilities: [
      "Access dedicated Client Portal showing ONLY linked project metrics and completion status.",
      "View project progress milestones and submit formal progress sign-offs.",
      "Access shared project drawings and documents (excluding internal financial contracts).",
      "Attend and review scheduled project alignment meetings.",
      "File issues or inquiries via the grievance system."
    ],
  },
  {
    id: "contractor",
    title: "Contractor",
    badge: "Tenders & Bidding",
    badgeStyle: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    iconName: "Gavel",
    summary: "Browse published tenders, download specification documents, submit commercial bids, and track proposal award status.",
    capabilities: [
      "Access dedicated Tendering Portal displaying published, closed, and awarded trade packages.",
      "Download trade tender specification documents, BOQ sheets, and drawings via signed URLs.",
      "Submit competitive commercial bids and proposal statements before package deadlines.",
      "Track submitted bid evaluation statuses (Submitted, Shortlisted, Awarded, Rejected).",
      "Strict data isolation: View ONLY own submitted proposals, never competing contractors' bid amounts."
    ],
  },
];

export interface PermissionRow {
  module: string;
  action: string;
  admin: boolean;
  project_manager: boolean;
  site_staff: boolean;
  client: boolean;
  contractor: boolean;
}

export const PERMISSIONS_MATRIX: PermissionRow[] = [
  // Projects
  { module: "Projects", action: "View Projects List & Progress", admin: true, project_manager: true, site_staff: true, client: true, contractor: false },
  { module: "Projects", action: "Create & Edit Project Details", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },
  { module: "Projects", action: "Delete Project", admin: true, project_manager: false, site_staff: false, client: false, contractor: false },

  // Tasks & Workspace
  { module: "Tasks", action: "View Assigned & Project Tasks", admin: true, project_manager: true, site_staff: true, client: true, contractor: false },
  { module: "Tasks", action: "Update Task Status & Notes", admin: true, project_manager: true, site_staff: true, client: false, contractor: false },
  { module: "Tasks", action: "Create & Reassign Tasks", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },

  // Schedule & Meetings
  { module: "Schedule", action: "View Calendar & Meeting Details", admin: true, project_manager: true, site_staff: true, client: true, contractor: false },
  { module: "Schedule", action: "Schedule New Meeting", admin: true, project_manager: true, site_staff: true, client: false, contractor: false },
  { module: "Schedule", action: "Update RSVP Status", admin: true, project_manager: true, site_staff: true, client: true, contractor: false },

  // Leaves & Resources
  { module: "Leaves", action: "Submit Leave Request", admin: true, project_manager: true, site_staff: true, client: false, contractor: false },
  { module: "Leaves", action: "Approve or Reject Leave Requests", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },
  { module: "Resources", action: "Request Site Resource Allocation", admin: true, project_manager: true, site_staff: true, client: false, contractor: false },
  { module: "Resources", action: "Approve & Dispatch Resources", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },

  // Tendering & Bidding
  { module: "Tendering", action: "Create & Publish Trade Tenders", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },
  { module: "Tendering", action: "Browse Published Tenders & Download Spec Docs", admin: true, project_manager: true, site_staff: false, client: false, contractor: true },
  { module: "Tendering", action: "Submit Commercial Bids & Proposals", admin: false, project_manager: false, site_staff: false, client: false, contractor: true },
  { module: "Tendering", action: "Evaluate Bids & Award Trade Contracts", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },

  // Safety & Grievances
  { module: "Safety", action: "Report Safety Incident or Near Miss", admin: true, project_manager: true, site_staff: true, client: false, contractor: false },
  { module: "Safety", action: "Resolve Safety Incident Tickets", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },
  { module: "Grievances", action: "File Grievance Ticket", admin: true, project_manager: true, site_staff: true, client: true, contractor: true },
  { module: "Grievances", action: "Resolve Grievance Status", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },

  // Client Portal & Reports
  { module: "Client Portal", action: "Access Dedicated Client View & Milestone Sign-Off", admin: false, project_manager: false, site_staff: false, client: true, contractor: false },
  { module: "Reports", action: "Access Executive Reports & Analytics", admin: true, project_manager: true, site_staff: false, client: false, contractor: false },

  // Admin Module
  { module: "Admin", action: "Access Admin Console & Provision Users", admin: true, project_manager: false, site_staff: false, client: false, contractor: false },
  { module: "Admin", action: "Force Sign-Out & Delete Users", admin: true, project_manager: false, site_staff: false, client: false, contractor: false },
];
