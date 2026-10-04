"""Checksum-bound intake; no filename matching. Default is read-only validation.

--apply prepares VERIFIED registrations for a PR. Exit 2 reports unregistered
files, even when verified files were prepared. Invalid mappings fail the entire
batch before writes. Requires Python/Pillow and Node. Never commits or pushes.
"""
import argparse
from copy import deepcopy
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import struct
import tempfile

ROOT = Path(__file__).resolve().parents[1]
INBOX = 'assets/podcast-covers/manual-inbox/'
REGISTRY = 'data/manual-podcast-cover-registrations.json'
MANIFEST = 'data/podcast-cover-manifest.json'


def digest(content):
    return hashlib.sha256(content).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def safe_path(root, relative, prefix):
    if not isinstance(relative, str) or '\\' in relative:
        raise ValueError(f'Invalid path: {relative!r}')
    path = PurePosixPath(relative)
    if path.is_absolute() or path.as_posix() != relative or '..' in path.parts or ':' in relative or not relative.startswith(prefix):
        raise ValueError(f'Unsafe path: {relative}')
    result = (root / relative).resolve()
    if not result.is_relative_to(root.resolve()) or not result.is_relative_to((root / prefix).resolve()):
        raise ValueError(f'Path escapes cover directory: {relative}')
    return result


def validate(root, rows, manifest, registry):
    if registry.get('schemaVersion') != 1 or not isinstance(registry.get('registrations'), list):
        raise ValueError('Invalid registration schema')
    entries = manifest.get('podcasts')
    if not isinstance(entries, list):
        raise ValueError('Manifest has no podcasts list')
    paths, ids, keys, planned = set(), set(), set(), []
    for reg in registry['registrations']:
        source, pid, key = reg.get('sourcePath'), reg.get('podcastId'), reg.get('stableKey')
        path = safe_path(root, source, INBOX)
        if not isinstance(pid, str) or not pid or not isinstance(key, str) or not re.fullmatch(r'[a-z0-9_-]+', key) or '1400x1400' in key:
            raise ValueError('Exact podcastId and safe stableKey required')
        if source.casefold() in paths or pid in ids or key.replace('-', '_') in keys:
            raise ValueError(f'Duplicate mapping: {source} / {pid}')
        paths.add(source.casefold()); ids.add(pid); keys.add(key.replace('-', '_'))
        matches = [r for r in rows if r.get('Podcast-ID') == pid]
        if len(matches) != 1:
            raise ValueError(f'Expected exactly one catalogue row for {pid!r}; found {len(matches)}')
        row = matches[0]
        if reg.get('verdict') != 'VERIFIED' or not reg.get('evidence'):
            raise ValueError(f'Unverified registration: {source}')
        if reg.get('expectedTitle') != row.get('Titel') or reg.get('expectedPublisher') != row.get('Udgiver'):
            raise ValueError(f'Conflicting title/publisher/ID evidence: {source}')
        if reg.get('expectedImageUrl') != row.get('Billedlink', ''):
            raise ValueError(f'Catalogue image evidence changed: {source}')
        content = path.read_bytes()
        if digest(content) != reg.get('sourceSha256'):
            raise ValueError(f'Source checksum changed; re-review artwork: {source}')
        existing = [e for e in entries if e.get('stableKey') == key or e.get('podcastId') == pid or e.get('Podcast-ID') == pid]
        if len(existing) > 1:
            raise ValueError(f'Duplicate manifest identity: {pid}')
        old = existing[0] if existing else None
        if old and (old.get('stableKey') != key or old.get('podcastId') != pid or old.get('title') != row['Titel'] or old.get('publisher') != row['Udgiver']):
            raise ValueError(f'Conflicting manifest identity: {pid}')
        # Legacy entries require explicit review, never title-based replacement.
        if any(e is not old and (e.get('title') == row['Titel'] or e.get('appPodcastKey') == pid or e.get('manualIntakeSourcePath') == source) for e in entries):
            raise ValueError(f'Existing manifest evidence requires review: {pid}')
        planned.append((reg, row, old, content))
    registered = {r['sourcePath'] for r, _, _, _ in planned}
    unregistered = [p.relative_to(root).as_posix() for p in sorted((root / INBOX).rglob('*')) if p.is_file() and p.relative_to(root).as_posix() not in registered]
    return planned, unregistered


