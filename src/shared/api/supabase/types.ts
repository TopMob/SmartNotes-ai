import type { SupabaseClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_agent_runs: {
        Row: {
          actions: Json
          conversation_excerpt: Json
          created_at: string
          error_message: string | null
          id: string
          owner_id: string
          request_message: string
          results: Json
          status: string
        }
        Insert: {
          actions?: Json
          conversation_excerpt?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id: string
          request_message?: string
          results?: Json
          status: string
        }
        Update: {
          actions?: Json
          conversation_excerpt?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id?: string
          request_message?: string
          results?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          model: string | null
          note_id: string
          owner_id: string
          prompt_version: string | null
          result: Json
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["smartnotes_ai_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          note_id: string
          owner_id: string
          prompt_version?: string | null
          result?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["smartnotes_ai_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          model?: string | null
          note_id?: string
          owner_id?: string
          prompt_version?: string | null
          result?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["smartnotes_ai_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          rating: number | null
          technical_data: Json | null
          text: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rating?: number | null
          technical_data?: Json | null
          text?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number | null
          technical_data?: Json | null
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          access_role: Database["public"]["Enums"]["smartnotes_access_role"]
          created_at: string
          description: string | null
          embedding: string | null
          folder_order: number
          id: string
          is_archived: boolean
          is_hidden: boolean
          is_system: boolean | null
          metadata: Json
          name: string
          owner_id: string
          trashed_at: string | null
          updated_at: string
        }
        Insert: {
          access_role?: Database["public"]["Enums"]["smartnotes_access_role"]
          created_at?: string
          description?: string | null
          embedding?: string | null
          folder_order?: number
          id?: string
          is_archived?: boolean
          is_hidden?: boolean
          is_system?: boolean | null
          metadata?: Json
          name?: string
          owner_id: string
          trashed_at?: string | null
          updated_at?: string
        }
        Update: {
          access_role?: Database["public"]["Enums"]["smartnotes_access_role"]
          created_at?: string
          description?: string | null
          embedding?: string | null
          folder_order?: number
          id?: string
          is_archived?: boolean
          is_hidden?: boolean
          is_system?: boolean | null
          metadata?: Json
          name?: string
          owner_id?: string
          trashed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_access: {
        Row: {
          created_at: string
          granted_by: string | null
          note_id: string
          role: Database["public"]["Enums"]["smartnotes_access_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          note_id: string
          role?: Database["public"]["Enums"]["smartnotes_access_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          note_id?: string
          role?: Database["public"]["Enums"]["smartnotes_access_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_access_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_effective_access: {
        Row: {
          created_at: string
          note_id: string
          role: Database["public"]["Enums"]["smartnotes_access_role"]
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note_id: string
          role?: Database["public"]["Enums"]["smartnotes_access_role"]
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          note_id?: string
          role?: Database["public"]["Enums"]["smartnotes_access_role"]
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_effective_access_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_effective_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_embeddings: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          note_id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          note_id: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          note_id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_embeddings_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_embeddings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_invites: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          invitee_email: string | null
          invitee_id: string | null
          inviter_id: string
          note_id: string
          role: Database["public"]["Enums"]["smartnotes_access_role"]
          status: Database["public"]["Enums"]["smartnotes_invite_status"]
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id: string
          note_id: string
          role?: Database["public"]["Enums"]["smartnotes_access_role"]
          status?: Database["public"]["Enums"]["smartnotes_invite_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id?: string
          note_id?: string
          role?: Database["public"]["Enums"]["smartnotes_access_role"]
          status?: Database["public"]["Enums"]["smartnotes_invite_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_invites_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_media: {
        Row: {
          client_media_id: string | null
          created_at: string
          file_id: string
          id: string
          mime_type: string
          name: string
          note_id: string
          provider: string
          size: number
          sort_order: number
          thumbnail_url: string | null
          url: string | null
        }
        Insert: {
          client_media_id?: string | null
          created_at?: string
          file_id: string
          id?: string
          mime_type: string
          name: string
          note_id: string
          provider: string
          size?: number
          sort_order?: number
          thumbnail_url?: string | null
          url?: string | null
        }
        Update: {
          client_media_id?: string | null
          created_at?: string
          file_id?: string
          id?: string
          mime_type?: string
          name?: string
          note_id?: string
          provider?: string
          size?: number
          sort_order?: number
          thumbnail_url?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_media_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_pages: {
        Row: {
          client_page_id: string | null
          content: string
          created_at: string
          drawing_data_url: string | null
          drawing_revision: number
          id: string
          note_id: string
          page_index: number
          title: string
          updated_at: string
        }
        Insert: {
          client_page_id?: string | null
          content?: string
          created_at?: string
          drawing_data_url?: string | null
          drawing_revision?: number
          id?: string
          note_id: string
          page_index?: number
          title?: string
          updated_at?: string
        }
        Update: {
          client_page_id?: string | null
          content?: string
          created_at?: string
          drawing_data_url?: string | null
          drawing_revision?: number
          id?: string
          note_id?: string
          page_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_pages_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          ai_error: string | null
          ai_processed: boolean
          ai_relevance: number
          ai_status: Database["public"]["Enums"]["smartnotes_ai_status"]
          analyzed: boolean
          content: string
          created_at: string
          embedding_summary: string | null
          favorite: boolean
          folder_id: string | null
          folder_order: number | null
          hidden_tags: string[]
          id: string
          is_archived: boolean
          lock_hash: string | null
          lock_hidden: boolean
          lock_salt: string | null
          lock_version: number | null
          manual_order: number
          metadata: Json
          owner_id: string
          pinned: boolean
          reminder_at: string | null
          resurfacing_class:
            | Database["public"]["Enums"]["smartnotes_resurfacing_class"]
            | null
          search_vector: unknown
          title: string
          trashed_at: string | null
          updated_at: string
          user_tags: string[]
        }
        Insert: {
          ai_error?: string | null
          ai_processed?: boolean
          ai_relevance?: number
          ai_status?: Database["public"]["Enums"]["smartnotes_ai_status"]
          analyzed?: boolean
          content?: string
          created_at?: string
          embedding_summary?: string | null
          favorite?: boolean
          folder_id?: string | null
          folder_order?: number | null
          hidden_tags?: string[]
          id?: string
          is_archived?: boolean
          lock_hash?: string | null
          lock_hidden?: boolean
          lock_salt?: string | null
          lock_version?: number | null
          manual_order?: number
          metadata?: Json
          owner_id: string
          pinned?: boolean
          reminder_at?: string | null
          resurfacing_class?:
            | Database["public"]["Enums"]["smartnotes_resurfacing_class"]
            | null
          search_vector?: unknown
          title?: string
          trashed_at?: string | null
          updated_at?: string
          user_tags?: string[]
        }
        Update: {
          ai_error?: string | null
          ai_processed?: boolean
          ai_relevance?: number
          ai_status?: Database["public"]["Enums"]["smartnotes_ai_status"]
          analyzed?: boolean
          content?: string
          created_at?: string
          embedding_summary?: string | null
          favorite?: boolean
          folder_id?: string | null
          folder_order?: number | null
          hidden_tags?: string[]
          id?: string
          is_archived?: boolean
          lock_hash?: string | null
          lock_hidden?: boolean
          lock_salt?: string | null
          lock_version?: number | null
          manual_order?: number
          metadata?: Json
          owner_id?: string
          pinned?: boolean
          reminder_at?: string | null
          resurfacing_class?:
            | Database["public"]["Enums"]["smartnotes_resurfacing_class"]
            | null
          search_vector?: unknown
          title?: string
          trashed_at?: string | null
          updated_at?: string
          user_tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          metadata: Json
          plan: Database["public"]["Enums"]["smartnotes_plan"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          metadata?: Json
          plan?: Database["public"]["Enums"]["smartnotes_plan"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          plan?: Database["public"]["Enums"]["smartnotes_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          cards_opacity: number
          created_at: string
          custom_presets: Json
          editor: Json
          folder_view_mode: Database["public"]["Enums"]["smartnotes_folder_view_mode"]
          id: string
          interface: Json
          lang: Database["public"]["Enums"]["smartnotes_lang"]
          main_background_url: string | null
          metadata: Json
          notes_per_page: number
          preset: Database["public"]["Enums"]["smartnotes_theme_preset"]
          reduce_motion: boolean
          sidebar_background_url: string | null
          ui_opacity: number
          updated_at: string
        }
        Insert: {
          cards_opacity?: number
          created_at?: string
          custom_presets?: Json
          editor?: Json
          folder_view_mode?: Database["public"]["Enums"]["smartnotes_folder_view_mode"]
          id: string
          interface?: Json
          lang?: Database["public"]["Enums"]["smartnotes_lang"]
          main_background_url?: string | null
          metadata?: Json
          notes_per_page?: number
          preset?: Database["public"]["Enums"]["smartnotes_theme_preset"]
          reduce_motion?: boolean
          sidebar_background_url?: string | null
          ui_opacity?: number
          updated_at?: string
        }
        Update: {
          cards_opacity?: number
          created_at?: string
          custom_presets?: Json
          editor?: Json
          folder_view_mode?: Database["public"]["Enums"]["smartnotes_folder_view_mode"]
          id?: string
          interface?: Json
          lang?: Database["public"]["Enums"]["smartnotes_lang"]
          main_background_url?: string | null
          metadata?: Json
          notes_per_page?: number
          preset?: Database["public"]["Enums"]["smartnotes_theme_preset"]
          reduce_motion?: boolean
          sidebar_background_url?: string | null
          ui_opacity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_google_integrations: {
        Row: {
          user_id: string
          provider: string
          access_token: string | null
          refresh_token: string
          scope: string | null
          token_type: string | null
          last_refreshed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          provider?: string
          access_token?: string | null
          refresh_token: string
          scope?: string | null
          token_type?: string | null
          last_refreshed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          provider?: string
          access_token?: string | null
          refresh_token?: string
          scope?: string | null
          token_type?: string | null
          last_refreshed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_google_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_guest_sessions: { Args: never; Returns: undefined }
      get_or_create_system_folder: {
        Args: { p_owner_id: string }
        Returns: string
      }
      match_folder: {
        Args: {
          match_threshold: number
          p_owner_id: string
          query_embedding: string
        }
        Returns: string
      }
      match_note_embeddings: {
        Args: {
          match_count: number
          match_threshold: number
          p_owner_id: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          note_id: string
          note_title: string
          similarity: number
        }[]
      }
      smartnotes_auth_user_id: { Args: never; Returns: string }
      smartnotes_build_note_search_vector: {
        Args: {
          input_content: string
          input_tags: string[]
          input_title: string
        }
        Returns: unknown
      }
      smartnotes_is_note_participant: {
        Args: { target_access: Json; target_owner_id: string }
        Returns: boolean
      }
      smartnotes_refresh_note_effective_access: {
        Args: { target_note_id: string }
        Returns: undefined
      }
      smartnotes_strip_html: { Args: { value: string }; Returns: string }
    }
    Enums: {
      smartnotes_access_role: "owner" | "editor" | "viewer"
      smartnotes_ai_status: "pending" | "analyzing" | "done" | "error"
      smartnotes_folder_view_mode: "compact" | "full"
      smartnotes_invite_status: "pending" | "accepted" | "rejected"
      smartnotes_lang: "ru" | "en"
      smartnotes_plan: "free" | "pro" | "team"
      smartnotes_resurfacing_class: "task" | "idea" | "reference" | "archive"
      smartnotes_theme_preset:
        | "paper"
        | "smarthub"
        | "smartlib"
        | "cyber"
        | "lego"
        | "classic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      smartnotes_access_role: ["owner", "editor", "viewer"],
      smartnotes_ai_status: ["pending", "analyzing", "done", "error"],
      smartnotes_folder_view_mode: ["compact", "full"],
      smartnotes_invite_status: ["pending", "accepted", "rejected"],
      smartnotes_lang: ["ru", "en"],
      smartnotes_plan: ["free", "pro", "team"],
      smartnotes_resurfacing_class: ["task", "idea", "reference", "archive"],
      smartnotes_theme_preset: [
        "paper",
        "smarthub",
        "smartlib",
        "cyber",
        "lego",
        "classic",
      ],
    },
  },
} as const

export type TypedSupabaseClient = SupabaseClient<Database>;
