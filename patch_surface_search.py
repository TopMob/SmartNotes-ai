import sys

def main():
    filepath = 'src/features/app-shell/ui/components/MainSurface.tsx'
    try:
        with open(filepath, 'r') as file:
            content = file.read()

        import_stmt = 'import { calculateScore } from "@/features/search/lib/search-engine";\n'
        if import_stmt not in content:
            content = content.replace(
                'import { useSearchStore } from "@/features/search";',
                f'import {{ useSearchStore }} from "@/features/search";\n{import_stmt}'
            )

        filter_logic = """
  const searchState = useSearchStore();

  const filteredNotes = useMemo(() => {
    let result = notes;

    // 1. Text Query (Search Engine Detail)
    if (searchState.query.trim()) {
      result = result
        .map(note => ({ note, score: calculateScore(note, searchState.query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.note);
    }

    // 2. Tags
    if (searchState.tags.length > 0) {
      result = result.filter(n =>
        searchState.tags.some((tag: string) => n.userTags.includes(tag) || n.hiddenTags.includes(tag))
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
          return ((a as any).manualOrder || 0) - ((b as any).manualOrder || 0);
        case "updatedAt":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [notes, searchState]);

  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(filteredNotes), [filteredNotes]);
"""

        # Replace the entire old useMemo block for filteredNotes
        import re
        content = re.sub(
            r'const filteredNotes = useMemo\(\(\) => \{.*?\}, \[notes, searchState\]\);',
            filter_logic.split('const searchState = useSearchStore();\n')[1].split('\n  const { pinned')[0],
            content,
            flags=re.DOTALL
        )

        with open(filepath, 'w') as file:
            file.write(content)

        print("Patched MainSurface.tsx successfully")
    except Exception as e:
        print(f"Error patching file: {e}")

if __name__ == "__main__":
    main()
