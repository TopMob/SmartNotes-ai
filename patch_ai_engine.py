import sys

file_path = "src/features/app-shell/ui/components/EditorOverlay.tsx"

with open(file_path, "r") as f:
    content = f.read()

import_search = """import { DrawingCanvas } from "@/features/editor/ui/DrawingCanvas";"""
import_replace = """import { DrawingCanvas } from "@/features/editor/ui/DrawingCanvas";\nimport { useAiEngineStore } from "@/features/ai-engine/model/ai-store";\nimport { useAutoAnalyze } from "@/features/ai-engine/hooks/use-auto-analyze";"""
content = content.replace(import_search, import_replace)

hook_search = """  const markEditorDirty = useNoteUiStore((state) => state.markEditorDirty);"""
hook_replace = """  const markEditorDirty = useNoteUiStore((state) => state.markEditorDirty);\n  const aiStatus = useAiEngineStore((state) => state.status);\n  useAutoAnalyze(note.id, currentPage.content);"""
content = content.replace(hook_search, hook_replace)

badge_search = """<div className="text-xs font-bold text-foreground/48">{durableState.error ? "Ошибка сохранения durable snapshot" : durableState.isSaving ? "Сохраняем durable snapshot..." : editorDirty ? "Есть несохраненные локальные изменения" : "Durable snapshot синхронизирован"}</div>"""
badge_replace = """<div className="flex items-center gap-2">
            <div className="text-xs font-bold text-foreground/48">
              AI: {aiStatus === 'pending' ? 'Ожидание' : aiStatus === 'analyzing' ? 'Анализ...' : aiStatus === 'error' ? 'Ошибка AI' : 'Готово'}
            </div>
            <div className="text-xs font-bold text-foreground/48">{durableState.error ? "Ошибка сохранения durable snapshot" : durableState.isSaving ? "Сохраняем durable snapshot..." : editorDirty ? "Есть несохраненные локальные изменения" : "Durable snapshot синхронизирован"}</div>
          </div>"""
content = content.replace(badge_search, badge_replace)

with open(file_path, "w") as f:
    f.write(content)

print("Patch applied.")
