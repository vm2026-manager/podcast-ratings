#!/usr/bin/env python3
"""Generate the fixed first-party Instagram Buffer smoke-test image."""
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
OUT = ROOT / "assets" / "instagram" / "smoke-test.png"
MANIFEST = ROOT / "assets" / "instagram" / "smoke-test-manifest.json"
SIZE = (1080, 1080)
PALETTE_KEYS = ("--bg", "--panel", "--text", "--muted", "--line", "--accent", "--accent-deep")


def normalized_source(path: Path) -> bytes:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n").encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def css_palette() -> dict[str, str]:
    source = normalized_source(ROOT / "style.css").decode("utf-8")
    root = re.search(r":root\s*\{(?P<vars>[^}]+)\}", source)
    if not root:
        raise ValueError("Could not locate Podcastlisten's root palette")
    variables = dict(re.findall(r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", root.group("vars")))
    if any(key not in variables for key in PALETTE_KEYS):
        raise ValueError("Podcastlisten palette is missing a required color")
    return {key: variables[key].lower() for key in PALETTE_KEYS}


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def deterministic_png(image: Image.Image) -> bytes:
    """Encode a palette PNG with stored DEFLATE blocks, independent of zlib versions."""
    indexed = image.quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    width, height = indexed.size
    palette = indexed.getpalette()[:48]
    palette += [0] * (48 - len(palette))
    pixels = indexed.load()
    scanlines = bytearray()
    for y in range(height):
        scanlines.append(0)
        for x in range(0, width, 2):
            left = pixels[x, y]
            right = pixels[x + 1, y] if x + 1 < width else 0
            if left > 15 or right > 15:
                raise ValueError("Smoke-test artwork exceeded the 16-color palette")
            scanlines.append((left << 4) | right)

    stream = bytearray(b"\x78\x01")
    for offset in range(0, len(scanlines), 65535):
        block_data = scanlines[offset:offset + 65535]
        stream.append(1 if offset + len(block_data) == len(scanlines) else 0)
        stream.extend(struct.pack("<HH", len(block_data), 0xFFFF ^ len(block_data)))
        stream.extend(block_data)
    stream.extend(struct.pack(">I", zlib.adler32(scanlines) & 0xFFFFFFFF))

    header = struct.pack(">IIBBBBB", width, height, 4, 3, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"PLTE", bytes(palette)) + chunk(b"IDAT", bytes(stream)) + chunk(b"IEND", b"")


def render() -> bytes:
    colors = css_palette()
    image = Image.new("RGB", SIZE, colors["--bg"])
    draw = ImageDraw.Draw(image)
    font_brand = ImageFont.load_default(size=30)
    font_title = ImageFont.load_default(size=58)
    font_subtitle = ImageFont.load_default(size=34)
    font_footer = ImageFont.load_default(size=24)

    # First-party geometric test slate; no podcast art, external fonts, or images.
    draw.rounded_rectangle((48, 48, 1032, 1032), radius=42, fill=colors["--panel"], outline=colors["--line"], width=4)
    draw.rounded_rectangle((92, 92, 988, 210), radius=28, fill=colors["--text"])
    draw.text((138, 132), "PODCASTLISTEN.DK", font=font_brand, fill=colors["--panel"])
    draw.ellipse((858, 123, 906, 171), fill=colors["--accent"])
    draw.ellipse((924, 123, 956, 155), fill=colors["--accent-deep"])
    draw.ellipse((924, 163, 956, 195), fill=colors["--accent"])

    draw.rounded_rectangle((144, 318, 936, 330), radius=6, fill=colors["--accent"])
    line = "TEKNISK TEST"
    y = 406
    bounds = draw.textbbox((0, 0), line, font=font_title)
    draw.text(((SIZE[0] - (bounds[2] - bounds[0])) / 2, y), line, font=font_title, fill=colors["--text"])

    # Pillow's bundled bitmap font has no en-dash glyph, so draw that own shape.
    line = "IKKE TIL PUBLICERING"
    y = 500
    bounds = draw.textbbox((0, 0), line, font=font_title)
    dash_width, gap = 38, 18
    text_width = bounds[2] - bounds[0]
    start_x = (SIZE[0] - (dash_width + gap + text_width)) / 2
    dash_y = y + (bounds[1] + bounds[3]) / 2
    draw.line((start_x, dash_y, start_x + dash_width, dash_y), fill=colors["--text"], width=6)
    draw.text((start_x + dash_width + gap, y), line, font=font_title, fill=colors["--text"])

    draw.rounded_rectangle((160, 656, 920, 772), radius=30, fill=colors["--bg"], outline=colors["--line"], width=3)
    subline = "BUFFER-FORBINDELSESTEST"
    bounds = draw.textbbox((0, 0), subline, font=font_subtitle)
    draw.text(((SIZE[0] - (bounds[2] - bounds[0])) / 2, 695), subline, font=font_subtitle, fill=colors["--accent-deep"])

    draw.line((146, 862, 934, 862), fill=colors["--line"], width=3)
    footer = "KUN PRIVAT KLADDE · IKKE PUBLICERET"
    bounds = draw.textbbox((0, 0), footer, font=font_footer)
    draw.text(((SIZE[0] - (bounds[2] - bounds[0])) / 2, 900), footer, font=font_footer, fill=colors["--muted"])
    return deterministic_png(image)


def expected() -> tuple[bytes, bytes]:
    data = render()
    generator = normalized_source(Path(__file__))
    style = normalized_source(ROOT / "style.css")
    manifest = {
        "schemaVersion": 1,
        "purpose": "one private, non-publishable Buffer Instagram integration smoke test",
        "sourceKind": "original_podcastlisten_test_graphic",
        "origin": "Podcastlisten-owned text, geometric shapes, and palette from style.css",
        "thirdPartyMaterials": False,
        "generator": "scripts/generate-instagram-smoke-test.py",
        "generatorSha256": sha256(generator),
        "paletteSource": {"file": "style.css", "variables": list(PALETTE_KEYS), "values": css_palette()},
        "renderer": "Pillow 12.2.0 ImageFont.load_default(); deterministic 16-color PNG encoder; no external fonts or images",
        "width": SIZE[0],
        "height": SIZE[1],
        "format": "PNG",
        "contentType": "image/png",
        "bytes": len(data),
        "sha256": sha256(data),
        "sourceSha256": sha256(generator + style),
    }
    return data, (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    image_data, manifest_data = expected()
    changed = []
    for target, content in ((OUT, image_data), (MANIFEST, manifest_data)):
        if not target.exists() or target.read_bytes() != content:
            changed.append(target.relative_to(ROOT).as_posix())
            if not args.check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)
    if args.check and changed:
        print("Instagram smoke-test artifacts do not match source: " + ", ".join(changed), file=sys.stderr)
        return 1
    print(f"Instagram smoke-test image {'verified' if args.check else 'generated'}: 1080x1080 PNG, {len(image_data)} bytes, SHA-256 {sha256(image_data)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
