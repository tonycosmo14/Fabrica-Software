@echo off
chcp 65001 >nul
title Hielo LOLHA - Recuperar el acceso
cd /d "%~dp0"

echo.
echo   ===============================================
echo      RECUPERAR EL ACCESO
echo   ===============================================
echo.
echo   Usa esto solo si el administrador olvido su PIN
echo   y su contrasena y ya no puede entrar.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   No encuentro Node.js instalado.
  pause
  exit /b
)

node src\recuperar.js

echo.
pause
