import re

with open("src/features/app-shell/ui/components/MainSurface.tsx", "r") as f:
    content = f.read()

import_statement = 'import { Brain, Folder, Heart, RotateCcw, Shield, Sparkles } from "lucide-react";\nimport { useMemo, useState } from "react";'
content = content.replace('import { Brain, Folder, Heart, RotateCcw, Shield, Sparkles } from "lucide-react";\nimport { useMemo } from "react";', import_statement)


old_func = """function NotesView({ copy, title: _title, notes, notesPerPage, emptyText, onOpenNote, onOpenSheet, view }: { copy: ReturnType<typeof getUiCopy>; title: string; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; emptyText: string; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; view: AppView }) {
  const { data: folders = [] } = useFoldersQuery();
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);
  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);
  const pinnedVisible = pinned.slice(0, notesPerPage);
  const unpinnedVisible = unpinned.slice(0, Math.max(notesPerPage - pinnedVisible.length, 0));
  if (!notes.length) {"""

new_func = """function NotesView({ copy, title: _title, notes, notesPerPage, emptyText, onOpenNote, onOpenSheet, view }: { copy: ReturnType<typeof getUiCopy>; title: string; notes: Note[]; notesPerPage: 5 | 10 | 20 | 50; emptyText: string; onOpenNote: (noteId: string) => void; onOpenSheet: (sheet: Exclude<SheetName, null>, anchor?: SheetAnchor | null) => void; view: AppView }) {
  const { data: folders = [] } = useFoldersQuery();
  const [displayLimit, setDisplayLimit] = useState(notesPerPage);
  const visibleFolders = useMemo(() => folders.filter((folder) => !folder.trashedAt && !folder.isHidden), [folders]);
  const { pinned, unpinned } = useMemo(() => selectPinnedGroups(notes), [notes]);

  const pinnedVisible = pinned.slice(0, displayLimit);
  const unpinnedVisible = unpinned.slice(0, Math.max(displayLimit - pinnedVisible.length, 0));
  const hasMore = displayLimit < notes.length;

  if (!notes.length) {"""

content = content.replace(old_func, new_func)

button_injection_old = """      ) : null}
    </div>
  );
}"""

button_injection_new = """      ) : null}

      {hasMore ? (
        <div className="mt-8 flex justify-center pb-8">
          <button
            className="rounded-2xl border border-border bg-surface-strong px-6 py-3 text-sm font-black text-foreground/72 hover:bg-surface transition-colors"
            onClick={() => setDisplayLimit(limit => limit + notesPerPage)}
            type="button"
          >
            {copy.shell.actions?.loadMore || "Показать еще"}
          </button>
        </div>
      ) : null}
    </div>
  );
}"""

content = content.replace(button_injection_old, button_injection_new)

with open("src/features/app-shell/ui/components/MainSurface.tsx", "w") as f:
    f.write(content)
