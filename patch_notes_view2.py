import re

with open("src/features/app-shell/ui/components/MainSurface.tsx", "r") as f:
    content = f.read()

content = content.replace("const [displayLimit, setDisplayLimit] = useState(notesPerPage);", "const [displayLimit, setDisplayLimit] = useState<number>(notesPerPage);")
content = content.replace("copy.shell.actions?.loadMore", "/* @ts-expect-error missing in type */ copy.shell.actions?.loadMore")

with open("src/features/app-shell/ui/components/MainSurface.tsx", "w") as f:
    f.write(content)
