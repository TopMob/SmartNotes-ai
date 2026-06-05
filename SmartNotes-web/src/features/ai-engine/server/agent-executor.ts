import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Note } from "@/entities/note";
import { mapFolderDraftToInsert, mapFolderRow } from "@/features/folders/api/folder-mappers";
import { mapNotePatchToUpdate } from "@/features/notes/api/note-mappers";
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

type ServerSupabase = SupabaseClient<Database>;

export type ExecuteAgentActionsResult = {
  runId: string;
  results: AiActionExecutionResult[];
};

type AgentRunLogInput = {
  runId: string;
  userId: string;
  actions: AiAction[];
  results: AiActionExecutionResult[];
  requestMessage?: string;
  conversationExcerpt?: Array<{ role: "user" | "assistant"; text: string }>;
};

export async function createAuthenticatedServerSupabase() {
  const cookieStore = await cookies();

  const authSupabase = createServerClient<Database>(requireSupabaseUrl(), requireSupabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });

  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }

  const supabase = createClient<Database>(requireSupabaseUrl(), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { supabase, userId: user.id };
}

export async function executeAgentActions(
  actions: AiAction[],
  options?: { requestMessage?: string; conversationExcerpt?: Array<{ role: "user" | "assistant"; text: string }> },
): Promise<ExecuteAgentActionsResult> {
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

      if (action.type === "renameFolder") {
        const folder = await patchFolderAction(supabase, userId, action.folderId, { name: action.name });
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Folder \"${folder.name}\" renamed.`,
          affectedFolderIds: [folder.id],
        });
        continue;
      }

      if (action.type === "updateFolderDescription") {
        const folder = await patchFolderAction(supabase, userId, action.folderId, { description: action.description });
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Folder \"${folder.name}\" description updated.`,
          affectedFolderIds: [folder.id],
        });
        continue;
      }

      if (action.type === "trashFolder") {
        const folder = await patchFolderAction(supabase, userId, action.folderId, { trashed_at: nowIso() });
        results.push({ index, type: action.type, success: true, message: `Folder \"${folder.name}\" moved to trash.`, affectedFolderIds: [folder.id] });
        continue;
      }

      if (action.type === "restoreFolder") {
        const folder = await patchFolderAction(supabase, userId, action.folderId, { trashed_at: null });
        results.push({ index, type: action.type, success: true, message: `Folder \"${folder.name}\" restored.`, affectedFolderIds: [folder.id] });
        continue;
      }

      if (action.type === "deleteFolder") {
        const folder = await getOwnedFolder(supabase, userId, action.folderId);
        await deleteFolderAction(supabase, userId, action.folderId);
        results.push({ index, type: action.type, success: true, message: `Folder \"${folder.name}\" deleted.`, affectedFolderIds: [folder.id] });
        continue;
      }

      if (action.type === "mergeFolders") {
        const merged = await mergeFoldersAction(supabase, userId, action, createdFolderIdsByTempId);
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Merged ${merged.sourceFolderIds.length} folders into \"${merged.targetFolder.name}\".`,
          affectedFolderIds: [merged.targetFolder.id, ...merged.sourceFolderIds],
          affectedNoteIds: merged.affectedNoteIds,
        });
        continue;
      }

      if (action.type === "createNote") {
        const note = await createNoteAction(supabase, userId, action, createdFolderIdsByTempId);
        results.push({ index, type: action.type, success: true, message: `Note \"${note.title}\" created.`, createdNoteId: note.id, affectedNoteIds: [note.id] });
        continue;
      }

      if (action.type === "updateNote") {
        const note = await updateNoteAction(supabase, userId, action, createdFolderIdsByTempId);
        results.push({ index, type: action.type, success: true, message: `Note \"${note.title}\" updated.`, affectedNoteIds: [note.id] });
        continue;
      }

      if (action.type === "renameNote") {
        const note = await updateOwnedNote(supabase, userId, action.noteId, normalizeNotePatch({ title: action.title }));
        results.push({ index, type: action.type, success: true, message: `Note \"${note.title}\" renamed.`, affectedNoteIds: [note.id] });
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

      if (action.type === "mergeNotes") {
        const merged = await mergeNotesAction(supabase, userId, action, createdFolderIdsByTempId);
        results.push({
          index,
          type: action.type,
          success: true,
          message: `Merged ${action.noteIds.length} notes into \"${merged.title}\".`,
          createdNoteId: merged.id,
          affectedNoteIds: [merged.id, ...action.noteIds],
        });
        continue;
      }

      if (action.type === "trashNotes") {
        const affectedNoteIds = await patchNotesAction(supabase, userId, action.noteIds, () => normalizeNotePatch({ trashedAt: nowIso() }, { scheduleAnalysis: false }));
        results.push({ index, type: action.type, success: true, message: `Moved ${affectedNoteIds.length} notes to trash.`, affectedNoteIds });
        continue;
      }

      if (action.type === "restoreNotes") {
        const affectedNoteIds = await patchNotesAction(supabase, userId, action.noteIds, () => normalizeNotePatch({ trashedAt: null }, { scheduleAnalysis: false }));
        results.push({ index, type: action.type, success: true, message: `Restored ${affectedNoteIds.length} notes.`, affectedNoteIds });
        continue;
      }

      if (action.type === "deleteNotes") {
        const affectedNoteIds = await patchNotesAction(supabase, userId, action.noteIds, () => normalizeNotePatch({ trashedAt: nowIso() }, { scheduleAnalysis: false }));
        results.push({ index, type: action.type, success: true, message: `Moved ${affectedNoteIds.length} notes to trash.`, affectedNoteIds });
        continue;
      }

      if (action.type === "archiveNotes") {
        const affectedNoteIds = await patchNotesAction(supabase, userId, action.noteIds, () => normalizeNotePatch({ isArchived: true }, { scheduleAnalysis: false }));
        results.push({ index, type: action.type, success: true, message: `Archived ${affectedNoteIds.length} notes.`, affectedNoteIds });
        continue;
      }

      if (action.type === "unarchiveNotes") {
        const affectedNoteIds = await patchNotesAction(supabase, userId, action.noteIds, () => normalizeNotePatch({ isArchived: false }, { scheduleAnalysis: false }));
        results.push({ index, type: action.type, success: true, message: `Unarchived ${affectedNoteIds.length} notes.`, affectedNoteIds });
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

      if (action.type === "removeTagsFromNotes") {
        const affectedNoteIds = await removeTagsFromNotesAction(supabase, userId, action.noteIds, action.tags);
        results.push({ index, type: action.type, success: true, message: `Removed tags from ${affectedNoteIds.length} notes.`, affectedNoteIds });
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
      console.error("Agent action execution failed:", error);
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as any).message)
          : typeof error === "string"
            ? error
            : "Action failed.";

      results.push({
        index,
        type: action.type,
        success: false,
        message,
      });
    }
  }

  await logAgentRun(supabase, {
    runId,
    userId,
    actions,
    results,
    requestMessage: options?.requestMessage,
    conversationExcerpt: options?.conversationExcerpt,
  });

  return { runId, results };
}

