import os

status_file = "IMPLEMENTATION_STATUS.md"

with open(status_file, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith("- [ ] 6. EDITOR CORE"):
        new_lines.append("- [x] 6. EDITOR CORE\n")
    elif line.startswith("- [ ] 7. EDITOR SMART LOGIC"):
        new_lines.append("- [x] 7. EDITOR SMART LOGIC\n")
    elif line.startswith("- [ ] 8. MEDIA И BYOS"):
        new_lines.append("- [x] 8. MEDIA И BYOS\n")
    elif line.startswith("- [ ] 9. CANVAS DRAWING"):
        new_lines.append("- [x] 9. CANVAS DRAWING\n")
    elif line.startswith("- [ ] 10. AI ENGINE"):
        new_lines.append("- [x] 10. AI ENGINE\n")
    else:
        new_lines.append(line)

with open(status_file, "w") as f:
    f.writelines(new_lines)
