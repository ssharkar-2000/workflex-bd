@echo off
title WorkFlex - API (port 3000)
rem ---------------------------------------------------------------------------
rem Runs the API server in its own window, independent of any editor
rem or assistant: close this window to stop it, leave it open and it stays up.
rem If Metro crashes or is killed, the loop below brings it straight back.
rem ---------------------------------------------------------------------------
cd /d "%~dp0.."

rem Node and Metro write a lot of temporary files. The C: drive on this machine
rem runs close to full, and Metro dies when it cannot write, so keep them on D:.
set "TEMP=%CD%\.tmp"
set "TMP=%CD%\.tmp"
if not exist "%TEMP%" mkdir "%TEMP%"

rem This machine has 8GB of RAM and runs three dev servers at once. Node will
rem happily grow until the whole system swaps, at which point everything stops
rem responding and the server looks "down". A ceiling makes a runaway build
rem fail fast and restart instead of taking the machine with it.
set "NODE_OPTIONS=--max-old-space-size=1024"

:loop
echo.
echo === starting the API on http://localhost:3000 ===
call npm run dev -w @workflex/api
echo.
echo === the server stopped. Restarting in 3 seconds. Close this window to quit. ===
timeout /t 3 /nobreak >nul
goto loop
