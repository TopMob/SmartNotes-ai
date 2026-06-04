 
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

export type CollaboratorDetail = {
  userId: string;
  role: "owner" | "editor" | "viewer";
  status: "accepted";
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type PendingInviteDetail = {
  id: string;
  noteId: string;
  inviterId: string;
  inviteeEmail: string | null;
  inviteeId: string | null;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "accepted" | "rejected";
  token: string;
  expiresAt: string | null;
  createdAt: string;
};

export const collabRepository = {
  async fetchNoteCollaborators(noteId: string): Promise<CollaboratorDetail[]> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("note_access")
      .select(`
        user_id,
        role,
        profiles:profiles!user_id (
          email,
          display_name,
          avatar_url
        )
      `)
      .eq("note_id", noteId);

    if (error) {
      console.error("Error fetching note collaborators:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      role: row.role,
      status: "accepted" as const,
      email: row.profiles?.email || null,
      displayName: row.profiles?.display_name || null,
      photoURL: row.profiles?.avatar_url || null,
    }));
  },

  async fetchPendingInvites(noteId: string): Promise<PendingInviteDetail[]> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("note_invites")
      .select("*")
      .eq("note_id", noteId)
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching pending invites:", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      noteId: row.note_id,
      inviterId: row.inviter_id,
      inviteeEmail: row.invitee_email,
      inviteeId: row.invitee_id,
      role: row.role,
      status: row.status,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  },

  async createInvite(noteId: string, email: string, role: "owner" | "editor" | "viewer"): Promise<PendingInviteDetail> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase client not initialized.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiration

    const { data, error } = await supabase
      .from("note_invites")
      .insert({
        note_id: noteId,
        inviter_id: user.id,
        invitee_email: email.trim().toLowerCase(),
        role,
        status: "pending" as const,
        token,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating invite:", error);
      throw error;
    }

    return {
      id: data.id,
      noteId: data.note_id,
      inviterId: data.inviter_id,
      inviteeEmail: data.invitee_email,
      inviteeId: data.invitee_id,
      role: data.role,
      status: data.status,
      token: data.token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  },

  async cancelPendingInvite(inviteId: string): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("note_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      console.error("Error cancelling invite:", error);
      throw error;
    }
  },

  async revokeCollaboratorAccess(noteId: string, userId: string): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("note_access")
      .delete()
      .eq("note_id", noteId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error revoking collaborator access:", error);
      throw error;
    }
  },

  async fetchFolderCollaborators(folderId: string): Promise<CollaboratorDetail[]> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("folder_access")
      .select(`
        user_id,
        role,
        profiles:profiles!user_id (
          email,
          display_name,
          avatar_url
        )
      `)
      .eq("folder_id", folderId);

    if (error) {
      console.error(error);
      return [];
    }

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      role: row.role,
      status: "accepted" as const,
      email: row.profiles?.email || null,
      displayName: row.profiles?.display_name || null,
      photoURL: row.profiles?.avatar_url || null,
    }));
  },

  async fetchFolderPendingInvites(folderId: string): Promise<PendingInviteDetail[]> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("folder_invites")
      .select("*")
      .eq("folder_id", folderId)
      .eq("status", "pending");

    if (error) {
      console.error(error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      noteId: row.folder_id,
      inviterId: row.inviter_id,
      inviteeEmail: row.invitee_email,
      inviteeId: row.invitee_id,
      role: row.role,
      status: row.status,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  },

  async createFolderInvite(folderId: string, email: string, role: "owner" | "editor" | "viewer"): Promise<PendingInviteDetail> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase client not initialized.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("folder_invites")
      .insert({
        folder_id: folderId,
        inviter_id: user.id,
        invitee_email: email.trim().toLowerCase(),
        role,
        status: "pending" as const,
        token,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      throw error;
    }

    return {
      id: data.id,
      noteId: data.folder_id,
      inviterId: data.inviter_id,
      inviteeEmail: data.invitee_email,
      inviteeId: data.invitee_id,
      role: data.role,
      status: data.status,
      token: data.token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  },

  async cancelFolderPendingInvite(inviteId: string): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("folder_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      console.error(error);
      throw error;
    }
  },

  async revokeFolderCollaboratorAccess(folderId: string, userId: string): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("folder_access")
      .delete()
      .eq("folder_id", folderId)
      .eq("user_id", userId);

    if (error) {
      console.error(error);
      throw error;
    }
  },

  async fetchMyPendingInvites(email: string): Promise<any[]> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return [];

    const lowerEmail = email.trim().toLowerCase();

    const [noteRes, folderRes] = await Promise.all([
      supabase
        .from("note_invites")
        .select(`
          *,
          notes:notes!note_id (
            title,
            owner_id
          ),
          inviter:profiles!inviter_id (
            email,
            display_name
          )
        `)
        .eq("invitee_email", lowerEmail)
        .eq("status", "pending"),
      supabase
        .from("folder_invites")
        .select(`
          *,
          folders:folders!folder_id (
            name,
            owner_id
          ),
          inviter:profiles!inviter_id (
            email,
            display_name
          )
        `)
        .eq("invitee_email", lowerEmail)
        .eq("status", "pending")
    ]);

    const notes = (noteRes.data || []).map((row: any) => ({
      id: row.id,
      noteId: row.note_id,
      noteTitle: row.notes?.title || "Без названия",
      inviterEmail: row.inviter?.email || "Unknown",
      inviterName: row.inviter?.display_name || null,
      role: row.role,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      type: "note" as const,
    }));

    const folders = (folderRes.data || []).map((row: any) => ({
      id: row.id,
      noteId: row.folder_id,
      noteTitle: row.folders?.name || "Без названия",
      inviterEmail: row.inviter?.email || "Unknown",
      inviterName: row.inviter?.display_name || null,
      role: row.role,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      type: "folder" as const,
    }));

    return [...notes, ...folders];
  },

  async fetchInviteByToken(token: string): Promise<any> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return null;

    const { data: noteInvite } = await supabase
      .from("note_invites")
      .select(`
        *,
        notes:notes!note_id (
          title
        ),
        inviter:profiles!inviter_id (
          email,
          display_name
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (noteInvite) {
      return {
        id: noteInvite.id,
        noteId: noteInvite.note_id,
        noteTitle: noteInvite.notes?.title || "Без названия",
        inviterEmail: noteInvite.inviter?.email || "Unknown",
        inviterName: noteInvite.inviter?.display_name || null,
        role: noteInvite.role,
        status: noteInvite.status,
        expiresAt: noteInvite.expires_at,
        type: "note" as const,
      };
    }

    const { data: folderInvite } = await supabase
      .from("folder_invites")
      .select(`
        *,
        folders:folders!folder_id (
          name
        ),
        inviter:profiles!inviter_id (
          email,
          display_name
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (folderInvite) {
      return {
        id: folderInvite.id,
        noteId: folderInvite.folder_id,
        noteTitle: folderInvite.folders?.name || "Без названия",
        inviterEmail: folderInvite.inviter?.email || "Unknown",
        inviterName: folderInvite.inviter?.display_name || null,
        role: folderInvite.role,
        status: folderInvite.status,
        expiresAt: folderInvite.expires_at,
        type: "folder" as const,
      };
    }

    return null;
  },

  async acceptInviteByToken(token: string, userId: string, type?: "note" | "folder"): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    if (type === "folder") {
      const { error } = await supabase
        .from("folder_invites")
        .update({
          status: "accepted" as const,
          invitee_id: userId,
        })
        .eq("token", token);
      if (error) throw error;
    } else if (type === "note") {
      const { error } = await supabase
        .from("note_invites")
        .update({
          status: "accepted" as const,
          invitee_id: userId,
        })
        .eq("token", token);
      if (error) throw error;
    } else {
      const { data: noteInvite } = await supabase
        .from("note_invites")
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (noteInvite) {
        const { error } = await supabase
          .from("note_invites")
          .update({
            status: "accepted" as const,
            invitee_id: userId,
          })
          .eq("token", token);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("folder_invites")
          .update({
            status: "accepted" as const,
            invitee_id: userId,
          })
          .eq("token", token);
        if (error) throw error;
      }
    }
  },

  async rejectInviteByToken(token: string, type?: "note" | "folder"): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    if (type === "folder") {
      const { error } = await supabase
        .from("folder_invites")
        .update({ status: "rejected" as const })
        .eq("token", token);
      if (error) throw error;
    } else if (type === "note") {
      const { error } = await supabase
        .from("note_invites")
        .update({ status: "rejected" as const })
        .eq("token", token);
      if (error) throw error;
    } else {
      const { data: noteInvite } = await supabase
        .from("note_invites")
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (noteInvite) {
        const { error } = await supabase
          .from("note_invites")
          .update({ status: "rejected" as const })
          .eq("token", token);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("folder_invites")
          .update({ status: "rejected" as const })
          .eq("token", token);
        if (error) throw error;
      }
    }
  },
};
