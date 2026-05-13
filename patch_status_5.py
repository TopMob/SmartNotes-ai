with open("IMPLEMENTATION_STATUS.md", "r") as f:
    content = f.read()

content = content.replace("- [ ] 5. SEARCH ENGINE DETAIL", "- [x] 5. SEARCH ENGINE DETAIL")

with open("IMPLEMENTATION_STATUS.md", "w") as f:
    f.write(content)
