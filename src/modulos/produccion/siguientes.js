/**
 * QUÉ PAÑO LE TOCA A CADA TANQUE  (v2.4)
 *
 * Vive aparte de las rutas porque lo piden DOS módulos: producción, que lo
 * enseña en pantalla, e impresión, que lo saca por la térmica para que el
 * obrero se lo lleve al cuarto de tanques.
 *
 * Se calcula, nunca llega de fuera: un papel que dice qué paño sacar no
 * puede salir de lo que alguien mande en el cuerpo de una petición.
 */
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');
const { tanqueConEstado } = require('./estado');
const { siguientePano } = require('./rotacion');

/** Cuántos números por tanque lleva el papel: la jornada del obrero. */
const CUANTOS = 6;

function numerosASacar(entregadoPor = '') {
  const tanques = bd.prepare(
    'SELECT id, nombre FROM tanques WHERE activo = 1 ORDER BY orden, nombre'
  ).all();

  const lista = tanques.map((t) => {
    const estado = tanqueConEstado(t.id);
    const orden = [];
    let ultimo = estado.ultimo_pano_sacado;

    // Los siguientes de la rotación, no solo el primero: el obrero se lleva
    // una lista para toda su jornada.
    const numeros = estado.panos.map((p) => p.numero);
    const enProceso = estado.panos.filter((p) => p.enProceso).map((p) => p.numero);

    for (let i = 0; i < Math.min(CUANTOS, numeros.length); i++) {
      const n = siguientePano(numeros, ultimo, i === 0 ? enProceso : []);
      if (n == null || orden.includes(n)) break;
      const pano = estado.panos.find((p) => p.numero === n);
      orden.push(n);
      if (!(i === 0 && enProceso.length)) ultimo = n;
      if (!pano) break;
    }

    return {
      tanque: t.nombre,
      siguientes: orden,
      enProceso,
      horasConfiguradas: estado.horas_congelacion
    };
  });

  return { fecha: ahora(), lista, entregadoPor };
}

module.exports = { numerosASacar };
