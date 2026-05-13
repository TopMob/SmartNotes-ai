import { useEffect, useRef } from "react";
import { useAiEngineStore } from "../model/ai-store";

export function useAutoAnalyze(noteId: string, content: string) {
  const setStatus = useAiEngineStore((state) => state.setStatus);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setStatus("pending");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setStatus("analyzing");

      // Simulate API call for now since we don't have the real endpoint fully wired up in the frontend component yet
      setTimeout(() => {
         setStatus("done");
      }, 1000);

    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, noteId, setStatus]);
}
