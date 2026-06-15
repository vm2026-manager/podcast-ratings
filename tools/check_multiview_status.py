from pathlib import Path

for file in ["index.html", "app.js", "style.css"]:
    text = Path(file).read_text(encoding="utf-8", errors="replace")
    print("\n===", file, "===")
    for term in [
        "pageIntroPanel",
        "site-nav",
        "VALID_PAGES",
        "updatePageUi",
        "getPageIntroMarkup",
        "renderAuthPanel();",
        "updatePageUi();",
        "page-forside",
    ]:
        print(term, text.count(term))
