@echo off
chcp 65001 >nul
title Fabrica de Hielo - NO CIERRES ESTA VENTANA
cd /d "%~dp0"
color 1F

echo.
echo   ===============================================
echo      FABRICA DE HIELO - iniciando el sistema
echo   ===============================================
echo.

REM --- 1. Comprobar que Node.js esta instalado ---
where node >nul 2>nul
if errorlevel 1 (
  echo   No encuentro Node.js instalado en esta PC.
  echo.
  echo   Node.js es el motor que ejecuta el sistema. Es gratis
  echo   y solo se instala una vez.
  echo.
  echo   Voy a abrir la pagina de descarga. Baja la version LTS,
  echo   instalala con Siguiente - Siguiente - Terminar, y despues
  echo   vuelve a dar doble clic en INICIAR.
  echo.
  start "" https://nodejs.org
  pause
  exit /b
)

REM --- 2. Preparar las dependencias la primera vez ---
if not exist "node_modules\express\package.json" (
  echo   Primera vez que arranca en esta PC.
  echo   Preparando el sistema, tarda 1 o 2 minutos...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   No se pudo preparar el sistema. Revisa que haya internet
    echo   y vuelve a intentarlo.
    echo.
    pause
    exit /b
  )
  cls
)

REM --- 3. Arrancar. El navegador se abre solo cuando este listo ---
node src\servidor.js --abrir

REM --- 4. Si llega aqui es que el servidor se detuvo ---
echo.
echo   ===============================================
echo      El sistema se detuvo. Ya puedes cerrar
echo      esta ventana.
echo   ===============================================
echo.
pause
