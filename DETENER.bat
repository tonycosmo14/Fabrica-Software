@echo off
chcp 65001 >nul
title Detener Fabrica de Hielo
cd /d "%~dp0"

echo.
echo   Deteniendo el sistema...
echo.

set ENCONTRADO=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  taskkill /f /pid %%a >nul 2>nul
  set ENCONTRADO=1
)

if "%ENCONTRADO%"=="1" (
  echo   Listo, el sistema se detuvo.
) else (
  echo   El sistema no estaba corriendo.
)

echo.
timeout /t 3 >nul
