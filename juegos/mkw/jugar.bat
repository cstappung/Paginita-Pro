@echo off
rem Lanza el juego en el navegador (solo en esta PC): doble clic en este archivo.
rem Resumen: va a la carpeta del proyecto, abre Chrome en http://127.0.0.1:8140/ y deja corriendo el servidor del
rem juego (web\navegador\servidor.mjs) en esta ventana. Para apagarlo: cerrar esta ventana o Ctrl+C.
cd /d "%~dp0"
title Mario Kart Wii - servidor (cierra esta ventana para apagarlo)
rem (el navegador se abre 2 s después, cuando el servidor ya está escuchando)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:8140/"
node web\navegador\servidor.mjs 8140
pause
