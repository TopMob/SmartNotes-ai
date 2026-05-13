import sys

def main():
    filepath = 'src/features/app-shell/ui/components/MainSurface.tsx'
    try:
        with open(filepath, 'r') as file:
            content = file.read()

        import_stmt = 'import { useSearchStore } from "@/features/search";\n'
        if import_stmt not in content:
            content = content.replace(
                'import { selectPinnedGroups } from "@/features/notes/model/note-selectors";',
                f'import {{ selectPinnedGroups }} from "@/features/notes/model/note-selectors";\n{import_stmt}'
            )

        filter_logic = """
  const searchState = useSearchStore();

  const filteredNotes = useMemo(() => {
    let result = notes;

    // 1. Text Query
    if (searchState.query.trim()) {
      const q = searchState.query.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    }

    // 2. Tags
    if (searchState.tags.length > 0) {
      result = result.filter(n =>
        searchState.tags.some(tag => n.userTags.includes(tag) || n.hiddenTags.includes(tag))
      );
    }

    // 3. Folders
    if (searchState.folders.length > 0) {
      result = result.filter(n => {
        if (searchState.folders.includes("none") && !n.folderId) return true;
        return n.folderId && searchState.folders.includes(n.folderId);
      });
    }

    // 4. Updated Window
    if (searchState.updatedWindowDays !== null) {
      const cutoff = Date.now() - (searchState.updatedWindowDays * 24 * 60 * 60 * 1000);
      result = result.filter(n => new Date(n.updatedAt).getTime() >= cutoff);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (searchState.sort) {
        case "alphabetical":
          return a.title.localeCompare(b.title);
        case "relevance":
          return (b.aiRelevance || 0) - (a.aiRelevance || 0);
        case "importance":
          // Stub: fallback to updated if importance not mapped
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "textLength":
          return b.content.length - a.content.length;
        case "manual":
          return (a.manualOrder || 0) - (b.manualOrder || 0);
        case "updatedAt":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [notes, searchState]);

  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(filteredNotes), [filteredNotes]);
"""

        if "const searchState = useSearchStore();" not in content:
            content = content.replace(
                "const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);",
                filter_logic
            )

        with open(filepath, 'w') as file:
            file.write(content)

        print("Patched MainSurface.tsx successfully")
    except Exception as e:
        print(f"Error patching file: {e}")

if __name__ == "__main__":
    main()
