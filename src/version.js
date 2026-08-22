/**
 * VERSIONES DEL SISTEMA
 * ---------------------
 * Este archivo es la unica fuente de verdad de "que hay de nuevo".
 * La pantalla de Novedades lo lee tal cual, no hay que tocar nada mas.
 *
 * Cada vez que terminemos un pedazo nuevo:
 *   1. Se agrega un objeto arriba del arreglo (el mas nuevo primero)
 *   2. Se actualiza VERSION_ACTUAL
 *   3. Se actualiza "version" en package.json
 *
 * tipo: 'nuevo' | 'mejora' | 'arreglo' | 'importante'
 */

const VERSION_ACTUAL = '0.1';

const VERSIONES = [
  {
    numero: '0.1',
    nombre: 'Cimientos',
    fecha: '2026-08-22',
    resumen:
      'Arranca el sistema: base de datos, migraciones automáticas, respaldos, ' +
      'usuarios con PIN, roles y permisos, y esta misma pantalla de novedades.',
    cambios: [
      { tipo: 'nuevo', texto: 'Servidor local con Express y base de datos SQLite.' },
      { tipo: 'nuevo', texto: 'Migraciones numeradas: la base se actualiza sola al arrancar.' },
      { tipo: 'nuevo', texto: 'Respaldo automático de la base antes de cada actualización.' },
      { tipo: 'nuevo', texto: 'Usuarios y roles: operario, cajero, repartidor y admin.' },
      { tipo: 'nuevo', texto: 'Entrada con PIN de 4 a 6 dígitos y sesión que no se cierra sola.' },
      { tipo: 'nuevo', texto: 'Entrada con usuario y contraseña para el admin.' },
      { tipo: 'nuevo', texto: 'Pantalla de usuarios: alta, edición, cambio de PIN y baja (nadie se borra).' },
      { tipo: 'nuevo', texto: 'Bitácora: cada movimiento guarda quién lo ejecutó y quién lo capturó.' },
      { tipo: 'nuevo', texto: 'Pantalla "Qué hay de nuevo" con el historial de versiones.' },
      { tipo: 'importante', texto: 'Motor de fracciones en dieciseisavos, listo para el punto de venta.' }
    ],
    siguiente: 'v0.2 — Configurador de tanques, paños, canastas y moldes.'
  }
];

module.exports = { VERSION_ACTUAL, VERSIONES };
