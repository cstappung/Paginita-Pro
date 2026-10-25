@echo off
chcp 65001 >nul
rem (primero que todo: el archivo es UTF-8 y cmd lo lee con la página de códigos activa; cambiarla más abajo lo desfasa)
rem La página de Juegos de Paginita Pro en esta PC, como la verá un amigo: doble clic en este archivo (bitácora §69).
rem
rem Resumen: pregunta cuántas ventanas de Chrome abrir (1 = jugar tú; 2 o 3 = probar la sala en línea: cada ventana
rem es "otro PC" con su propia cuenta) y corre herramientas\experiencia.mjs, que levanta todo en 127.0.0.1 (nada sale
rem de esta PC y nada toca el Firebase real):
rem   - los emuladores de Firebase (cuentas, base de datos y Storage, con las reglas del sitio): un Firebase de mentira;
rem   - las cuentas de mentira: Piloto Uno, Dos y Tres (amigos) e Intruso (no es amigo: a él Mario Kart no le aparece);
rem   - el sitio como GitHub Pages en http://127.0.0.1:8150/juegos.html, con el catálogo de Juegos mostrando SOLO
rem     Mario Kart: «Mario Kart Wii · un jugador» (el menú de inicio JloKart) y la sala en línea (amigos y CPU);
rem   - el Worker de verdad (la lista de amigos, lo privado del juego) en 127.0.0.1:8151;
rem   - Chrome: una ventana por jugador, cada una con su perfil (build\perfiles\jugadorN), lado a lado.
rem En cada ventana: «Iniciar sesión» y elegir una cuenta distinta en la ventanita del emulador.
rem
rem Para apagar: Ctrl+C en esta ventana (guarda lo jugado en build\emuladores\datos) y luego "S" si lo pregunta.
rem Empezar de cero (borra cuentas, salas, partidas y VR de mentira):  jugar.bat limpiar
rem El juego suelto, sin la página (lo de antes, http://127.0.0.1:8140/):  jugar.bat suelto
cd /d "%~dp0"
if /i "%~1"=="suelto" goto suelto
set LIMPIAR=
if /i "%~1"=="limpiar" set LIMPIAR=--limpiar
title Paginita Pro - Juegos (Mario Kart Wii) en esta PC - Ctrl+C para apagar
echo.
echo   Paginita Pro - Juegos, solo Mario Kart Wii, en esta PC
echo   ¿Cuántas ventanas de Chrome?  1 = jugar tú   2 o 3 = probar la sala en línea (cada una es otro PC)
choice /C 123 /T 15 /D 1 /N /M "  Elige 1, 2 o 3 (en 15 s abre 1): "
rem (choice deja en errorlevel el número de la opción elegida: 1, 2 o 3)
set VENTANAS=%errorlevel%
node herramientas\experiencia.mjs --ventanas %VENTANAS% %LIMPIAR%
pause
goto :eof

:suelto
rem El juego solo, con su servidor (web\navegador\servidor.mjs): Chrome se abre 2 s después, cuando ya escucha
title Mario Kart Wii - el juego suelto (cierra esta ventana para apagarlo)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:8140/"
node web\navegador\servidor.mjs 8140
pause