def render_png(content):
    from PIL import Image, ImageCms, ImageOps
    with Image.open(io.BytesIO(content)) as source:
        if getattr(source, 'n_frames', 1) != 1:
            raise ValueError('Animated source requires review')
        image = ImageOps.exif_transpose(source)
        profile_bytes = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes())
        # LittleCMS stamps creation time; fix the ICC header for repeatable builds.
        profile_bytes[24:36] = struct.pack('>6H', 2026, 1, 1, 0, 0, 0)
        srgb = ImageCms.ImageCmsProfile(io.BytesIO(profile_bytes))
        profile = image.info.get('icc_profile')
        rgb = image.convert('RGB')
        if profile:
            rgb = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)), srgb, outputMode='RGB')
        rgb.putalpha(image.convert('RGBA').getchannel('A'))
        # Contain the entire artwork without cropping, stretching or new text.
        fitted = ImageOps.contain(rgb, (1400, 1400), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (1400, 1400), (255, 255, 255, 0))
        canvas.paste(fitted, ((1400-fitted.width)//2, (1400-fitted.height)//2))
        if canvas.getextrema()[3] == (255, 255):
            canvas = canvas.convert('RGB')
        output = io.BytesIO()
        canvas.save(output, format='PNG', icc_profile=srgb.tobytes())
        return output.getvalue()


def totals(entries):
    variants = [v for e in entries for v in (e.get('variants') or {}).values()]
    originals = [e['original'] for e in entries if e.get('original')]
    vb, ob = sum(v.get('bytes', 0) for v in variants), sum(o.get('bytes', 0) for o in originals)
    return dict(totalPodcasts=len(entries), totalLocalCovers=sum(bool(e.get('variants')) for e in entries),
                totalVariants=len(variants), totalOriginals=len(originals), totalVariantFileSizeBytes=vb,
                totalOriginalFileSizeBytes=ob, totalFileSizeBytes=vb+ob,
                placeholderPodcasts=sum(bool(e.get('needsPlaceholder')) for e in entries))


def serialize_manifest(raw, before, after):
    """Preserve untouched entry text, including historical formatting."""
    decoder = json.JSONDecoder()
    position = re.search(r'"podcasts"\s*:\s*\[', raw).end()
    edits = []
    for old, new in zip(before['podcasts'], after['podcasts']):
        position = re.search(r'\S', raw[position:]).start() + position
        if raw[position] == ',':
            position += 1
            position += re.search(r'\S', raw[position:]).start()
        _, end = decoder.raw_decode(raw, position)
        if old != new:
            edits.append((position, end, json.dumps(new, ensure_ascii=False, indent=2).replace('\n', '\n    ')))
        position = end
    additions = after['podcasts'][len(before['podcasts']):]
    if additions:
        text = ',\n    '.join(json.dumps(e, ensure_ascii=False, indent=2).replace('\n', '\n    ') for e in additions)
        edits.append((position, position, (',' if before['podcasts'] else '') + '\n    ' + text))
    for start, end, text in reversed(edits):
        raw = raw[:start] + text + raw[end:]
    for field in (*totals(before['podcasts']), 'variantCounts'):
        if field in before and before[field] != after[field]:
            match = re.search(r'"' + field + r'"\s*:\s*', raw)
            _, end = decoder.raw_decode(raw, match.end())
            text = json.dumps(after[field], ensure_ascii=False, indent=2).replace('\n', '\n  ')
            raw = raw[:match.end()] + text + raw[end:]
    if json.loads(raw) != after:
        raise ValueError('Manifest serialization mismatch')
    return raw


def prepare(root, rows, manifest, registry, apply=False):
    planned, unregistered = validate(root, rows, manifest, registry)
    candidate, outputs, prepared = deepcopy(manifest), {}, []
    for reg, row, old, content in planned:
        key, pid = reg['stableKey'], reg['podcastId']
        filename = key.replace('-', '_')
        master = f'assets/podcast-covers/manual-originals/{filename}.png'
        original, variant = f'data/covers/original/{filename}.png', f'data/covers/1400/{filename}.png'
        prepared.append(dict(sourcePath=reg['sourcePath'], podcastId=pid, output=variant))
        if old and old.get('manualIntakeSourceChecksum') == digest(content) and old.get('manualIntakeSourcePath') == reg['sourcePath']:
            # Verify recorded outputs, not encoder-version-dependent regeneration.
            from PIL import Image, ImageCms
            for relative, checksum in [(master, old.get('sourceChecksum')), (original, old.get('original', {}).get('checksum')), (variant, old.get('variants', {}).get('1400', {}).get('checksum'))]:
                path = safe_path(root, relative, relative.rsplit('/', 1)[0] + '/')
                if not checksum or digest(path.read_bytes()) != checksum:
                    raise ValueError(f'Generated cover checksum mismatch: {relative}')
                with Image.open(path) as image:
                    if image.format != 'PNG' or image.size != (1400, 1400) or 'sRGB' not in ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(image.info.get('icc_profile', b'')))):
                        raise ValueError(f'Invalid generated cover: {relative}')
            if old.get('manualSourcePath') != master or old.get('original', {}).get('path') != original or old.get('variants', {}).get('1400', {}).get('path') != variant:
                raise ValueError(f'Generated cover path mismatch: {pid}')
            continue
        png = render_png(content)
        from PIL import Image
        with Image.open(io.BytesIO(png)) as image:
            transparent = image.mode == 'RGBA'
        meta = dict(format='PNG', contentType='image/png', bytes=len(png), checksum=digest(png), width=1400, height=1400, hasTransparency=transparent)
        entry = deepcopy(old) if old else dict(stableKey=key, podcastId=pid, appPodcastKey=pid, title=row['Titel'], publisher=row['Udgiver'], host=row.get('Vært', ''))
        for field in ('manualSeriesOverride', 'manualSeries', 'manualSeriesSourcePath'):
            entry.pop(field, None)
        entry.update(manualOverride=True, sourceKind='manual', manualSourcePath=master,
                     manualIntakeSourcePath=reg['sourcePath'], manualIntakeSourceChecksum=digest(content),
                     originalImageUrl=master, sourceChecksum=digest(png), successfulSourceChecksum=digest(png),
                     sourceFormat='PNG', sourceWidth=1400, sourceHeight=1400, sourceHasTransparency=transparent,
                     sourceAuditStatus='manual', reusedExistingFiles=False, lastError='', status='manual_override',
                     needsPlaceholder=False, qualityCategory='manual', original=dict(path=original, **meta),
                     variants={'1400': dict(path=variant, **meta, requestedWidth=1400, actualWidth=1400, actualHeight=1400)})
        for relative in (master, original, variant):
            path = safe_path(root, relative, relative.rsplit('/', 1)[0] + '/')
            if path.exists() and (old is None or path.read_bytes() != png):
                raise ValueError(f'Refusing to overwrite unreviewed output: {relative}')
            outputs[relative] = png
        if old is None:
            candidate['podcasts'].append(entry)
        else:
            candidate['podcasts'][manifest['podcasts'].index(old)] = entry
    before, after = totals(manifest['podcasts']), totals(candidate['podcasts'])
    for field in before:
        if field in candidate:
            candidate[field] += after[field] - before[field]
    for width in candidate.get('variantCounts', {}):
        candidate['variantCounts'][width] += sum(width in e.get('variants', {}) for e in candidate['podcasts']) - sum(width in e.get('variants', {}) for e in manifest['podcasts'])
    if apply and prepared:
        serialized = serialize_manifest((root / MANIFEST).read_text(encoding='utf-8'), manifest, candidate)
        # Every identity, input image and output collision is validated first.
        for relative, data in outputs.items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(data)
        if candidate != manifest:
            target = root / MANIFEST
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as handle:
                handle.write(serialized.encode('utf-8'))
                staged = handle.name
            os.replace(staged, target)
    return dict(applied=apply, verified=prepared, unregistered=unregistered)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    if args.apply:
        branch = subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True).strip()
        if not branch or branch in ('main', 'master'):
            raise ValueError('--apply requires a dedicated review branch')
    rows = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/manual-cover-catalogue.mjs'), str(root)], encoding='utf-8'))
    report = prepare(root, rows, load(root / MANIFEST), load(root / REGISTRY), args.apply)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 2 if report['unregistered'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
