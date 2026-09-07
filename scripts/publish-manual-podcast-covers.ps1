[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repoRoot 'data\podcast-cover-manifest.json'
$pathList = Join-Path $env:TEMP ("podcast-manual-cover-paths-{0}.txt" -f [guid]::NewGuid())

function Invoke-Git {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') fejlede med exit-kode $LASTEXITCODE."
    }
}

try {
    Set-Location $repoRoot
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw 'Covermanifest mangler; intet kan publiceres.'
    }

    $branch = (& git branch --show-current).Trim()
    if ($branch -ne 'main') {
        throw "Sikker publicering kræver checkout på main (aktuel branch: '$branch'). Ingen filer blev staged."
    }

    $python = (Get-Command python -ErrorAction Stop).Source
    $pythonCode = @'
import json
import sys
from pathlib import Path

root = Path.cwd()
manifest = json.loads((root / 'data/podcast-cover-manifest.json').read_text(encoding='utf-8'))
paths = {'data/podcast-cover-manifest.json'}
ids = []
for entry in manifest.get('podcasts', []):
    if entry.get('manualOverride') is not True or entry.get('sourceKind') != 'manual':
        continue
    required = [entry.get('manualSourcePath'), (entry.get('original') or {}).get('path')]
    required.extend(item.get('path') for item in (entry.get('variants') or {}).values())
    if not all(required) or any(not (root / path).is_file() for path in required):
        raise SystemExit(f"Manual-cover entry is incomplete: {entry.get('title') or entry.get('stableKey')}")
    paths.update(required)
    ids.append(str(entry.get('appPodcastKey') or entry.get('title') or entry.get('stableKey')))
if not ids:
    raise SystemExit('No complete manual covers are registered in the manifest.')
for path in sorted(paths):
    sys.stdout.buffer.write(path.encode('utf-8') + b'\0')
'@
    $process = Start-Process -FilePath $python -ArgumentList @('-c', $pythonCode) -RedirectStandardOutput $pathList -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $pathList) -or (Get-Item -LiteralPath $pathList).Length -eq 0) {
        throw 'Kunne ikke udlede den validerede manuel-cover-batch.'
    }

    $paths = [System.IO.File]::ReadAllBytes($pathList)
    $allowed = @{}
    ([System.Text.Encoding]::UTF8.GetString($paths) -split "`0") | Where-Object { $_ } | ForEach-Object { $allowed[$_] = $true }
    $status = & git status --porcelain=v1 --untracked-files=all
    foreach ($line in $status) {
        $path = $line.Substring(3).Replace('\', '/')
        if ($path.Contains(' -> ')) { throw "Renames skal håndteres manuelt før publicering: $path" }
        if (-not $allowed.ContainsKey($path)) {
            throw "Urelateret lokal ændring blokerer sikker publicering: $path"
        }
    }

    Invoke-Git @('fetch', 'origin', 'main')
    Invoke-Git @('add', "--pathspec-from-file=$pathList", '--pathspec-file-nul')
    if (-not (& git diff --cached --quiet)) {
        Invoke-Git @('commit', '-m', 'publish manual podcast covers')
    } else {
        Write-Host 'Ingen nye manuelle coverændringer at publicere.'
        exit 0
    }
    Invoke-Git @('rebase', 'origin/main')
    Invoke-Git @('push', 'origin', 'HEAD:main')
    Write-Host 'Manuelle covers er publiceret til origin/main.'
}
finally {
    if (Test-Path -LiteralPath $pathList) { Remove-Item -LiteralPath $pathList -Force }
}
