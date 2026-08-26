/**
 * LEER UN ARCHIVO ZIP  (v2.2)
 *
 * Sin librerías. No es por presumir: el sistema se actualiza en una fábrica
 * sin internet, y una actualización que necesita `npm install` para poder
 * instalarse es una actualización que no se puede instalar.
 *
 * Un ZIP se lee de atrás para adelante, y tiene sentido cuando se piensa
 * para qué se inventó —discos de varios volúmenes—:
 *
 *   1. Al FINAL está el "fin del directorio central" (firma PK\x05\x06),
 *      que dice cuántas entradas hay y dónde empieza el directorio.
 *   2. El DIRECTORIO CENTRAL es la lista: un renglón por archivo, con su
 *      nombre, su tamaño y en qué posición del archivo está.
 *   3. Cada ENTRADA tiene su propia cabecera y, pegados, los bytes
 *      comprimidos con deflate, que es justo lo que sabe `zlib`.
 *
 * Solo se soportan los dos métodos que usa todo el mundo: 0 (guardado tal
 * cual) y 8 (deflate). Nada de cifrado ni de archivos partidos: un ZIP así
 * se rechaza con un mensaje claro en vez de sacar basura.
 */
const zlib = require('node:zlib');

const FIN_DIRECTORIO = 0x06054b50;   // PK\x05\x06
const ENTRADA_DIRECTORIO = 0x02014b50;
const MAX_ARCHIVOS = 5000;

/**
 * Devuelve las entradas del ZIP: [{ nombre, esCarpeta, tamano, leer() }].
 *
 * `leer()` descomprime esa entrada y devuelve sus bytes. Se hace a demanda
 * para no tener el ZIP entero descomprimido en memoria de una vez.
 */
function leerZip(buffer) {
  const fin = buscarFinDelDirectorio(buffer);
  if (!fin) {
    throw new Error('Ese archivo no parece un ZIP (le falta el final del directorio).');
  }

  const cuantas = buffer.readUInt16LE(fin + 10);
  const dondeEmpieza = buffer.readUInt32LE(fin + 16);

  if (cuantas > MAX_ARCHIVOS) {
    throw new Error(`El ZIP trae ${cuantas} archivos, demasiados para una actualización.`);
  }
  if (dondeEmpieza >= buffer.length) {
    throw new Error('El ZIP está incompleto o se copió a medias.');
  }

  const entradas = [];
  let p = dondeEmpieza;

  for (let i = 0; i < cuantas; i++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== ENTRADA_DIRECTORIO) {
      throw new Error('El ZIP está dañado: su lista de archivos no cuadra.');
    }

    const metodo      = buffer.readUInt16LE(p + 10);
    const banderas    = buffer.readUInt16LE(p + 8);
    const comprimido  = buffer.readUInt32LE(p + 20);
    const original    = buffer.readUInt32LE(p + 24);
    const largoNombre = buffer.readUInt16LE(p + 28);
    const largoExtra  = buffer.readUInt16LE(p + 30);
    const largoNota   = buffer.readUInt16LE(p + 32);
    const dondeEstan  = buffer.readUInt32LE(p + 42);

    const nombre = buffer.toString('utf8', p + 46, p + 46 + largoNombre);

    // El bit 0 de las banderas quiere decir "va cifrado". No se soporta, y
    // más vale decirlo que entregar bytes ilegibles.
    if (banderas & 0x01) throw new Error(`"${nombre}" viene con contraseña. No se puede leer.`);

    entradas.push({
      nombre,
      esCarpeta: nombre.endsWith('/'),
      tamano: original,
      leer: () => descomprimir(buffer, dondeEstan, metodo, comprimido, original, nombre)
    });

    p += 46 + largoNombre + largoExtra + largoNota;
  }

  return entradas;
}

/** Saca los bytes de una entrada, saltándose su cabecera local. */
function descomprimir(buffer, donde, metodo, comprimido, original, nombre) {
  if (donde + 30 > buffer.length) throw new Error(`"${nombre}" apunta fuera del archivo.`);

  // La cabecera local repite el nombre y los extras, y sus largos pueden
  // NO coincidir con los del directorio: por eso se leen de aquí.
  const largoNombre = buffer.readUInt16LE(donde + 26);
  const largoExtra = buffer.readUInt16LE(donde + 28);
  const inicio = donde + 30 + largoNombre + largoExtra;
  const crudo = buffer.subarray(inicio, inicio + comprimido);

  if (metodo === 0) return Buffer.from(crudo);          // guardado tal cual
  if (metodo === 8) {
    const salida = zlib.inflateRawSync(crudo);
    if (original && salida.length !== original) {
      throw new Error(`"${nombre}" salió de otro tamaño del que decía. El ZIP está dañado.`);
    }
    return salida;
  }
  throw new Error(`"${nombre}" usa una compresión que no se soporta (método ${metodo}).`);
}

/**
 * Busca la firma del final. Va al revés porque el ZIP puede llevar una nota
 * al final, de largo desconocido, después de esa firma.
 */
function buscarFinDelDirectorio(buffer) {
  const minimo = Math.max(0, buffer.length - 22 - 0xffff);
  for (let p = buffer.length - 22; p >= minimo; p--) {
    if (buffer.readUInt32LE(p) === FIN_DIRECTORIO) return p;
  }
  return null;
}

/**
 * ¿Este nombre de archivo es seguro para escribirlo en disco?
 *
 * Un ZIP puede traer nombres como "../../windows/system32/algo" y, si se
 * escriben tal cual, se sale de la carpeta y pisa lo que quiera. Es un
 * agujero viejo y con nombre propio —"zip slip"— y se cierra aquí, no en
 * quien llama.
 */
function nombreSeguro(nombre) {
  if (!nombre || nombre.length > 250) return false;
  if (nombre.includes('\\')) return false;              // separador de Windows
  if (nombre.startsWith('/')) return false;             // ruta absoluta
  if (/^[a-zA-Z]:/.test(nombre)) return false;          // C:\ y compañía
  if (nombre.split('/').some((p) => p === '..')) return false;
  // Caracteres que en Windows ni siquiera se pueden escribir.
  if (/[\x00-\x1f<>:"|?*]/.test(nombre)) return false;
  return true;
}

module.exports = { leerZip, nombreSeguro };
