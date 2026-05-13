import sys

file_path = "src/features/app-shell/ui/components/EditorOverlay.tsx"

with open(file_path, "r") as f:
    content = f.read()

import_search = """import { MathExtension } from "@/features/editor/lib/math-extension";"""
import_replace = """import { MathExtension } from "@/features/editor/lib/math-extension";\nimport { DrawingCanvas } from "@/features/editor/ui/DrawingCanvas";"""
content = content.replace(import_search, import_replace)

state_search = """  const markEditorDirty = useNoteUiStore((state) => state.markEditorDirty);"""
state_replace = """  const markEditorDirty = useNoteUiStore((state) => state.markEditorDirty);\n  const [isDrawing, setIsDrawing] = useState(false);"""
content = content.replace(state_search, state_replace)

sketch_button_search = """<ToolButton icon={Paintbrush} label="Sketch" onClick={() => { addPage(`Sketch ${pageCount + 1}`); setCurrentNotePageIndex(pageCount); }} />"""
sketch_button_replace = """<ToolButton icon={Paintbrush} label="Sketch" onClick={() => setIsDrawing(true)} />"""
content = content.replace(sketch_button_search, sketch_button_replace)

canvas_render_search = """          {toolbarVisible ? ("""
canvas_render_replace = """          {isDrawing && (
            <DrawingCanvas
              onClose={() => setIsDrawing(false)}
              onSave={(dataUrl) => {
                editor.chain().focus().setImage({ src: dataUrl }).run();
                setIsDrawing(false);
              }}
            />
          )}
          {toolbarVisible ? ("""
content = content.replace(canvas_render_search, canvas_render_replace)

with open(file_path, "w") as f:
    f.write(content)

print("Patch applied.")
