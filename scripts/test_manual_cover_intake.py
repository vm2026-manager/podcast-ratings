import io
import json
from pathlib import Path
import tempfile
import unittest
from copy import deepcopy
from PIL import Image, ImageCms
from intake_manual_podcast_covers import INBOX, MANIFEST, digest, prepare, render_png


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.rows = [{'Podcast-ID': 'sport-id', 'Titel': 'Sport & Perspektiv', 'Udgiver': 'Mediano', 'Billedlink': 'https://example.test/sport.png', 'rating': 8}]
        image = Image.new('RGB', (30, 20), 'red')
        image.putpixel((0, 0), (0, 255, 0))
        data = io.BytesIO(); image.save(data, format='PNG'); self.content = data.getvalue()
        self.source = INBOX + 'mediano jennings.png'
        (self.root / self.source).parent.mkdir(parents=True)
        (self.root / self.source).write_bytes(self.content)
        self.manifest = {'totalPodcasts': 1, 'podcasts': [{'stableKey': 'unrelated', 'title': 'Unrelated', 'podcastId': 'unrelated', 'variants': {}}]}
        (self.root / MANIFEST).parent.mkdir(parents=True)
        (self.root / MANIFEST).write_text(json.dumps(self.manifest), encoding='utf-8')
        self.reg = {'schemaVersion': 1, 'registrations': [dict(sourcePath=self.source, sourceSha256=digest(self.content), podcastId='sport-id', stableKey='sport_manual', expectedTitle='Sport & Perspektiv', expectedPublisher='Mediano', expectedImageUrl='https://example.test/sport.png', verdict='VERIFIED', evidence='Reviewed artwork and catalogue') ]}

    def run_intake(self, apply=True):
        return prepare(self.root, self.rows, self.manifest, self.reg, apply)

    def rejects_without_writes(self, message):
        before = {p.relative_to(self.root): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        with self.assertRaisesRegex(ValueError, message):
            self.run_intake()
        self.assertEqual(before, {p.relative_to(self.root): p.read_bytes() for p in self.root.rglob('*') if p.is_file()})

    def test_verified_id_receives_cover_and_preserves_every_other_record(self):
        rows = deepcopy(self.rows)
        self.run_intake()
        after = json.loads((self.root / MANIFEST).read_text(encoding='utf-8'))
        self.assertEqual(self.rows, rows)
        self.assertEqual(after['podcasts'][0], self.manifest['podcasts'][0])
        self.assertEqual(after['podcasts'][1]['podcastId'], 'sport-id')
        path = after['podcasts'][1]['variants']['1400']['path']
        with Image.open(self.root / path) as image:
            self.assertEqual(image.size, (1400, 1400))
            self.assertEqual(image.format, 'PNG')
            self.assertIn('sRGB', ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(image.info['icc_profile']))))
            self.assertEqual(image.getpixel((700, 0))[3], 0, 'contain adds transparent padding, not cropping')
        self.assertNotIn('1400x1400', Path(path).name)
        self.assertNotIn('-', Path(path).name)
        self.assertEqual((self.root / self.source).read_bytes(), self.content)

    def test_unknown_and_ambiguous_names_are_reported_never_resolved(self):
        for name in ['unknown.png', 'Magasinet Jennings.png', 'Sport & Perspektiv.png', 'sport-perspektiv.png']:
            (self.root / INBOX / name).write_bytes(self.content)
        report = self.run_intake()
        self.assertEqual(len(report['verified']), 1)
        self.assertEqual(len(report['unregistered']), 4)

    def test_no_registration_never_uses_even_an_exact_title_filename(self):
        self.reg['registrations'] = []
        report = self.run_intake()
        self.assertEqual(report['verified'], [])
        self.assertEqual(report['unregistered'], [self.source])
        self.assertEqual(json.loads((self.root / MANIFEST).read_text()), self.manifest)

    def test_duplicate_source(self):
        self.reg['registrations'] *= 2
        self.rejects_without_writes('Duplicate mapping')

    def test_duplicate_id_different_source(self):
        other = deepcopy(self.reg['registrations'][0]); other['sourcePath'] = INBOX + 'another.png'
        self.reg['registrations'].append(other)
        self.rejects_without_writes('Duplicate mapping')

    def test_nonexistent_id(self):
        self.reg['registrations'][0]['podcastId'] = 'unknown'
        self.rejects_without_writes('exactly one catalogue row')

    def test_duplicate_catalogue_row_is_not_deduplicated(self):
        self.rows *= 2
        self.rejects_without_writes('found 2')

    def test_conflicting_title_and_id_cannot_collapse_jennings(self):
        self.rows.append({'Podcast-ID': 'magasinet jennings', 'Titel': 'Magasinet Jennings', 'Udgiver': 'Mediano'})
        self.reg['registrations'][0]['podcastId'] = 'magasinet jennings'
        self.rejects_without_writes('Conflicting title')

    def test_ambiguous_verdict_rejected(self):
        self.reg['registrations'][0]['verdict'] = 'AMBIGUOUS'
        self.rejects_without_writes('Unverified')

    def test_replaced_source_requires_new_review(self):
        (self.root / self.source).write_bytes(b'replaced')
        self.rejects_without_writes('checksum changed')

    def test_path_traversal_rejected(self):
        self.reg['registrations'][0]['sourcePath'] = INBOX + '../other.png'
        self.rejects_without_writes('Unsafe path')

    def test_duplicate_manifest_id(self):
        self.manifest['podcasts'] += [{'podcastId': 'sport-id'}, {'podcastId': 'sport-id'}]
        self.rejects_without_writes('Duplicate manifest')

    def test_legacy_title_entry_requires_review(self):
        self.manifest['podcasts'].append({'title': 'Sport & Perspektiv', 'stableKey': 'old'})
        self.rejects_without_writes('requires review')

    def test_dry_run_is_read_only(self):
        before = (self.root / MANIFEST).read_bytes()
        self.run_intake(False)
        self.assertEqual((self.root / MANIFEST).read_bytes(), before)
        self.assertFalse((self.root / 'data/covers').exists())

    def test_corrupt_published_output_fails(self):
        self.run_intake()
        self.manifest = json.loads((self.root / MANIFEST).read_text())
        (self.root / 'data/covers/1400/sport_manual.png').write_bytes(b'corrupt')
        self.rejects_without_writes('checksum mismatch')

    def test_output_filename_collision_rejected(self):
        self.reg['registrations'][0]['stableKey'] = 'sport-manual'
        other = deepcopy(self.reg['registrations'][0])
        other.update(sourcePath=INBOX+'other.png', podcastId='other-id', stableKey='sport_manual')
        self.reg['registrations'].append(other)
        self.rejects_without_writes('Duplicate mapping')

    def test_empty_manifest_supported(self):
        self.manifest = {'podcasts': []}
        (self.root / MANIFEST).write_text(json.dumps(self.manifest))
        self.run_intake()
        self.assertEqual(len(json.loads((self.root / MANIFEST).read_text())['podcasts']), 1)

    def test_rerun_is_idempotent(self):
        self.run_intake()
        self.manifest = json.loads((self.root / MANIFEST).read_text())
        before = (self.root / MANIFEST).read_bytes()
        self.run_intake()
        self.assertEqual((self.root / MANIFEST).read_bytes(), before)

    def test_invalid_second_image_cannot_partially_apply_first(self):
        other = deepcopy(self.reg['registrations'][0])
        other.update(sourcePath=INBOX+'broken.png', podcastId='broken-id', stableKey='broken', sourceSha256=digest(b'broken'))
        self.rows.append({**self.rows[0], 'Podcast-ID': 'broken-id'})
        (self.root / other['sourcePath']).write_bytes(b'broken')
        self.reg['registrations'].append(other)
        before = (self.root / MANIFEST).read_bytes()
        with self.assertRaises(OSError): self.run_intake()
        self.assertEqual((self.root / MANIFEST).read_bytes(), before)
        self.assertFalse((self.root / 'data/covers').exists())


if __name__ == '__main__':
    unittest.main()
