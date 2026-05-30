import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { mapFolderDraftToInsert, mapFolderRow } from "@/features/folders/api/folder-mappers";
import { createId, createLocalNote, normalizeNotePatch } from "@/features/notes/lib/note-utils";
import {
  type AiAction,
  type AiActionExecutionResult,
  buildStructuredIdeaMetadata,
  buildStructuredIdeaNoteContent,
  normalizeActionTags,
} from "@/features/ai-engine/model/agent-actions";
import { requireSupabasePublishableKey, requireSupabaseUrl } from "@/shared/api/supabase/env";
import type { Database } from "@/shared/api/supabase/types";
import { nowIso } from "@/shared/utils/date";

type ServerSupabase = ReturnType<typeof createServerClient<Database>>;

export type ExecuteAgentActionsResult = {
  runId: string;
  results: AiActionExecutionResult[];
};

export async function createAuthenticatedServerSupabase() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(requireSupabaseUrl(), requireSupabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: user.id };
}

export async function executeAgentActions(actions: AiAction[]): Promise<ExecuteAgentActionsResult> {
  const { supabase, userId } = await createAuthenticatedServerSupabase();
  const runId = createId();
  const results: AiActionExecutionResult[] = [];
  const createdFolderIdsByTempId = new Map<string, string>();

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];

    try {
      if (action.type === "createFolder") {
        const folder = await createFolderAction(supabase, userId, action.folderName);
        createdFolderIdsByTempId.set(action.tempId, folder.id);
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Folder \"${folder.name}\" created.`,
          createdFolderId: folder.id,
        });
        continue;
      }

      if (action.type === "moveNotesToFolder") {
        const folderId = await resolveFolderId(supabase, userId, action.folderId ?? null, action.folderName, action.tempId, createdFolderIdsByTempId);
        const affectedNoteIds = await moveNotesToFolderAction(supabase, userId, action.noteIds, folderId);
        results.push({
          index,
          type: action.type,
          success: true,
          message: folderId ? `Moved ${affectedNoteIds.length} notes.` : `Removed folder from ${affectedNoteIds.length} notes.`,
          affectedNoteIds,
        });
        continue;
      }

      if (action.type === "addTagsToNotes") {
        const affectedNoteIds = await addTagsToNotesAction(supabase, userId, action.noteIds, action.tags);
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Updated tags for ${affectedNoteIds.length} notes.`,
          affectedNoteIds,
        });
        continue;
      }

      if (action.type === "createStructuredIdeaNote") {
        const note = await createStructuredIdeaNoteAction(supabase, userId, action);
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Note \"${note.title}\" created.`,
          createdNoteId: note.id,
        });
        continue;
      }
    } catch (error) {
      results.push({
        index,
        type: action.type,
        success: false,
        message: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  return { runId, results };
}

async function createFolderAction(supabase: ServerSupabase, userId: string, folderName: string) {
  const existing = await findFolderByName(supabase, userId, folderName);

  if (existing) {
    return existing;
  }

  const folderOrder = await getNextFolderOrder(supabase, userId);
  const { data, error } = await supabase
    .from("folders")
    .insert(mapFolderDraftToInsert({ name: folderName, description: null, isHidden: false }, userId, folderOrder))
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create folder.");
  }

  return mapFolderRow(data);
}

async function getNextFolderOrder(supabase: ServerSupabase, userId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("folder_order")
    .eq("owner_id", userId)
    .order("folder_order", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.folder_order ?? -1) + 1;
}

async function findFolderByName(supabase: ServerSupabase, userId: string, folderName: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("owner_id", userId)
    .ilike("name", folderName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapFolderRow(data) : null;
}

async function resolveFolderId(
  supabase: ServerSupabase,
  userId: string,
  folderId: string | null,
  folderName: string | undefined,
  tempId: string | undefined,
  createdFolderIdsByTempId: Map<string, string>,
) {
  if (folderId) {
    await assertFolderOwnership(supabase, userId, folderId);
    return folderId;
  }

  if (tempId) {
    const createdFolderId = createdFolderIdsByTempId.get(tempId);

    if (!createdFolderId) {
      throw new Error(`Unknown temp folder id: ${tempId}`);
    }

    return createdFolderId;
  }

  if (folderName) {
    const folder = await findFolderByName(supabase, userId, folderName);

    if (!folder) {
      throw new Error(`Folder \"${folderName}\" not found.`);
    }

    return folder.id;
  }

  return null;
}

async function assertFolderOwnership(supabase: ServerSupabase, userId: string, folderId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Folder not found or access denied.");
  }
}

async function getOwnedNotes(supabase: ServerSupabase, userId: string, noteIds: string[]) {
  const uniqueNoteIds = Array.from(new Set(noteIds));
  const { data, error } = await supabase
    .from("notes")
    .select("id, owner_id, user_tags, hidden_tags")
    .eq("owner_id", userId)
    .in("id", uniqueNoteIds);

  if (error) {
    throw error;
  }

  if ((data ?? []).length !== uniqueNoteIds.length) {
    throw new Error("One or more notes were not found or access was denied.");
  }

  return data ?? [];
}

async function moveNotesToFolderAction(supabase: ServerSupabase, userId: string, noteIds: string[], folderId: string | null) {
  const notes = await getOwnedNotes(supabase, userId, noteIds);
  const updatedAt = nowIso();

  for (const note of notes) {
    const hiddenTags = Array.from(new Set([...(note.hidden_tags ?? []), "manual-folder-signal"]));
    const patch = normalizeNotePatch(
      {
        folderId,
        folderOrder: folderId ? Date.now() : null,
        hiddenTags,
        updatedAt,
      },
      { scheduleAnalysis: true },
    );

    const { error } = await supabase.from("notes").update({
      folder_id: patch.folderId,
      folder_order: patch.folderOrder,
      hidden_tags: patch.hiddenTags,
      ai_status: patch.aiStatus,
      ai_processed: patch.aiProcessed,
      analyzed: patch.analyzed,
      ai_error: patch.aiError,
      updated_at: patch.updatedAt,
    }).eq("id", note.id).eq("owner_id", userId);

    if (error) {
      throw error;
    }
  }

  return notes.map((note) => note.id);
}

async function addTagsToNotesAction(supabase: ServerSupabase, userId: string, noteIds: string[], tags: string[]) {
  const notes = await getOwnedNotes(supabase, userId, noteIds);
  const normalizedTags = normalizeActionTags(tags);

  for (const note of notes) {
    const mergedTags = Array.from(new Set([...(note.user_tags ?? []), ...normalizedTags]));
    const patch = normalizeNotePatch({ userTags: mergedTags }, { scheduleAnalysis: true });
    const { error } = await supabase.from("notes").update({
      user_tags: patch.userTags,
      ai_status: patch.aiStatus,
      ai_processed: patch.aiProcessed,
      analyzed: patch.analyzed,
      ai_error: patch.aiError,
      updated_at: patch.updatedAt,
    }).eq("id", note.id).eq("owner_id", userId);

    if (error) {
      throw error;
    }
  }

  return notes.map((note) => note.id);
}

async function createStructuredIdeaNoteAction(
  supabase: ServerSupabase,
  userId: string,
  action: Extract<AiAction, { type: "createStructuredIdeaNote" }>,
) {
  const content = buildStructuredIdeaNoteContent(action);
  const note = createLocalNote(
    {
      title: action.title,
      content,
      folderId: null,
      userTags: normalizeActionTags(["idea", ...action.tags]),
    },
    userId,
  );

  note.resurfacingClass = "idea";
  note.metadata = buildStructuredIdeaMetadata(action);

  const { error } = await supabase.from("notes").insert({
    id: note.id,
    owner_id: note.ownerId,
    folder_id: note.folderId,
    title: note.title,
    content: note.content,
    user_tags: note.userTags,
    hidden_tags: note.hiddenTags,
    pinned: note.pinned,
    favorite: note.favorite,
    is_archived: note.isArchived,
    reminder_at: note.reminderAt,
    lock_version: null,
    lock_hash: null,
    lock_salt: null,
    lock_hidden: false,
    manual_order: note.order,
    folder_order: note.folderOrder,
    ai_status: note.aiStatus,
    ai_processed: note.aiProcessed,
    analyzed: note.analyzed,
    ai_error: note.aiError,
    ai_relevance: note.aiRelevance,
    resurfacing_class: note.resurfacingClass,
    metadata: note.metadata as Database["public"]["Tables"]["notes"]["Insert"]["metadata"],
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    trashed_at: note.trashedAt,
  });

  if (error) {
    throw error;
  }

  if (note.pages.length > 0) {
    const { error: pageError } = await supabase.from("note_pages").insert(
      note.pages.map((page, pageIndex) => ({
        id: createId(),
        note_id: note.id,
        client_page_id: page.id,
        title: page.title,
        content: page.content,
        page_index: pageIndex,
        drawing_data_url: page.drawingDataUrl,
        drawing_revision: page.drawingRevision,
      })),
    );

    if (pageError) {
      throw pageError;
    }
  }

  return note;
}
