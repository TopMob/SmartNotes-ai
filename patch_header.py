import sys

def main():
    filepath = 'src/features/app-shell/ui/components/Header.tsx'
    try:
        with open(filepath, 'r') as file:
            content = file.read()

        search_store_import = 'import { useSearchStore } from "@/features/search";'
        if search_store_import not in content:
            content = content.replace(
                'import { type AppView } from "@/shared/store/ui-store";',
                f'import {{ type AppView }} from "@/shared/store/ui-store";\n{search_store_import}'
            )

        content = content.replace(
            'onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.shell.search} value={searchQuery}',
            'onChange={(event) => useSearchStore.getState().setQuery(event.target.value)} placeholder={copy.shell.search} value={useSearchStore((state) => state.query)}'
        )

        with open(filepath, 'w') as file:
            file.write(content)

        print("Patched Header.tsx successfully")
    except Exception as e:
        print(f"Error patching file: {e}")

if __name__ == "__main__":
    main()
