export type UserRole = "admin" | "project_manager" | "site_staff" | "client";
export type LocationType = "on_site" | "virtual";
export type MeetingStatus = "scheduled" | "completed" | "cancelled";
export type RsvpStatus = "pending" | "accepted" | "declined";
export type NotificationType =
  | "task_assigned"
  | "meeting_invite"
  | "status_change"
  | "approval_needed";

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
          is_active: boolean;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          is_active?: boolean;
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
          start_date: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
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
          start_date?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
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
          start_date?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
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
          rejection_reason: string | null;
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
          rejection_reason?: string | null;
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
          rejection_reason?: string | null;
          created_at?: string;
        };
      };
      meetings: {
        Row: {
          id: string;
          title: string;
          project_id: string | null;
          organizer_id: string;
          start_time: string;
          end_time: string;
          location_type: LocationType;
          location_detail: string | null;
          status: MeetingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          project_id?: string | null;
          organizer_id: string;
          start_time: string;
          end_time: string;
          location_type?: LocationType;
          location_detail?: string | null;
          status?: MeetingStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          project_id?: string | null;
          organizer_id?: string;
          start_time?: string;
          end_time?: string;
          location_type?: LocationType;
          location_detail?: string | null;
          status?: MeetingStatus;
          created_at?: string;
        };
      };
      meeting_attendees: {
        Row: {
          meeting_id: string;
          user_id: string;
          rsvp_status: RsvpStatus;
        };
        Insert: {
          meeting_id: string;
          user_id: string;
          rsvp_status?: RsvpStatus;
        };
        Update: {
          meeting_id?: string;
          user_id?: string;
          rsvp_status?: RsvpStatus;
        };
      };
      meeting_minutes: {
        Row: {
          id: string;
          meeting_id: string;
          content: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          content: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          content?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          message: string;
          link: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          message: string;
          link?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          message?: string;
          link?: string;
          read?: boolean;
          created_at?: string;
        };
      };
      resource_allocations: {
        Row: {
          id: string;
          project_id: string;
          resource_type: ResourceType;
          resource_name: string;
          quantity: number;
          unit: string;
          status: ResourceStatus;
          requested_by: string;
          approved_by: string | null;
          requested_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          resource_type: ResourceType;
          resource_name: string;
          quantity?: number;
          unit: string;
          status?: ResourceStatus;
          requested_by: string;
          approved_by?: string | null;
          requested_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          resource_type?: ResourceType;
          resource_name?: string;
          quantity?: number;
          unit?: string;
          status?: ResourceStatus;
          requested_by?: string;
          approved_by?: string | null;
          requested_date?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      project_documents: {
        Row: {
          id: string;
          project_id: string;
          file_name: string;
          file_path: string;
          file_type: string;
          file_size: number;
          category: DocumentCategory;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          file_name: string;
          file_path: string;
          file_type: string;
          file_size: number;
          category?: DocumentCategory;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          file_name?: string;
          file_path?: string;
          file_type?: string;
          file_size?: number;
          category?: DocumentCategory;
          uploaded_by?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      location_type: LocationType;
      meeting_status: MeetingStatus;
      rsvp_status: RsvpStatus;
      notification_type: NotificationType;
      resource_type: ResourceType;
      resource_status: ResourceStatus;
      document_category: DocumentCategory;
    };
  };
}

export type ResourceType = "material" | "equipment" | "labor";
export type ResourceStatus = "requested" | "approved" | "in_use" | "released" | "rejected";
export type DocumentCategory = "drawing" | "contract" | "report" | "photo" | "other";
