import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAiEngineStore } from "../model/ai-store";
import type { Note } from "@/entities/note";
import { normalizeText } from "@/shared/utils/string";
import { createSupabaseBrowserClient } from "@/shared/api/supabase/client";

async function computeHash(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useAutoAnalyze(note: Note, title: string, content: string) {
  const setStatus = useAiEngineStore((state) => state.setStatus);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  const queryClient = useQueryClient();
  const lastHashRef = useRef<string | null>(null);
  const noteId = note?.id;
  const noteAiStatus = note?.aiStatus;
  const storedHash = (note?.metadata as { content_hash?: string } | null | undefined)?.content_hash || null;

  useEffect(() => {
    if (noteId) {
      setStatus(noteAiStatus || "done");
    }
  }, [noteId, noteAiStatus, setStatus]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        if (!title.trim() && !content.trim()) {
          return;
        }

        const combinedText = `${title || ""} ${content || ""}`;
        const normalized = normalizeText(combinedText);
        const hash = await computeHash(normalized);
        
        if (hash === storedHash || hash === lastHashRef.current) {
          return;
        }

        setStatus("pending");
        setStatus("analyzing");

        const supabase = createSupabaseBrowserClient();
        let token = "";
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token || "";
        }

        const gatewayUrl = process.env.NEXT_PUBLIC_RAILWAY_GATEWAY_URL?.replace(/\/+$/, "");
        const url = gatewayUrl ? `${gatewayUrl}/analyze` : "/api/ai/analyze";

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            noteId,
            title,
            content,
          }),
        });

        if (response.ok) {
          lastHashRef.current = hash;
          const data = await response.json().catch(() => ({}));
          if (data.status === "done" || data.skipped) {
            setStatus("done");
            queryClient.setQueriesData<any>(
              { queryKey: ["note-detail"] },
              (old: any) => {
                if (old && old.id === noteId) {
                  return { ...old, aiStatus: "done", analyzed: true };
                }
                return old;
              }
            );
          } else {
            setStatus("analyzing");
            queryClient.setQueriesData<any>(
              { queryKey: ["note-detail"] },
              (old: any) => {
                if (old && old.id === noteId) {
                  return { ...old, aiStatus: "analyzing" };
                }
                return old;
              }
            );
            queryClient.setQueriesData<any>(
              { queryKey: ["notes"] },
              (old: any) => {
                if (!old) return old;
                if (old.pages) {
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      data: page.data.map((n: any) =>
                        n.id === noteId ? { ...n, aiStatus: "analyzing" } : n
                      ),
                    })),
                  };
                }
                if (Array.isArray(old)) {
                  return old.map((n: any) =>
                    n.id === noteId ? { ...n, aiStatus: "analyzing" } : n
                  );
                }
                return old;
              }
            );
          }
          void queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === "notes" || query.queryKey[0] === "note-detail",
          });
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [noteId, storedHash, title, content, setStatus, queryClient]);
}
