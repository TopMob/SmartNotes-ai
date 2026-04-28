"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { useAuthStore } from "@/features/auth/model/auth-store";
import { foldersRepository } from "@/features/folders/api/folders-repository";
import { notesRepository } from "@/features/notes/api/notes-repository";
import { useFoldersStore } from "@/features/folders/model/folders-store";
import { useNotesStore } from "@/features/notes/model/notes-store";

export function DataBootstrap({ children }: Readonly<{ children: ReactNode }>) {
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const setFolders = useFoldersStore((state) => state.setFolders);
  const setNotes = useNotesStore((state) => state.setNotes);

  useEffect(() => {
    if (authStatus !== "authenticated" || !authUser) {
      if (authStatus === "anonymous") {
        setFolders([]);
        setNotes([]);
      }

      return;
    }

    let cancelled = false;

    void Promise.all([foldersRepository.list(), notesRepository.list()])
      .then(([folders, notes]) => {
        if (cancelled) {
          return;
        }

        setFolders(folders);
        setNotes(notes);
      })
      .catch((error) => {
        console.error("Failed to bootstrap user data", error);
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, authUser, setFolders, setNotes]);

  return children;
}
