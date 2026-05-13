import sys

def patch():
    filepath = 'src/features/app-shell/ui/components/Header.tsx'
    with open(filepath, 'r') as file:
        content = file.read()
    content = content.replace(
        'import { useSearchStore } from "@/features/search/model/search-store";',
        'import { useSearchStore } from "../../../../search/model/search-store";'
    )
    with open(filepath, 'w') as file:
        file.write(content)

    filepath = 'src/features/app-shell/ui/components/MainSurface.tsx'
    with open(filepath, 'r') as file:
        content = file.read()
    content = content.replace(
        'import { useSearchStore } from "@/features/search/model/search-store";',
        'import { useSearchStore } from "../../../../search/model/search-store";'
    )
    with open(filepath, 'w') as file:
        file.write(content)

if __name__ == "__main__":
    patch()
