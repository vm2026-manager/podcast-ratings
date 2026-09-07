@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Administrator\Documents\GitHub\podcast-ratings\sync-all-local.ps1"
if errorlevel 1 pause
if errorlevel 1 exit /b %errorlevel%

set /p PUBLISH_MANUAL_COVERS="Publish confirmed manual covers to origin/main now? [y/N]: "
if /I "%PUBLISH_MANUAL_COVERS%"=="Y" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Administrator\Documents\GitHub\podcast-ratings\scripts\publish-manual-podcast-covers.ps1"
  if errorlevel 1 pause
)
