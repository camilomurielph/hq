@echo off
title Obsidian HQ Dashboard
echo Iniciando Obsidian HQ en http://localhost:4320 ...
cd /d "%~dp0backend"
start "" "http://localhost:4320"
python -m uvicorn server:app --host 127.0.0.1 --port 4320 --reload
