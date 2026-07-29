export type UserRole = "admin" | "project_manager" | "site_staff" | "client";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: "planning" | "active" | "on_hold" | "completed";
          start_date: string | null;
          end_date: string | null;
          manager_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: "planning" | "active" | "on_hold" | "completed";
          start_date?: string | null;
          end_date?: string | null;
          manager_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: "planning" | "active" | "on_hold" | "completed";
          start_date?: string | null;
          end_date?: string | null;
          manager_id?: string | null;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: "todo" | "in_progress" | "review" | "done";
          priority: "low" | "medium" | "high" | "urgent";
          project_id: string | null;
          assignee_id: string | null;
          due_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "review" | "done";
          priority?: "low" | "medium" | "high" | "urgent";
          project_id?: string | null;
          assignee_id?: string | null;
          due_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "review" | "done";
          priority?: "low" | "medium" | "high" | "urgent";
          project_id?: string | null;
          assignee_id?: string | null;
          due_date?: string | null;
          created_at?: string;
        };
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          check_in: string | null;
          check_out: string | null;
          status: "present" | "absent" | "half_day" | "on_leave";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          check_in?: string | null;
          check_out?: string | null;
          status?: "present" | "absent" | "half_day" | "on_leave";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          check_in?: string | null;
          check_out?: string | null;
          status?: "present" | "absent" | "half_day" | "on_leave";
          created_at?: string;
        };
      };
      leaves: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          type: "casual" | "sick" | "earned" | "unpaid";
          status: "pending" | "approved" | "rejected";
          reason: string | null;
          approved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          type?: "casual" | "sick" | "earned" | "unpaid";
          status?: "pending" | "approved" | "rejected";
          reason?: string | null;
          approved_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_date?: string;
          end_date?: string;
          type?: "casual" | "sick" | "earned" | "unpaid";
          status?: "pending" | "approved" | "rejected";
          reason?: string | null;
          approved_by?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
  };
}
