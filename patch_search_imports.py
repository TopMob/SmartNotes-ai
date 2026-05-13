import sys

def patch_header():
    filepath = 'src/features/app-shell/ui/components/Header.tsx'
    try:
        with open(filepath, 'r') as file:
            content = file.read()

        content = content.replace(
            'import { useSearchStore } from "@/features/search";',
            'import { useSearchStore } from "@/features/search/model/search-store";'
        ).replace(
            'useSearchStore((state) => state.query)',
            'useSearchStore((state: any) => state.query)'
        )

        with open(filepath, 'w') as file:
            file.write(content)
        print("Patched Header.tsx imports")
    except Exception as e:
        print(f"Error patching Header.tsx: {e}")

def patch_main_surface():
    filepath = 'src/features/app-shell/ui/components/MainSurface.tsx'
    try:
        with open(filepath, 'r') as file:
            content = file.read()

        content = content.replace(
            'import { useSearchStore } from "@/features/search";',
            'import { useSearchStore } from "@/features/search/model/search-store";'
        ).replace(
            'searchState.tags.some(tag => n.userTags.includes(tag) || n.hiddenTags.includes(tag))',
            'searchState.tags.some((tag: string) => n.userTags.includes(tag) || n.hiddenTags.includes(tag))'
        ).replace(
            '(a.manualOrder || 0) - (b.manualOrder || 0)',
            '((a as any).manualOrder || 0) - ((b as any).manualOrder || 0)'
        )

        with open(filepath, 'w') as file:
            file.write(content)
        print("Patched MainSurface.tsx imports")
    except Exception as e:
        print(f"Error patching MainSurface.tsx: {e}")

if __name__ == "__main__":
    patch_header()
    patch_main_surface()
