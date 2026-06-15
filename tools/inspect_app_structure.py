from pathlib import Path
import re

text = Path("app.js").read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()

patterns = [
    "function ",
    "const ",
    "let ",
    "var ",
    "fetch(",
    "rankingSource",
    "sort",
    "render",
    "podcasts",
    "filtered",
    "visible",
    "placement",
    "rating",
    "userRatings",
    "average",
]

print("=== Mulige vigtige linjer i app.js ===")
for i, line in enumerate(lines, start=1):
    low = line.lower()
    if any(p.lower() in low for p in patterns):
        if (
            "function " in line
            or "=>" in line
            or "fetch(" in line
            or "rankingSource" in line
            or ".sort(" in line
            or "sort(" in line
        ):
            print(f"{i:5}: {line[:180]}")

print("\n=== Funktioner fundet ===")
for i, line in enumerate(lines, start=1):
    m = re.search(r"\bfunction\s+([A-Za-z0-9_$]+)\s*\(", line)
    if m:
        print(f"{i:5}: function {m.group(1)}")

print("\n=== Arrow/const-funktioner fundet ===")
for i, line in enumerate(lines, start=1):
    m = re.search(r"\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>", line)
    if m:
        print(f"{i:5}: {m.group(1)}")

print("\n=== Sorteringsblokke ===")
for i, line in enumerate(lines, start=1):
    if ".sort(" in line or "sort(" in line:
        start = max(1, i-5)
        end = min(len(lines), i+15)
        print(f"\n--- sort omkring linje {i} ---")
        for j in range(start, end+1):
            print(f"{j:5}: {lines[j-1][:180]}")
