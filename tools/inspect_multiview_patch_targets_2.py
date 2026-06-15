from pathlib import Path

def print_range(file, start, end, title):
    text = Path(file).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    print("\n" + "="*90)
    print(f"{file} - {title} linje {start}-{end}")
    print("="*90)
    for i in range(start, min(end, len(lines)) + 1):
        print(f"{i:5}: {lines[i-1]}")

print_range("index.html", 35, 60, "top/brand")
print_range("app.js", 2775, 2825, "render og grid click start")
print_range("app.js", 2890, 2935, "sort/ranking events")
print_range("app.js", 3175, 3215, "startup")
