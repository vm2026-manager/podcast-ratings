#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from instagram_opskaler_cover import require_exact_rights, render_approved_slot, render_overlay_from_source


class InstagramCoverUpscaleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="instagram-cover-test-")
        self.root = Path(self.temp.name)
        self.source = self.root / "source.png"
        image = Image.new("RGB", (800, 800), "#25384a")
        draw = ImageDraw.Draw(image)
        draw.text((250, 350), "ORIGINAL COVER", fill="#ffffff")
        image.save(self.source, format="PNG")
        self.original = self.source.read_bytes()
        self.source_hash = hashlib.sha256(self.original).hexdigest()
        self.placement = {
            "podcastId": "synthetic-id",
            "sourceChecksum": self.source_hash,
            "approved": True,
            "approvedBy": "test-owner",
            "approvedAt": "2026-11-12T12:00:00Z",
            "contrastMode": "light-on-dark",
            "x": 70,
            "y": 70,
            "notes": "Synthetic fixture only; clear upper-left area.",
        }

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_resizes_a_separate_copy_and_adds_only_required_text(self) -> None:
        output = self.root / "copy.png"
        first = render_overlay_from_source(self.source, output, "8,4", self.placement)
        second_path = self.root / "copy-again.png"
        second = render_overlay_from_source(self.source, second_path, "8,4", self.placement)
        self.assertEqual(self.source.read_bytes(), self.original)
        self.assertEqual(first["sourceSha256"], self.source_hash)
        self.assertEqual(first["outputSha256"], second["outputSha256"], "same inputs render deterministically with pinned Pillow")
        self.assertEqual((first["width"], first["height"], first["format"]), (1080, 1080, "PNG"))
        self.assertEqual(first["resampling"], "Pillow Image.Resampling.LANCZOS")
        self.assertEqual(first["overlay"], ["Podcastlistens vurdering", "8,4", "/10"])
        self.assertFalse(first["extraGraphics"])
        with Image.open(output) as rendered:
            self.assertEqual(rendered.size, (1080, 1080))
            self.assertEqual(rendered.format, "PNG")
            self.assertNotEqual(rendered.getpixel((80, 80)), Image.open(self.source).getpixel((80, 80)))

    def test_bad_aspect_ratio_and_unapproved_placement_block_output(self) -> None:
        non_square = self.root / "non-square.png"
        Image.new("RGB", (800, 600), "#ffffff").save(non_square)
        with self.assertRaisesRegex(ValueError, "square source covers"):
            render_overlay_from_source(non_square, self.root / "no-copy.png", "8,0", self.placement)
        with self.assertRaisesRegex(ValueError, "contrastMode"):
            render_overlay_from_source(self.source, self.root / "no-copy-2.png", "8,0", {**self.placement, "contrastMode": "auto"})
        with self.assertRaisesRegex(ValueError, "Manual overlay position"):
            render_overlay_from_source(self.source, self.root / "no-copy-3.png", "8,0", {**self.placement, "x": -1})
        self.assertFalse((self.root / "no-copy.png").exists())

    def test_rights_require_exact_id_source_and_documented_checksum(self) -> None:
        cover = {
            "appPodcastKey": "synthetic-id", "title": "Synthetic", "status": "success", "sourceAuditStatus": "valid",
            "sourceChecksum": self.source_hash, "successfulSourceChecksum": self.source_hash,
            "original": {"checksum": self.source_hash}, "variants": {"800": {"checksum": "a" * 64}},
        }
        manifest = {"podcasts": [cover]}
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            require_exact_rights("synthetic-id", self.source_hash, manifest, {"approvals": []})
        bad_approval = {"approvals": [{"podcastId": "other-id", "status": "approved", "approvedBy": "Owner",
            "approvedAt": "2026-11-12", "evidenceUrl": "https://example.com/rights", "coverChecksum": "a" * 64}]}
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            require_exact_rights("synthetic-id", self.source_hash, manifest, bad_approval)
        mismatched = {"approvals": [{"podcastId": "synthetic-id", "status": "approved", "approvedBy": "Owner",
            "approvedAt": "2026-11-12", "evidenceUrl": "https://example.com/rights", "coverChecksum": "b" * 64}]}
        with self.assertRaisesRegex(ValueError, "does not match"):
            require_exact_rights("synthetic-id", self.source_hash, manifest, mismatched)
        exact_fixture_approval = {"approvals": [{"podcastId": "synthetic-id", "status": "approved", "approvedBy": "Owner",
            "approvedAt": "2026-11-12", "evidenceUrl": "https://example.com/rights", "coverChecksum": "a" * 64}]}
        self.assertIs(require_exact_rights("synthetic-id", self.source_hash, manifest, exact_fixture_approval), cover)

    def test_real_candidates_remain_blocked_when_production_rights_are_empty(self) -> None:
        import json
        production_root = Path(__file__).resolve().parents[1]
        plan = {"posts": [{"podcastId": "elizabeth holmes", "cover": {"sourceChecksum": "f352d50a4962373c24ca9866fbe4b7102980408ec4712baf0002be83e197d456",
            "placement": {"approved": False}}}]}
        output = self.root / "should-not-exist.png"
        with self.assertRaisesRegex(ValueError, "Manual overlay placement must be approved"):
            render_approved_slot(production_root, plan, "elizabeth holmes", output)
        rights = json.loads((production_root / "config/instagram-cover-rights.json").read_text(encoding="utf-8"))
        self.assertEqual(rights["approvals"], [])
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
