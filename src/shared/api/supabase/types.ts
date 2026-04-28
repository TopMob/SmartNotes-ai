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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
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
          pages: Json;
          user_tags: string[];
          hidden_tags: string[];
          media: Json;
          pinned: boolean;
          favorite: boolean;
          is_archived: boolean;
          reminder_at: string | null;
          lock: Json | null;
          access: Json;
          manual_order: number;
          folder_order: number | null;
          ai_status: "pending" | "analyzing" | "done" | "error";
          ai_processed: boolean;
          analyzed: boolean;
          ai_error: string | null;
          ai_relevance: number;
          resurfacing_class: "task" | "idea" | "reference" | "archive" | null;
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
          pages?: Json;
          user_tags?: string[];
          hidden_tags?: string[];
          media?: Json;
          pinned?: boolean;
          favorite?: boolean;
          is_archived?: boolean;
          reminder_at?: string | null;
          lock?: Json | null;
          access?: Json;
          manual_order?: number;
          folder_order?: number | null;
          ai_status?: "pending" | "analyzing" | "done" | "error";
          ai_processed?: boolean;
          analyzed?: boolean;
          ai_error?: string | null;
          ai_relevance?: number;
          resurfacing_class?: "task" | "idea" | "reference" | "archive" | null;
          created_at?: string;
          updated_at?: string;
          trashed_at?: string | null;
        };
        Update: {
          owner_id?: string;
          folder_id?: string | null;
          title?: string;
          content?: string;
          pages?: Json;
          user_tags?: string[];
          hidden_tags?: string[];
          media?: Json;
          pinned?: boolean;
          favorite?: boolean;
          is_archived?: boolean;
          reminder_at?: string | null;
          lock?: Json | null;
          access?: Json;
          manual_order?: number;
          folder_order?: number | null;
          ai_status?: "pending" | "analyzing" | "done" | "error";
          ai_processed?: boolean;
          analyzed?: boolean;
          ai_error?: string | null;
          ai_relevance?: number;
          resurfacing_class?: "task" | "idea" | "reference" | "archive" | null;
          created_at?: string;
          updated_at?: string;
          trashed_at?: string | null;
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
          updated_at?: string;
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
