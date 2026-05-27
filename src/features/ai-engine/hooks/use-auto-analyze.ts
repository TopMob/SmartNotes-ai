import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAiEngineStore } from "../model/ai-store";

export function useAutoAnalyze(noteId: string, content: string) {
  const setStatus = useAiEngineStore((state) => state.setStatus);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setStatus("pending");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setStatus("analyzing");

      try {
        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ noteId }),
        });

        if (response.ok) {
          setStatus("done");
          // Invalidate notes query to reload the updated note summary/metadata in the UI
          void queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === "notes",
          });
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.error("Auto AI analysis failed:", error);
        setStatus("error");
      }
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, noteId, setStatus, queryClient]);
}
