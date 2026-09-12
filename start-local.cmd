@echo off
setlocal
cd /d "%~dp0"
set "SITE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if exist "%SITE_NODE%\node.exe" set "PATH=%SITE_NODE%;%PATH%"
set "ASTRO_TELEMETRY_DISABLED=1"
if not exist "node_modules\astro\bin\astro.mjs" (
  echo Installing site dependencies...
  call npm install
  if errorlevel 1 goto failed
)
echo Open http://127.0.0.1:4321 in your browser.
node node_modules\astro\bin\astro.mjs dev --background --host 127.0.0.1 --port 4321 --open
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Use Node.js 22.12 or newer and try again.
pause
exit /b 1
