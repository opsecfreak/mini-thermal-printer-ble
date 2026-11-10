@echo off
setlocal
title mini-thermal-printer-ble launcher
rem Starts the local server on 127.0.0.1 and opens the app in Chrome (separate profile).
rem   start.bat         opens the printer app
rem   start.bat probe   opens the diagnostics probe

set "APPDIR=%~dp0"
set "PORT=8384"
set "URL=http://127.0.0.1:%PORT%/"
if /i "%~1"=="probe" set "URL=http://127.0.0.1:%PORT%/probe/"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required: https://nodejs.org
  pause
  exit /b 1
)

curl.exe -s -o nul --max-time 2 http://127.0.0.1:%PORT%/api/ping
if errorlevel 1 (
  echo Starting local server on port %PORT% ...
  start "mini-thermal-printer-ble server - close this window to stop" /min node "%APPDIR%serve.mjs"
  timeout /t 2 /nobreak >nul
) else (
  echo Server already running on port %PORT%.
)

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Chrome not found. Open %URL% in Chrome or Edge.
  pause
  exit /b 0
)

start "" "%CHROME%" --user-data-dir="%LocalAppData%\mini-thermal-printer-ble\chrome-profile" --no-first-run --no-default-browser-check --new-window "%URL%"
endlocal
