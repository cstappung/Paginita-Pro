@echo off
rem =====================================================
rem  ColabTeX - vista previa local (produccion: GitHub Pages)
rem =====================================================
cd /d "%~dp0colabtex"
start "ColabTeX vista previa" node server\static.js
timeout /t 2 >nul
start "" http://localhost:8123/Inicio.dc.html
