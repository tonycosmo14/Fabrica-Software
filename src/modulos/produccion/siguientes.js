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

    // LAS CANASTAS QUE QUEDARON PENDIENTES.
    //
    // Un paño se puede sacar canasta por canasta —no se saca la siguiente
    // hasta que se gasta la anterior—, y cuando el turno cierra a media
    // faena quedan canastas colgadas. Este papel es el que se le entrega al
    // turno que llega, así que tiene que decirlo con nombre y apellido:
    // qué paño, cuántas canastas faltan y quién empezó. Sin eso, alguien
    // pregunta y otro adivina.
    const aMedias = estado.panos.filter((p) => p.enProceso).map((p) => ({
      pano: p.numero,
      faltan: p.faltan,
      total: p.canastas.length,
      empezadoPor: p.empezadoPor || null,
      empezadoEn: p.empezadoEn || null
    }));

    for (let i = 0; i < Math.min(CUANTOS, numeros.length); i++) {
      const n = siguientePano(numeros, ultimo, i === 0 ? enProceso : []);
      if (n == null || orden.includes(n)) break;
      const pano = estado.panos.find((p) => p.numero === n);
      orden.push(n);

      // AVANZAR O NO AVANZAR LA CUENTA.
      //
      // Si el que va es el que le tocaba a la rotación, se avanza y punto.
      // Si es un paño A MEDIAS que se había sacado FUERA de orden, la
      // secuencia normal se queda donde estaba: ese paño de emergencia no
      // debe descolocar la fila del resto de la jornada.
      //
      // Antes se dejaba quieta la cuenta siempre que hubiera algo a medias,
      // y eso borraba la lista entera: al dar la segunda vuelta salía otra
      // vez el mismo número, se detectaba repetido y el papel se quedaba
      // con un solo paño. El obrero perdía la fila de toda su jornada por
      // una canasta colgada.
      if (n === siguientePano(numeros, ultimo, [])) ultimo = n;

      if (!pano) break;
    }

    return {
      tanque: t.nombre,
      siguientes: orden,
      enProceso,
      aMedias,
      horasConfiguradas: estado.horas_congelacion
    };
  });

  return { fecha: ahora(), lista, entregadoPor };
}

module.exports = { numerosASacar };
