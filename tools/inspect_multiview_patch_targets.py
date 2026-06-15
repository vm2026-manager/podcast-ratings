from pathlib import Path

def print_range(file, start, end, title):
    text = Path(file).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    print("\n" + "="*90)
    print(f"{file} - {title} linje {start}-{end}")
    print("="*90)
    for i in range(start, min(end, len(lines)) + 1):
        print(f"{i:5}: {lines[i-1]}")

print_range("index.html", 35, 130, "top/layout/sidebar/start main")
print_range("index.html", 128, 255, "main content")
print_range("app.js", 100, 140, "state/elements")
print_range("app.js", 2750, 2775, "render")
print_range("app.js", 2820, 2895, "setupEvents")
