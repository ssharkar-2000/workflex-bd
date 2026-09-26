@echo off
title WorkFlex - user app (port 8081)
rem ---------------------------------------------------------------------------
rem Runs the user app's dev server in its own window, independent of any editor
rem or assistant: close this window to stop it, leave it open and it stays up.
rem If Metro crashes or is killed, the loop below brings it straight back.
rem ---------------------------------------------------------------------------
cd /d "%~dp0.."

rem Node and Metro write a lot of temporary files. The C: drive on this machine
rem runs close to full, and Metro dies when it cannot write, so keep them on D:.
set "TEMP=%CD%\.tmp"
set "TMP=%CD%\.tmp"
if not exist "%TEMP%" mkdir "%TEMP%"

:loop
echo.
echo === starting the user app on http://localhost:8081 ===
call npm run start:go -w @workflex/mobile
echo.
echo === the server stopped. Restarting in 3 seconds. Close this window to quit. ===
timeout /t 3 /nobreak >nul
goto loop
