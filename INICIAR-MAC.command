#!/bin/bash
# Doble clic en Mac o Linux para arrancar el sistema.
# (En Mac, la primera vez: clic derecho > Abrir, para saltar el aviso de seguridad.)

cd "$(dirname "$0")" || exit 1

echo ""
echo "  ==============================================="
echo "     FABRICA DE HIELO - iniciando el sistema"
echo "  ==============================================="
echo ""

if ! command -v node > /dev/null 2>&1; then
  echo "  No encuentro Node.js instalado."
  echo "  Descargalo (version LTS) desde https://nodejs.org"
  echo "  y vuelve a dar doble clic aqui."
  echo ""
  read -r -p "  Presiona Enter para cerrar..."
  exit 1
fi

if [ ! -f node_modules/express/package.json ]; then
  echo "  Primera vez en esta computadora."
  echo "  Preparando el sistema, tarda 1 o 2 minutos..."
  echo ""
  npm install || { read -r -p "  Fallo la preparacion. Enter para cerrar..."; exit 1; }
fi

node src/servidor.js --abrir

echo ""
echo "  El sistema se detuvo. Puedes cerrar esta ventana."
read -r -p "  Presiona Enter para cerrar..."
