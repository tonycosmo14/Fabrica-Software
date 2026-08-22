@echo off
chcp 65001 >nul
title Actualizar Fabrica de Hielo
cd /d "%~dp0"

echo.
echo   ===============================================
echo      Buscando la version mas nueva
echo   ===============================================
echo.

if not exist ".git\" (
  echo   Esta carpeta se bajo como ZIP, no con Git, asi que no
  echo   se puede actualizar sola.
  echo.
  echo   Baja el ZIP nuevo desde GitHub y copia la carpeta "datos"
  echo   de aqui a la carpeta nueva para no perder tus registros.
  echo.
  pause
  exit /b
)

where git >nul 2>nul
if errorlevel 1 (
  echo   No encuentro Git instalado. Se abrira la pagina de descarga.
  start "" https://git-scm.com/download/win
  pause
  exit /b
)

echo   Descargando cambios...
git pull
if errorlevel 1 (
  echo.
  echo   No se pudo actualizar. Revisa que haya internet.
  pause
  exit /b
)

echo.
echo   Instalando lo que haga falta...
call npm install

echo.
echo   ===============================================
echo      Actualizado. Da doble clic en INICIAR.
echo      Tus datos siguen intactos: la base se
echo      actualiza sola y hace respaldo antes.
echo   ===============================================
echo.
pause