async function logAgentRun(supabase: ServerSupabase, input: AgentRunLogInput) {
  const failedCount = input.results.filter((result) => !result.success).length;
  const status = failedCount === 0 ? "completed" : failedCount === input.results.length ? "failed" : "partial";
  const errorMessage = input.results.find((result) => !result.success)?.message ?? null;

  const { error } = await supabase.from("ai_agent_runs").insert({
    id: input.runId,
    owner_id: input.userId,
    request_message: input.requestMessage ?? "",
    conversation_excerpt: (input.conversationExcerpt ?? []) as Database["public"]["Tables"]["ai_agent_runs"]["Insert"]["conversation_excerpt"],
    actions: input.actions as Database["public"]["Tables"]["ai_agent_runs"]["Insert"]["actions"],
    results: input.results as Database["public"]["Tables"]["ai_agent_runs"]["Insert"]["results"],
    status,
    error_message: errorMessage,
  });

  if (error) {
    console.error("Failed to log agent run:", error);
  }
}

async function createFolderAction(supabase: ServerSupabase, userId: string, folderName: string) {
  const existing = await findFolderByName(supabase, userId, folderName);

  if (existing) {
    return existing;
  }

  let embedding: string | null = null;
  try {
    const { data: embedData } = await supabase.functions.invoke("embed", {
      body: { text: folderName, isFolder: true },
    });
    if (embedData && Array.isArray(embedData.embedding)) {
      embedding = JSON.stringify(embedData.embedding);
    }
  } catch (e) {
    console.warn(e);
  }

  const folderOrder = await getNextFolderOrder(supabase, userId);
  const { data, error } = await supabase
    .from("folders")
    .insert(mapFolderDraftToInsert({ name: folderName, description: null, isHidden: false }, userId, folderOrder, embedding))
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create folder.");
  }

  return mapFolderRow(data);
}

async function getOwnedFolder(supabase: ServerSupabase, userId: string, folderId: string) {
  const { data, error } = await supabase.from("folders").select("*").eq("id", folderId).eq("owner_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Folder not found or access denied.");
  }

  return mapFolderRow(data);
}

