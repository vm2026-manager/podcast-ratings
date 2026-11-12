#!/usr/bin/env python3
"""Reproducibly render original Podcastlisten Instagram recommendation cards."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "instagram" / "original-cards"
MANIFEST = ROOT / "assets" / "instagram" / "manifest.json"
SIZE = (1080, 1080)
FORMAT = "PNG"
CONTENT_TYPE = "image/png"
PALETTE_KEYS = ("--bg", "--panel", "--text", "--muted", "--line", "--accent", "--accent-deep", "--accent-soft")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def encode_indexed_png(image: Image.Image) -> bytes:
    """Encode a 16-color PNG with stored DEFLATE blocks for cross-platform bytes."""
    indexed = image.quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    width, height = indexed.size
    palette = indexed.getpalette()[:48]
    palette += [0] * (48 - len(palette))
    pixels = indexed.load()
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # PNG filter: None
        for x in range(0, width, 2):
            left = pixels[x, y]
            right = pixels[x + 1, y] if x + 1 < width else 0
            if left > 15 or right > 15:
                raise ValueError("Indexed card exceeded the 16-color palette")
            rows.append((left << 4) | right)

    # RFC 1950 zlib stream wrapping RFC 1951 stored blocks. This avoids
    # compressor-version-dependent PNG bytes while keeping indexed files small.
    deflate = bytearray(b"\x78\x01")
    for offset in range(0, len(rows), 65535):
        block = rows[offset:offset + 65535]
        deflate.append(1 if offset + len(block) == len(rows) else 0)
        deflate.extend(struct.pack("<HH", len(block), 0xFFFF ^ len(block)))
        deflate.extend(block)
    deflate.extend(struct.pack(">I", zlib.adler32(rows) & 0xFFFFFFFF))

    header = struct.pack(">IIBBBBB", width, height, 4, 3, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"PLTE", bytes(palette))
        + png_chunk(b"IDAT", bytes(deflate))
        + png_chunk(b"IEND", b"")
    )


def canonical_genres() -> list[str]:
    source = (ROOT / "canonical-genres.js").read_text(encoding="utf-8")
    block = re.search(r"const genres = Object\.freeze\(\[(.*?)\]\);", source, re.S)
    if not block:
        raise ValueError("Could not read the canonical genre list")
    genres = re.findall(r'^\s*"([^"]+)"\s*,?\s*$', block.group(1), re.M)
    if len(genres) != 10 or len(set(genres)) != 10:
        raise ValueError("Expected exactly 10 unique canonical genres")
    return genres


def palette() -> dict[str, str]:
    source = (ROOT / "style.css").read_text(encoding="utf-8")
    match = re.search(r":root\s*\{(?P<vars>[^}]+)\}", source)
    if not match:
        raise ValueError("Could not locate the website root palette")
    variables = dict(re.findall(r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", match.group("vars")))
    missing = [key for key in PALETTE_KEYS if key not in variables]
    if missing:
        raise ValueError(f"Website palette is missing: {', '.join(missing)}")
    return {key: variables[key].lower() for key in PALETTE_KEYS}


def slug(genre: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", genre.lower()).strip("-")


def render_card(genre: str, colors: dict[str, str]) -> bytes:
    image = Image.new("RGB", SIZE, colors["--bg"])
    draw = ImageDraw.Draw(image)
    # Pillow's pinned, bundled default font is used; no file or external font is loaded.
    font_brand = ImageFont.load_default(size=30)
    font_small = ImageFont.load_default(size=24)
    font_main = ImageFont.load_default(size=88)
    font_genre = ImageFont.load_default(size=38)

    # Framed editorial card and original geometric motif.
    draw.rounded_rectangle((42, 42, 1038, 1038), radius=52, fill=colors["--panel"], outline=colors["--line"], width=3)
    draw.rounded_rectangle((78, 78, 1002, 1002), radius=36, outline=colors["--line"], width=2)
    draw.rounded_rectangle((112, 112, 968, 224), radius=30, fill=colors["--text"])
    draw.ellipse((840, 127, 895, 182), fill=colors["--accent"])
    draw.ellipse((909, 127, 937, 155), fill=colors["--accent-deep"])
    draw.ellipse((909, 166, 937, 194), fill=colors["--accent"])
    draw.text((151, 145), "PODCASTLISTEN.DK", font=font_brand, fill=colors["--panel"])
    draw.text((151, 183), "PODCASTGUIDEN", font=font_small, fill=colors["--line"])

    # Accent rule and decorative bars are original vector shapes, not audio artwork.
    draw.rounded_rectangle((145, 294, 230, 308), radius=7, fill=colors["--accent"])
    draw.text((145, 350), "Podcastlisten", font=font_main, fill=colors["--text"])
    draw.text((145, 460), "anbefaler", font=font_main, fill=colors["--accent-deep"])
    draw.text((150, 604), "NYE PODCASTER", font=font_small, fill=colors["--muted"])

    # Ten genre cards share the same layout and site palette; only this label varies.
    draw.rounded_rectangle((142, 680, 938, 814), radius=34, fill=colors["--accent-soft"])
    genre_font = font_genre
    while draw.textbbox((0, 0), genre, font=genre_font)[2] > 716 and getattr(genre_font, "size", 38) > 24:
        genre_font = ImageFont.load_default(size=genre_font.size - 2)
    bounds = draw.textbbox((0, 0), genre, font=genre_font)
    text_width = bounds[2] - bounds[0]
    draw.text((540 - text_width / 2, 719), genre, font=genre_font, fill=colors["--text"])

    # Footer: own text and simple line work only.
    draw.line((150, 876, 930, 876), fill=colors["--line"], width=3)
    draw.text((150, 915), "PODCASTANMELDELSER · NYE LYDUNIVERSER", font=font_small, fill=colors["--muted"])
    draw.rounded_rectangle((875, 918, 929, 972), radius=16, fill=colors["--accent"])
    draw.line((891, 946, 913, 946), fill=colors["--panel"], width=4)
    draw.line((902, 935, 902, 957), fill=colors["--panel"], width=4)

    return encode_indexed_png(image)


def expected_artifacts() -> tuple[dict[str, bytes], dict]:
    colors = palette()
    genres = canonical_genres()
    generator_bytes = Path(__file__).read_bytes()
    style_bytes = (ROOT / "style.css").read_bytes()
    genre_bytes = (ROOT / "canonical-genres.js").read_bytes()
    entries = []
    artifacts: dict[str, bytes] = {}
    for genre in genres:
        relative = f"assets/instagram/original-cards/{slug(genre)}.png"
        image_bytes = render_card(genre, colors)
        artifacts[relative] = image_bytes
        entries.append({
            "genre": genre,
            "path": relative,
            "format": FORMAT,
            "contentType": CONTENT_TYPE,
            "width": SIZE[0],
            "height": SIZE[1],
            "bytes": len(image_bytes),
            "sha256": sha256(image_bytes),
            "sourceKind": "original_podcastlisten_graphic",
            "sourceSha256": sha256(generator_bytes + style_bytes + genre_bytes),
            "thirdPartyMaterials": False,
        })
    manifest = {
        "schemaVersion": 1,
        "generator": "scripts/generate-instagram-cards.py",
        "generatorSha256": sha256(generator_bytes),
        "paletteSource": {"file": "style.css", "variables": list(PALETTE_KEYS), "values": colors},
        "genreSource": {"file": "canonical-genres.js", "count": len(genres)},
        "renderer": "Pillow 12.2.0 ImageFont.load_default(); 16-color indexed PNG with deterministic stored DEFLATE; no external fonts or images",
        "width": SIZE[0],
        "height": SIZE[1],
        "format": FORMAT,
        "contentType": CONTENT_TYPE,
        "assets": entries,
    }
    return artifacts, manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify committed outputs without writing files")
    args = parser.parse_args()
    artifacts, manifest = expected_artifacts()
    expected_manifest = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    changed = []
    for relative, data in artifacts.items():
        target = ROOT / relative
        if not target.exists() or target.read_bytes() != data:
            changed.append(relative)
            if not args.check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
    if not MANIFEST.exists() or MANIFEST.read_bytes() != expected_manifest:
        changed.append("assets/instagram/manifest.json")
        if not args.check:
            MANIFEST.parent.mkdir(parents=True, exist_ok=True)
            MANIFEST.write_bytes(expected_manifest)
    if args.check and changed:
        print("Instagram graphic artifacts do not match their source: " + ", ".join(changed), file=sys.stderr)
        return 1
    print(f"Instagram graphics {'verified' if args.check else 'generated'}: {len(artifacts)} exact 1080x1080 PNG files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
