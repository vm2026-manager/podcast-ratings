#!/usr/bin/env python3
"""Convert base64 data-URI podcast covers in JSON data to image files."""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any


IMAGE_FIELDS = (
    "Billedlink",
    "Billedefil",
    "Billede",
    "Cover",
    "Image",
    "Auto-billedlink",
)

EXTENSION_BY_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}

DATA_URI_RE = re.compile(r"^data:(image/[a-z0-9.+-]+);base64,(.+)$", re.IGNORECASE | re.DOTALL)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return slug[:80] or "podcast-cover"


def parse_data_uri(value: str) -> tuple[str, bytes] | None:
    match = DATA_URI_RE.match(value.strip())
    if not match:
        return None

    mime_type = match.group(1).lower()
    payload = re.sub(r"\s+", "", match.group(2))

    try:
        return mime_type, base64.b64decode(payload, validate=True)
    except ValueError:
        return None


def get_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]

    if isinstance(payload, dict):
        for key in ("podcasts", "data", "rows"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]

    raise ValueError("JSON-filen skal være et array eller indeholde en liste i podcasts/data/rows.")


def unique_output_path(output_dir: Path, base_slug: str, extension: str, image_bytes: bytes) -> Path:
    candidate = output_dir / f"{base_slug}.{extension}"
    suffix = 2

    while candidate.exists() and candidate.read_bytes() != image_bytes:
        candidate = output_dir / f"{base_slug}-{suffix}.{extension}"
        suffix += 1

    return candidate


def convert_file(
    json_path: Path,
    output_dir: Path,
    repo_root: Path,
    dry_run: bool = False,
) -> tuple[int, int, list[str]]:
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    rows = get_rows(payload)
    found = 0
    converted = 0
    changed: list[str] = []

    for index, row in enumerate(rows, start=1):
        title = str(row.get("Titel") or row.get("Title") or f"podcast-{index}")

        for field in IMAGE_FIELDS:
            value = row.get(field)
            if not isinstance(value, str) or not value.strip().lower().startswith("data:image/"):
                continue

            found += 1
            parsed = parse_data_uri(value)
            if not parsed:
                print(f"ADVARSEL: Kunne ikke dekode billede for '{title}' ({field}).", file=sys.stderr)
                continue

            mime_type, image_bytes = parsed
            extension = EXTENSION_BY_MIME.get(mime_type, mime_type.split("/")[-1].replace("jpeg", "jpg"))
            output_path = unique_output_path(output_dir, slugify(title), extension, image_bytes)
            relative_path = output_path.relative_to(repo_root).as_posix()

            if not dry_run:
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path.write_bytes(image_bytes)
                row[field] = relative_path

            converted += 1
            changed.append(f"{title} -> {relative_path}")

    if converted and not dry_run:
        json_path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

    return found, converted, changed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert data:image base64 covers in podcast JSON to real image files."
    )
    parser.add_argument(
        "--json",
        default="data/podcasts.json",
        help="JSON file to update. Default: data/podcasts.json",
    )
    parser.add_argument(
        "--output-dir",
        default="images/covers",
        help="Directory for decoded cover files. Default: images/covers",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing files.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    json_path = (repo_root / args.json).resolve()
    output_dir = (repo_root / args.output_dir).resolve()

    if not json_path.exists():
        print(f"FEJL: JSON-filen findes ikke: {json_path}", file=sys.stderr)
        return 1

    try:
        found, converted, changed = convert_file(json_path, output_dir, repo_root, args.dry_run)
    except Exception as error:
        print(f"FEJL: {error}", file=sys.stderr)
        return 1

    print(f"Fundne base64-billeder: {found}")
    print(f"Konverterede billeder: {converted}")
    if changed:
        print("Ændrede podcasts:")
        for item in changed:
            print(f"- {item}")
    else:
        print("Ændrede podcasts: ingen")

    if args.dry_run:
        print("Dry run: ingen filer blev ændret.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
