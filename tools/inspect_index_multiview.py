from pathlib import Path
import re

text = Path("index.html").read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()

print("=== Mulige containere og nav-elementer i index.html ===")
for i, line in enumerate(lines, start=1):
    if (
        "<main" in line
        or "</main" in line
        or "<section" in line
        or "</section" in line
        or "<header" in line
        or "<nav" in line
        or "podcast" in line.lower()
        or "ranking" in line.lower()
        or "filter" in line.lower()
        or "recent" in line.lower()
        or "featured" in line.lower()
        or "genre" in line.lower()
        or "data-" in line
        or "id=" in line
    ):
        print(f"{i:5}: {line[:220]}")
