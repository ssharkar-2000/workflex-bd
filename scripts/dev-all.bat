@echo off
rem Opens all three servers, each in its own window. Close a window to stop
rem that one; the others keep running.
start "" "%~dp0dev-api.bat"
start "" "%~dp0dev-user-app.bat"
start "" "%~dp0dev-admin.bat"
