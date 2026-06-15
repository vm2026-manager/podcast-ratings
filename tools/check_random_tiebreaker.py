from pathlib import Path
text = Path("app.js").read_text(encoding="utf-8", errors="replace")
for term in ["randomTieBreaker", "compareRandomTieBreaker", "hasSameMadsRating", "bothMissingMadsRating"]:
    print(term, text.count(term))
