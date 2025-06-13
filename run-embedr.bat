@echo off
echo Starting Embedr - AI Powered Arduino IDE...
cd /d "%~dp0"
if exist "dist_electron\win-unpacked\Embedr.exe" (
    start "" "dist_electron\win-unpacked\Embedr.exe"
    echo Embedr has been launched!
) else (
    echo Error: Embedr.exe not found. Please build the application first.
    echo Run: npm run electron:build
)
pause 