import type { SupabaseClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          plan: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          plan?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          plan?: string;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          is_hidden: boolean;
          is_archived: boolean;
          folder_order: number;
          access_role: "owner" | "editor" | "viewer";
          metadata: Json;
          created_at: string;
          updated_at: string;
          trashed_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          is_hidden?: boolean;
          is_archived?: boolean;
          folder_order?: number;
          access_role?: "owner" | "editor" | "viewer";
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          trashed_at?: string | null;
        };
        Update: {
          owner_id?: string;
          name?: string;
          description?: string | null;
          is_hidden?: boolean;
          is_archived?: boolean;
          folder_order?: number;
          access_role?: "owner" | "editor" | "viewer";
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          trashed_at?: string | null;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          owner_id: string;
          folder_id: string | null;
          title: string;
          content: string;
          user_tags: string[];
          hidden_tags: string[];
          pinned: boolean;
          favorite: boolean;
          is_archived: boolean;
          reminder_at: string | null;
          lock_version: number | null;
          lock_hash: string | null;
          lock_salt: string | null;
          lock_hidden: boolean;
          manual_order: number;
          folder_order: number | null;
          ai_status: "pending" | "analyzing" | "done" | "error";
          ai_processed: boolean;
          analyzed: boolean;
          ai_error: string | null;
          ai_relevance: number;
          resurfacing_class: "task" | "idea" | "reference" | "archive" | null;
          search_vector: unknown | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          trashed_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          folder_id?: string | null;
          title: string;
          content?: string;
          user_tags?: string[];
          hidden_tags?: string[];
          pinned?: boolean;
          favorite?: boolean;
          is_archived?: boolean;
          reminder_at?: string | null;
          lock_version?: number | null;
          lock_hash?: string | null;
          lock_salt?: string | null;
          lock_hidden?: boolean;
          manual_order?: number;
          folder_order?: number | null;
          ai_status?: "pending" | "analyzing" | "done" | "error";
          ai_processed?: boolean;
          analyzed?: boolean;
          ai_error?: string | null;
          ai_relevance?: number;
          resurfacing_class?: "task" | "idea" | "reference" | "archive" | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          trashed_at?: string | null;
        };
        Update: {
          owner_id?: string;
          folder_id?: string | null;
          title?: string;
          content?: string;
          user_tags?: string[];
          hidden_tags?: string[];
          pinned?: boolean;
          favorite?: boolean;
          is_archived?: boolean;
          reminder_at?: string | null;
          lock_version?: number | null;
          lock_hash?: string | null;
          lock_salt?: string | null;
          lock_hidden?: boolean;
          manual_order?: number;
          folder_order?: number | null;
          ai_status?: "pending" | "analyzing" | "done" | "error";
          ai_processed?: boolean;
          analyzed?: boolean;
          ai_error?: string | null;
          ai_relevance?: number;
          resurfacing_class?: "task" | "idea" | "reference" | "archive" | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          trashed_at?: string | null;
        };
        Relationships: [];
      };
      note_pages: {
        Row: {
          id: string;
          note_id: string;
          client_page_id: string | null;
          page_index: number;
          title: string;
          content: string;
          drawing_data_url: string | null;
          drawing_revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          client_page_id?: string | null;
          page_index?: number;
          title?: string;
          content?: string;
          drawing_data_url?: string | null;
          drawing_revision?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          client_page_id?: string | null;
          page_index?: number;
          title?: string;
          content?: string;
          drawing_data_url?: string | null;
          drawing_revision?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_media: {
        Row: {
          id: string;
          note_id: string;
          client_media_id: string | null;
          provider: "google-drive" | "local-inline";
          file_id: string;
          url: string | null;
          mime_type: string;
          name: string;
          size: number;
          thumbnail_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          client_media_id?: string | null;
          provider: "google-drive" | "local-inline";
          file_id: string;
          url?: string | null;
          mime_type: string;
          name: string;
          size?: number;
          thumbnail_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          client_media_id?: string | null;
          provider?: "google-drive" | "local-inline";
          file_id?: string;
          url?: string | null;
          mime_type?: string;
          name?: string;
          size?: number;
          thumbnail_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      note_access: {
        Row: {
          note_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          note_id: string;
          user_id: string;
          role?: "owner" | "editor" | "viewer";
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          note_id?: string;
          user_id?: string;
          role?: "owner" | "editor" | "viewer";
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_invites: {
        Row: {
          id: string;
          note_id: string;
          inviter_id: string;
          invitee_email: string | null;
          invitee_id: string | null;
          role: "owner" | "editor" | "viewer";
          status: "pending" | "accepted" | "rejected";
          token: string;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          inviter_id: string;
          invitee_email?: string | null;
          invitee_id?: string | null;
          role?: "owner" | "editor" | "viewer";
          status?: "pending" | "accepted" | "rejected";
          token?: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          inviter_id?: string;
          invitee_email?: string | null;
          invitee_id?: string | null;
          role?: "owner" | "editor" | "viewer";
          status?: "pending" | "accepted" | "rejected";
          token?: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_effective_access: {
        Row: {
          note_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          source: "owner" | "note_access";
          created_at: string;
        };
        Insert: {
          note_id: string;
          user_id: string;
          role?: "owner" | "editor" | "viewer";
          source?: "owner" | "note_access";
          created_at?: string;
        };
        Update: {
          note_id?: string;
          user_id?: string;
          role?: "owner" | "editor" | "viewer";
          source?: "owner" | "note_access";
          created_at?: string;
        };
        Relationships: [];
      };
      ai_jobs: {
        Row: {
          id: string;
          note_id: string;
          owner_id: string;
          status: "pending" | "analyzing" | "done" | "error";
          model: string | null;
          prompt_version: string | null;
          attempts: number;
          error: string | null;
          result: Json;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          owner_id: string;
          status?: "pending" | "analyzing" | "done" | "error";
          model?: string | null;
          prompt_version?: string | null;
          attempts?: number;
          error?: string | null;
          result?: Json;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          owner_id?: string;
          status?: "pending" | "analyzing" | "done" | "error";
          model?: string | null;
          prompt_version?: string | null;
          attempts?: number;
          error?: string | null;
          result?: Json;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_embeddings: {
        Row: {
          id: string;
          note_id: string;
          owner_id: string;
          chunk_index: number;
          content: string;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          owner_id: string;
          chunk_index?: number;
          content?: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          owner_id?: string;
          chunk_index?: number;
          content?: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          id: string;
          preset: "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";
          lang: "ru" | "en";
          folder_view_mode: "compact" | "full";
          notes_per_page: 5 | 10 | 20 | 50;
          reduce_motion: boolean;
          ui_opacity: number;
          cards_opacity: number;
          main_background_url: string | null;
          sidebar_background_url: string | null;
          custom_presets: Array<{
            id: string;
            name: string;
            preset: "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";
            mainBackgroundUrl: string | null;
            sidebarBackgroundUrl: string | null;
            uiOpacity: number;
            cardsOpacity: number;
          }>;
          editor: {
            toolbarVisible: boolean;
            bold: boolean;
            italic: boolean;
            underline: boolean;
            strike: boolean;
            bullets: boolean;
            numbered: boolean;
            hr: boolean;
            alignText: boolean;
            alignMedia: boolean;
            clearFormat: boolean;
            undoRedo: boolean;
            links: boolean;
            pages: boolean;
            inlineTags: boolean;
          };
          interface: {
            showSavedFilters: boolean;
            showTagFilter: boolean;
            showUpdatedPeriodFilter: boolean;
          };
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          preset?: "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";
          lang?: "ru" | "en";
          folder_view_mode?: "compact" | "full";
          notes_per_page?: 5 | 10 | 20 | 50;
          reduce_motion?: boolean;
          ui_opacity?: number;
          cards_opacity?: number;
          main_background_url?: string | null;
          sidebar_background_url?: string | null;
          custom_presets?: Array<{
            id: string;
            name: string;
            preset: "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";
            mainBackgroundUrl: string | null;
            sidebarBackgroundUrl: string | null;
            uiOpacity: number;
            cardsOpacity: number;
          }>;
          editor?: {
            toolbarVisible: boolean;
            bold: boolean;
            italic: boolean;
            underline: boolean;
            strike: boolean;
            bullets: boolean;
            numbered: boolean;
            hr: boolean;
            alignText: boolean;
            alignMedia: boolean;
            clearFormat: boolean;
            undoRedo: boolean;
            links: boolean;
            pages: boolean;
            inlineTags: boolean;
          };
          interface?: {
            showSavedFilters: boolean;
            showTagFilter: boolean;
            showUpdatedPeriodFilter: boolean;
          };
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          preset?: "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";
          lang?: "ru" | "en";
          folder_view_mode?: "compact" | "full";
          notes_per_page?: 5 | 10 | 20 | 50;
          reduce_motion?: boolean;
          ui_opacity?: number;
          cards_opacity?: number;
          main_background_url?: string | null;
          sidebar_background_url?: string | null;
          custom_presets?: Array<{
            id: string;
            name: string;
            preset: "paper" | "smarthub" | "smartlib" | "cyber" | "lego" | "classic";
            mainBackgroundUrl: string | null;
            sidebarBackgroundUrl: string | null;
            uiOpacity: number;
            cardsOpacity: number;
          }>;
          editor?: {
            toolbarVisible: boolean;
            bold: boolean;
            italic: boolean;
            underline: boolean;
            strike: boolean;
            bullets: boolean;
            numbered: boolean;
            hr: boolean;
            alignText: boolean;
            alignMedia: boolean;
            clearFormat: boolean;
            undoRedo: boolean;
            links: boolean;
            pages: boolean;
            inlineTags: boolean;
          };
          interface?: {
            showSavedFilters: boolean;
            showTagFilter: boolean;
            showUpdatedPeriodFilter: boolean;
          };
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          rating: number | null;
          text: string | null;
          technical_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          rating?: number | null;
          text?: string | null;
          technical_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          rating?: number | null;
          text?: string | null;
          technical_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TypedSupabaseClient = SupabaseClient<Database>;
