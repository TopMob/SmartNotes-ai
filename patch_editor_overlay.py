import sys

file_path = "src/features/app-shell/ui/components/EditorOverlay.tsx"

with open(file_path, "r") as f:
    content = f.read()

# Replace 1: Imports
import_replace = """import UnderlineExtension from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import { useEffect, useRef, useState, type ComponentType } from "react";"""
content = content.replace('import UnderlineExtension from "@tiptap/extension-underline";\nimport { useEffect, useRef, type ComponentType } from "react";', import_replace)

# Replace 2: EDITOR_EXTENSIONS
extensions_replace = """const EDITOR_EXTENSIONS = [
  StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false }, link: false }),
  LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  UnderlineExtension,
  ImageExtension,
];"""
content = content.replace("""const EDITOR_EXTENSIONS = [
  StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false }, link: false }),
  LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  UnderlineExtension,
];""", extensions_replace)

# Replace 3: handleAttachImage
handle_attach_image_search = """      try {
        const media = await createLocalInlineMediaDescriptor(file);
        attachMedia(note.id, media);
        setMediaDiagnostic({
          provider: media.provider,
          degraded: true,
          message: `Stored ${file.name} as local inline media because direct Drive upload is not configured in this client build.`,
        });
      } catch (error) {"""
handle_attach_image_replace = """      try {
        const media = await createLocalInlineMediaDescriptor(file);
        attachMedia(note.id, media);
        editor?.chain().focus().setImage({ src: media.url }).run();
        setMediaDiagnostic({
          provider: media.provider,
          degraded: true,
          message: `Stored ${file.name} as local inline media because direct Drive upload is not configured in this client build.`,
        });
      } catch (error) {"""
content = content.replace(handle_attach_image_search, handle_attach_image_replace)

with open(file_path, "w") as f:
    f.write(content)

print("Patch applied.")
