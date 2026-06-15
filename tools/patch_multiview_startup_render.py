from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8", errors="replace")

old = '''setupEvents();
applyViewModePreference();
loadPodcasts();
runSecondaryStartup();
'''

new = '''setupEvents();
applyViewModePreference();
updatePageUi();
renderAuthPanel();
loadPodcasts();
runSecondaryStartup();
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"FEJL: Forventede 1 match, fandt {count}")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")

print("OK: Forside/ui renderes nu straks ved startup.")
