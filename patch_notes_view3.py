with open("src/features/app-shell/ui/components/MainSurface.tsx", "r") as f:
    content = f.read()

content = content.replace("/* @ts-expect-error missing in type */ copy.shell.actions?.loadMore", "(copy.shell.actions as any)?.loadMore")

with open("src/features/app-shell/ui/components/MainSurface.tsx", "w") as f:
    f.write(content)
