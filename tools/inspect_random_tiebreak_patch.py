from pathlib import Path

text = Path("app.js").read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()

ranges = [
    (100, 135, "state/elements"),
    (690, 760, "mapPodcast start"),
    (760, 820, "mapPodcast end"),
    (1040, 1100, "getFilteredPodcasts"),
    (1125, 1155, "rebuildUserRanks"),
    (3070, 3115, "loadPodcasts/rebuildUserRanks area"),
]

for start, end, title in ranges:
    print("\n" + "="*90)
    print(title, f"linje {start}-{end}")
    print("="*90)
    for i in range(start, min(end, len(lines)) + 1):
        print(f"{i:5}: {lines[i-1]}")
