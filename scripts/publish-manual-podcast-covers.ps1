[CmdletBinding()]
param([switch]$Prepare)

# Audit by default; prepare reviewed covers explicitly. Publication requires a PR.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source
$intakeArgs = @((Join-Path $PSScriptRoot 'intake_manual_podcast_covers.py'), '--root', $repoRoot)
if ($Prepare) { $intakeArgs += '--apply' }
& $python @intakeArgs
if ($LASTEXITCODE -eq 2) {
    throw 'Unregistered inbox files were reported. Only VERIFIED registrations can be prepared. No publication occurred.'
}
if ($LASTEXITCODE -ne 0) { throw 'Manual cover validation failed; no publication occurred.' }
Write-Host 'Intake validated. Review prepared files on a dedicated branch and open a PR. Nothing was pushed.'
