/**
 * ROTACIÓN INTERCALADA  (sección 6.5 del plan, afinada con la operación real)
 *
 * En la fábrica el hielo NO se saca en orden corrido. Se saca intercalado:
 *
 *      1, 3, 5, 7, 9, 11, 13...   y cuando se acaban los nones:
 *      2, 4, 6, 8, 10, 12, 14...
 *
 * Así, mientras un paño está congelando, el de al lado ya se sacó, y el
 * frío se reparte parejo por el tanque.
 *
 * Esto no es una sugerencia: es la regla. Sacar un paño que no toca requiere
 * autorización de un administrador o un gerente, y queda registrado.
 */

/**
 * Devuelve el orden completo en el que hay que sacar los paños de un tanque.
 * Con 14 paños: [1,3,5,7,9,11,13, 2,4,6,8,10,12,14]
 */
function ordenIntercalado(numeros) {
  const ordenados = [...numeros].sort((a, b) => a - b);
  return [
    ...ordenados.filter((n) => n % 2 === 1),
    ...ordenados.filter((n) => n % 2 === 0)
  ];
}

/**
 * ¿Cuál toca ahora?
 *
 * @param numeros            números de los paños activos del tanque
 * @param ultimoSacado       número del último paño que se sacó (o null)
 * @param enProceso          números de paños empezados y sin terminar
 *
 * Un paño a medias siempre gana: primero se termina lo empezado.
 */
function siguientePano(numeros, ultimoSacado, enProceso = []) {
  if (!numeros.length) return null;

  // Lo empezado se termina antes de abrir otro paño.
  if (enProceso.length) return Math.min(...enProceso);

  const orden = ordenIntercalado(numeros);
  if (ultimoSacado == null) return orden[0];

  const i = orden.indexOf(ultimoSacado);
  if (i === -1) return orden[0];              // ese paño ya no existe
  return orden[(i + 1) % orden.length];        // al llegar al final, vuelve a empezar
}

/**
 * Texto para explicarle al usuario por qué toca ese y no otro.
 */
function explicar(numeros, ultimoSacado, enProceso = []) {
  if (enProceso.length) {
    const n = Math.min(...enProceso);
    return `El paño ${n} quedó a medias. Primero hay que terminarlo.`;
  }
  if (ultimoSacado == null) return 'Es el primero de la rotación.';

  const siguiente = siguientePano(numeros, ultimoSacado);
  const orden = ordenIntercalado(numeros);
  if (siguiente === orden[0] && ultimoSacado === orden[orden.length - 1]) {
    return 'Se completó la vuelta: la rotación empieza otra vez.';
  }
  return `El último que se sacó fue el ${ultimoSacado}.`;
}

module.exports = { ordenIntercalado, siguientePano, explicar };
