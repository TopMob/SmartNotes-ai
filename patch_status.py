with open("IMPLEMENTATION_STATUS.md", "r") as f:
    content = f.read()

content = content.replace("- [ ] 4. SEARCH, FILTERS, SORTING", "- [x] 4. SEARCH, FILTERS, SORTING")

with open("IMPLEMENTATION_STATUS.md", "w") as f:
    f.write(content)
