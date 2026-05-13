import sys

file_path = "src/features/app-shell/ui/components/EditorOverlay.tsx"

with open(file_path, "r") as f:
    content = f.read()

import_search = """import ImageExtension from "@tiptap/extension-image";"""
import_replace = """import ImageExtension from "@tiptap/extension-image";\nimport { MathExtension } from "@/features/editor/lib/math-extension";"""
content = content.replace(import_search, import_replace)

extensions_search = """const EDITOR_EXTENSIONS = [
  StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false }, link: false }),
  LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  UnderlineExtension,
  ImageExtension,
];"""
extensions_replace = """const EDITOR_EXTENSIONS = [
  StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false }, link: false }),
  LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  UnderlineExtension,
  ImageExtension,
  MathExtension,
];"""
content = content.replace(extensions_search, extensions_replace)

with open(file_path, "w") as f:
    f.write(content)

print("Patch applied.")