async function patchFolderAction(
  supabase: ServerSupabase,
  userId: string,
  folderId: string,
  patch: Database["public"]["Tables"]["folders"]["Update"],
) {
  const current = await getOwnedFolder(supabase, userId, folderId);
  const updatedPatch = { ...patch };

  if (patch.name !== undefined) {
    try {
      const { data: embedData } = await supabase.functions.invoke("embed", {
        body: { text: patch.name, isFolder: true },
      });
      if (embedData && Array.isArray(embedData.embedding)) {
        updatedPatch.embedding = JSON.stringify(embedData.embedding) as any;
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const { data, error } = await supabase.from("folders").update({ ...updatedPatch, updated_at: nowIso() }).eq("id", folderId).eq("owner_id", userId).select("*").single();

  if (error || !data) {
    throw error ?? new Error("Failed to update folder.");
  }

  return mapFolderRow({ ...data, name: data.name ?? current.name } as typeof data);
}

async function deleteFolderAction(supabase: ServerSupabase, userId: string, folderId: string) {
  await moveNotesToFolderAction(supabase, userId, await getFolderNoteIds(supabase, userId, folderId), null, false);
  const { error } = await supabase.from("folders").delete().eq("id", folderId).eq("owner_id", userId);

  if (error) {
    throw error;
  }
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

async function getFolderNoteIds(supabase: ServerSupabase, userId: string, folderId: string) {
  const { data, error } = await supabase.from("notes").select("id").eq("owner_id", userId).eq("folder_id", folderId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((note) => note.id);
}

async function getOwnedNotes(supabase: ServerSupabase, userId: string, noteIds: string[]) {
  const uniqueNoteIds = Array.from(new Set(noteIds));

  if (!uniqueNoteIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("notes")
    .select("id, owner_id, title, content, folder_id, user_tags, hidden_tags, pinned, favorite, is_archived, reminder_at, manual_order, folder_order, ai_status, ai_processed, analyzed, ai_error, ai_relevance, resurfacing_class, metadata, created_at, updated_at, trashed_at")
    .in("id", uniqueNoteIds);

  if (error) {
    throw error;
  }

  if ((data ?? []).length !== uniqueNoteIds.length) {
    throw new Error("One or more notes were not found or access was denied.");
  }

  const sharedNoteIds = (data ?? []).filter((note) => note.owner_id !== userId).map((note) => note.id);

  if (sharedNoteIds.length > 0) {
    const { data: accessRows, error: accessError } = await supabase
      .from("note_effective_access")
      .select("note_id, role")
      .eq("user_id", userId)
      .in("note_id", sharedNoteIds);

    if (accessError) {
      throw accessError;
    }

    const editableIds = new Set(
      (accessRows ?? [])
        .filter((row) => row.role === "owner" || row.role === "editor")
        .map((row) => row.note_id),
    );

    if (sharedNoteIds.some((noteId) => !editableIds.has(noteId))) {
      throw new Error("One or more notes are read-only for your account.");
    }
  }

  return data ?? [];
}

async function moveNotesToFolderAction(supabase: ServerSupabase, userId: string, noteIds: string[], folderId: string | null, scheduleAnalysis = true) {
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
      { scheduleAnalysis },
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
    }).eq("id", note.id);

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
    }).eq("id", note.id);

    if (error) {
      throw error;
    }
  }

  return notes.map((note) => note.id);
}

async function removeTagsFromNotesAction(supabase: ServerSupabase, userId: string, noteIds: string[], tags: string[]) {
  const notes = await getOwnedNotes(supabase, userId, noteIds);
  const tagsToRemove = new Set(normalizeActionTags(tags));

  for (const note of notes) {
    const nextTags = (note.user_tags ?? []).filter((tag) => !tagsToRemove.has(tag));
    const patch = normalizeNotePatch({ userTags: nextTags }, { scheduleAnalysis: true });
    const { error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", note.id);

    if (error) {
      throw error;
    }
  }

  return notes.map((note) => note.id);
}

async function patchNotesAction(
  supabase: ServerSupabase,
  userId: string,
  noteIds: string[],
  buildPatch: (note: Awaited<ReturnType<typeof getOwnedNotes>>[number]) => Partial<Note>,
) {
  const notes = await getOwnedNotes(supabase, userId, noteIds);

  for (const note of notes) {
    const patch = buildPatch(note);
    const { error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", note.id);

    if (error) {
      throw error;
    }
  }

  return notes.map((note) => note.id);
}

async function updateOwnedNote(supabase: ServerSupabase, userId: string, noteId: string, patch: Partial<Note>) {
  const notes = await getOwnedNotes(supabase, userId, [noteId]);
  const note = notes[0];
  const { error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", noteId);

  if (error) {
    throw error;
  }

  return {
    ...note,
    ...patch,
    title: patch.title ?? note.title,
  } as Note;
}

async function createNoteAction(
  supabase: ServerSupabase,
  userId: string,
  action: Extract<AiAction, { type: "createNote" }>,
  createdFolderIdsByTempId: Map<string, string>,
) {
  const folderId = await resolveFolderId(supabase, userId, action.folderId ?? null, action.folderName, action.tempId, createdFolderIdsByTempId);
  const note = createLocalNote({ title: action.title, content: action.content, folderId, userTags: normalizeActionTags(action.tags ?? []) }, userId);

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

  return note;
}

async function updateNoteAction(
  supabase: ServerSupabase,
  userId: string,
  action: Extract<AiAction, { type: "updateNote" }>,
  createdFolderIdsByTempId: Map<string, string>,
) {
  const notes = await getOwnedNotes(supabase, userId, [action.noteId]);
  const current = notes[0];
  const nextFolderId =
    action.folderId !== undefined || action.folderName !== undefined || action.tempId !== undefined
      ? await resolveFolderId(supabase, userId, action.folderId ?? null, action.folderName, action.tempId, createdFolderIdsByTempId)
      : undefined;

  const nextContent = action.content ?? (action.appendContent ? `${current.content}\n\n${action.appendContent}`.trim() : undefined);
  const nextTags = action.tags ? normalizeActionTags(action.tags) : undefined;
  const patch = normalizeNotePatch({
    title: action.title,
    content: nextContent,
    pages: nextContent === undefined ? undefined : [{ id: createId(), title: "Page 1", content: nextContent, drawingDataUrl: null, drawingRevision: 0 }],
    folderId: nextFolderId,
    folderOrder: nextFolderId === undefined ? undefined : nextFolderId ? Date.now() : null,
    userTags: nextTags,
    resurfacingClass: action.resurfacingClass,
  });

  const { error } = await supabase.from("notes").update(mapNotePatchToUpdate(patch)).eq("id", action.noteId);

  if (error) {
    throw error;
  }

  if (patch.pages) {
    const { error: deleteError } = await supabase.from("note_pages").delete().eq("note_id", action.noteId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: pageError } = await supabase.from("note_pages").insert(
      patch.pages.map((page, pageIndex) => ({
        id: createId(),
        note_id: action.noteId,
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

  return {
    ...current,
    ...patch,
    title: patch.title ?? current.title,
  } as Note;
}

async function mergeNotesAction(
  supabase: ServerSupabase,
  userId: string,
  action: Extract<AiAction, { type: "mergeNotes" }>,
  createdFolderIdsByTempId: Map<string, string>,
) {
  const notes = await getOwnedNotes(supabase, userId, action.noteIds);
  const folderId = await resolveFolderId(supabase, userId, action.folderId ?? null, action.folderName, action.tempId, createdFolderIdsByTempId);
  const content = notes.map((note) => `# ${note.title}\n\n${note.content}`.trim()).join("\n\n---\n\n");
  const tags = normalizeActionTags([...(action.tags ?? []), ...notes.flatMap((note) => note.user_tags ?? [])]);
  const merged = await createNoteAction(supabase, userId, { ...action, type: "createNote", content, folderId, tags }, createdFolderIdsByTempId);

  if (action.deleteSources !== false) {
    await patchNotesAction(supabase, userId, action.noteIds, () => normalizeNotePatch({ trashedAt: nowIso() }, { scheduleAnalysis: false }));
  }

  return merged;
}

async function mergeFoldersAction(
  supabase: ServerSupabase,
  userId: string,
  action: Extract<AiAction, { type: "mergeFolders" }>,
  createdFolderIdsByTempId: Map<string, string>,
) {
  const sourceFolders = await Promise.all(action.sourceFolderIds.map((folderId) => getOwnedFolder(supabase, userId, folderId)));
  const targetFolderId = await resolveFolderId(supabase, userId, action.targetFolderId ?? null, action.targetFolderName, action.targetTempId, createdFolderIdsByTempId);
  const targetFolder = targetFolderId
    ? await getOwnedFolder(supabase, userId, targetFolderId)
    : action.targetFolderName
      ? await createFolderAction(supabase, userId, action.targetFolderName)
      : sourceFolders[0];
  const sourceFolderIds = sourceFolders.map((folder) => folder.id).filter((id) => id !== targetFolder.id);
  const affectedNoteIds = sourceFolderIds.length ? await moveNotesToFolderAction(supabase, userId, await getNoteIdsForFolders(supabase, userId, sourceFolderIds), targetFolder.id, false) : [];

  if (action.deleteSources !== false) {
    for (const sourceFolderId of sourceFolderIds) {
      const { error } = await supabase.from("folders").delete().eq("id", sourceFolderId).eq("owner_id", userId);

      if (error) {
        throw error;
      }
    }
  }

  return { targetFolder, sourceFolderIds, affectedNoteIds };
}

async function getNoteIdsForFolders(supabase: ServerSupabase, userId: string, folderIds: string[]) {
  const { data, error } = await supabase.from("notes").select("id").eq("owner_id", userId).in("folder_id", folderIds);

  if (error) {
    throw error;
  }

  return (data ?? []).map((note) => note.id);
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
