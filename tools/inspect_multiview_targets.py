from pathlib import Path
import re

files = ["index.html", "app.js", "style.css"]
for f in files:
    p = Path(f)
    print("\n" + "="*80)
    print(f)
    print("="*80)
    if not p.exists():
        print("Mangler")
        continue
    text = p.read_text(encoding="utf-8", errors="replace")
    print("Størrelse:", len(text), "tegn")
    for term in [
        "render",
        "podcast",
        "filter",
        "sort",
        "Supabase",
        "favorite",
        "modal",
        "load",
        "ranking",
        "showMore",
        "DOMContentLoaded",
    ]:
        hits = [m.start() for m in re.finditer(term, text, flags=re.I)]
        print(f"{term}: {len(hits)} hits")
