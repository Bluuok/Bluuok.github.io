@echo off
setlocal
cd /d "%~dp0"
set "SITE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if exist "%SITE_NODE%\node.exe" set "PATH=%SITE_NODE%;%PATH%"
set "ASTRO_TELEMETRY_DISABLED=1"
node node_modules\astro\bin\astro.mjs dev stop
if errorlevel 1 pause
