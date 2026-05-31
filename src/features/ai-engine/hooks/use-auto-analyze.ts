import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAiEngineStore } from "../model/ai-store";
import type { Note } from "@/entities/note";
import { normalizeText } from "@/shared/utils/string";

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

  useEffect(() => {
    if (note) {
      setStatus(note.aiStatus || "done");
    }
  }, [note?.id, note?.aiStatus, setStatus]);

  const noteId = note?.id;
  const storedHash = (note?.metadata as { content_hash?: string } | null | undefined)?.content_hash || null;

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
        const combinedText = `${title || ""} ${content || ""}`;
        const normalized = normalizeText(combinedText);
        const hash = await computeHash(normalized);
        
        if (hash === storedHash || hash === lastHashRef.current) {
          return;
        }

        setStatus("pending");
        setStatus("analyzing");

        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            noteId,
            title,
            content,
          }),
        });

        if (response.ok) {
          lastHashRef.current = hash;
          setStatus("done");
          void queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === "notes",
          });
        } else {
          setStatus("error");
        }
      } catch (error) {
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
