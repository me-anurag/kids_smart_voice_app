@echo off
cd /d "%~dp0"
start "Bolo Bolo" /min python -m http.server 8123
timeout /t 2 >nul
start chrome http://localhost:8123
