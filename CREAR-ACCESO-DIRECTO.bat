@echo off
chcp 65001 >nul
title Crear acceso directo en el escritorio
cd /d "%~dp0"

echo.
echo   Creando el icono en el escritorio...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\crear-acceso-directo.ps1"

pause
