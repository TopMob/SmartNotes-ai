import sys

file_path = "src/features/app-shell/ui/components/EditorOverlay.tsx"

with open(file_path, "r") as f:
    content = f.read()

handle_attach_image_search = "        editor?.chain().focus().setImage({ src: media.url }).run();"
handle_attach_image_replace = "        if (media.url) editor?.chain().focus().setImage({ src: media.url }).run();"
content = content.replace(handle_attach_image_search, handle_attach_image_replace)

with open(file_path, "w") as f:
    f.write(content)

print("Patch applied.")
