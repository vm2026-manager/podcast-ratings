#!/usr/bin/env python3
"""Deterministic, non-generative Instagram cover work-copy renderer.

The original cover is only resized with Pillow LANCZOS. Rendering is blocked
unless the exact Podcast-ID and original source checksum have documented reuse
rights plus a manually approved overlay placement. Output stays local; this
script does not publish or upload files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CANVAS = (1080, 1080)
YELLOW = "#FFD400"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def render_overlay_from_source(source: Path, destination: Path, score: str, placement: dict) -> dict:
    source_bytes = source.read_bytes()
    source_hash = sha256(source_bytes)
    with Image.open(source) as opened:
        opened.load()
        if opened.width != opened.height or opened.width < 600:
            raise ValueError("Only square source covers at least 600x600 are eligible for this work-copy pipeline")
        icc_profile = opened.info.get("icc_profile")
        image = opened.convert("RGB")
    image = image.resize(CANVAS, Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    contrast = placement.get("contrastMode")
    if contrast not in {"light-on-dark", "dark-on-light"}:
        raise ValueError("Manual placement must include an approved contrastMode")
    x, y = placement.get("x"), placement.get("y")
    if not isinstance(x, int) or not isinstance(y, int) or x < 0 or y < 0 or x >= CANVAS[0] or y >= CANVAS[1]:
        raise ValueError("Manual overlay position must start inside the 1080x1080 canvas")
    title_color = "#FFFFFF" if contrast == "light-on-dark" else "#17120E"
    outline_color = "#17120E" if contrast == "light-on-dark" else "#FFFFFF"
    title_font = ImageFont.load_default(size=44)
    score_font = ImageFont.load_default(size=220)
    denominator_font = ImageFont.load_default(size=84)
    stroke = 5

    title = "Podcastlistens vurdering"
    score_text = str(score).strip()
    if not score_text or any(char not in "0123456789,." for char in score_text):
        raise ValueError("Editorial score must be passed as a numeric catalogue value")
    title_bounds = draw.textbbox((x, y), title, font=title_font, stroke_width=stroke)
    score_y = title_bounds[3] + 22
    score_bounds = draw.textbbox((x, score_y), score_text, font=score_font, stroke_width=stroke)
    denominator_x = score_bounds[2] + 14
    denominator_y = score_bounds[3] - 94
    denominator_bounds = draw.textbbox((denominator_x, denominator_y), "/10", font=denominator_font, stroke_width=stroke)
    if max(title_bounds[2], score_bounds[2], denominator_bounds[2]) > CANVAS[0] or denominator_bounds[3] > CANVAS[1]:
        raise ValueError("Manual overlay placement does not fit; choose another position or smaller explicit font sizes")

    draw.text((x, y), title, font=title_font, fill=title_color, stroke_width=stroke, stroke_fill=outline_color)
    draw.text((x, score_y), score_text, font=score_font, fill=YELLOW, stroke_width=stroke, stroke_fill=outline_color)
    draw.text((denominator_x, denominator_y), "/10", font=denominator_font, fill=title_color, stroke_width=stroke, stroke_fill=outline_color)
    destination.parent.mkdir(parents=True, exist_ok=True)
    save_options = {"format": "PNG", "optimize": False}
    if icc_profile:
        save_options["icc_profile"] = icc_profile
    image.save(destination, **save_options)
    output_bytes = destination.read_bytes()
    with Image.open(destination) as check:
        check.verify()
    return {
        "sourceSha256": source_hash,
        "outputSha256": sha256(output_bytes),
        "outputBytes": len(output_bytes),
        "width": CANVAS[0],
        "height": CANVAS[1],
        "format": "PNG",
        "resampling": "Pillow Image.Resampling.LANCZOS",
        "sourceICCProfileSha256": sha256(icc_profile) if icc_profile else None,
        "overlay": ["Podcastlistens vurdering", score_text, "/10"],
        "extraGraphics": False,
    }


def require_exact_rights(podcast_id: str, source_checksum: str, source_manifest: dict, rights: dict) -> dict:
    covers = [entry for entry in source_manifest.get("podcasts", []) if entry.get("appPodcastKey") == podcast_id]
    if len(covers) != 1:
        raise ValueError("Podcast-ID must match exactly one verified source cover")
    cover = covers[0]
    if cover.get("sourceAuditStatus") != "valid" or cover.get("status") != "success" or cover.get("sourceChecksum") != source_checksum or \
            cover.get("successfulSourceChecksum") != source_checksum or cover.get("original", {}).get("checksum") != source_checksum:
        raise ValueError("Original cover source identity or checksum is not verified")
    matches = [entry for entry in rights.get("approvals", []) if entry.get("podcastId") == podcast_id]
    if len(matches) != 1:
        raise ValueError("Documented reuse-right approval is missing or ambiguous; rendering is blocked")
    approval = matches[0]
    variant_checksum = cover.get("variants", {}).get("800", {}).get("checksum")
    if approval.get("status") != "approved" or not approval.get("approvedBy") or not approval.get("approvedAt") or \
            not str(approval.get("evidenceUrl", "")).startswith("https://") or approval.get("coverChecksum") != variant_checksum:
        raise ValueError("Cover reuse-right evidence does not match the exact approved cover checksum")
    return cover


def render_approved_slot(root: Path, plan: dict, podcast_id: str, destination: Path) -> dict:
    slots = [slot for slot in plan.get("posts", []) if slot.get("podcastId") == podcast_id]
    if len(slots) != 1:
        raise ValueError("Plan must contain exactly one slot for the requested Podcast-ID")
    slot = slots[0]
    source_checksum = slot.get("cover", {}).get("sourceChecksum")
    placement = slot.get("cover", {}).get("placement")
    if not isinstance(placement, dict) or placement.get("approved") is not True or placement.get("podcastId") != podcast_id or \
            placement.get("sourceChecksum") != source_checksum or not placement.get("approvedBy") or not placement.get("approvedAt") or \
            not placement.get("notes"):
        raise ValueError("Manual overlay placement must be approved for this exact Podcast-ID and source checksum")

    source_manifest = json.loads((root / "data/podcast-cover-manifest.json").read_text(encoding="utf-8"))
    rights = json.loads((root / "config/instagram-cover-rights.json").read_text(encoding="utf-8"))
    cover = require_exact_rights(podcast_id, source_checksum, source_manifest, rights)
    if cover.get("qualityCategory") not in {"A", "B"}:
        quality = slot.get("cover", {}).get("qualityReview", {})
        if quality.get("approved") is not True or quality.get("podcastId") != podcast_id or quality.get("sourceChecksum") != source_checksum or \
                not quality.get("approvedBy") or not quality.get("approvedAt") or not quality.get("notes"):
            raise ValueError("Manual image-quality approval must match the exact Podcast-ID and original checksum")
    source = root / cover["original"]["path"]
    source_bytes = source.read_bytes()
    if len(source_bytes) != cover["original"]["bytes"] or sha256(source_bytes) != source_checksum:
        raise ValueError("Original cover bytes do not match the verified source checksum")
    identity = [row for row in json.loads((root / "data/podcasts.json").read_text(encoding="utf-8"))["rows"]
                if row.get("Podcast-ID") == podcast_id]
    if len(identity) != 1 or identity[0].get("Titel") != slot.get("title") or identity[0].get("Vuring (1-10)") != slot.get("score", {}).get("display"):
        raise ValueError("Plan title or editorial score no longer matches this exact catalogue identity")
    result = render_overlay_from_source(source, destination, identity[0]["Vuring (1-10)"], placement)
    result.update({"podcastId": podcast_id, "sourcePath": cover["original"]["path"], "outputPath": str(destination)})
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a local, rights-gated original-cover Instagram work copy")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--podcast-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    result = render_approved_slot(ROOT, plan, args.podcast_id, args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
