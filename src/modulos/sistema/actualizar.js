/**
 * ACTUALIZAR EL SISTEMA DESDE UN ZIP  (v2.2)
 *
 * "Me das los archivos, los comprimimos en un ZIP, dentro del software el
 * administrador le da clic a actualizar, se sube y listo, actualizado."
 *
 * Es el botón más peligroso del programa: reemplaza el código que se está
 * ejecutando. Por eso lleva tres redes, en este orden:
 *
 *   1. SE REVISA ANTES DE TOCAR NADA. Que sea un ZIP de verdad, que traiga
 *      package.json con el nombre correcto, que la versión sea más nueva y
 *      que ningún archivo intente salirse de la carpeta.
 *   2. SE RESPALDA LA BASE. Aunque una actualización no debería tocarla,
 *      las migraciones sí, y el respaldo se hace antes de que corran.
 *   3. SE GUARDA LA VERSIÓN ANTERIOR para poder volver a ella.
 *
 * Y la regla que manda sobre todas: LA CARPETA `datos` NO SE TOCA. Ahí
 * viven la base, los respaldos y el logo. Una actualización que borra los
 * datos no es una actualización, es un desastre.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');
const { leerZip, nombreSeguro } = require('../../lib/zip');
const { respaldar } = require('../../db/respaldar');

/**
 * LO QUE SE REEMPLAZA, y nada más.
 *
 * Una lista blanca, no una negra. Con una lista negra, el día que el ZIP
 * traiga una carpeta nueva que a nadie se le ocurrió prohibir, se copia.
 */
const SE_REEMPLAZA = ['src', 'public'];
const ARCHIVOS_SUELTOS = [
  'package.json', 'package-lock.json',
  'INICIAR.bat', 'DETENER.bat', 'ACTUALIZAR.bat',
  'CREAR-ACCESO-DIRECTO.bat', 'RECUPERAR-ACCESO.bat', 'INICIAR-MAC.command',
  'README.md', 'CHANGELOG.md', 'icono.ico'
];

/** Nunca, pase lo que pase. */
const INTOCABLE = ['datos', 'node_modules', '.git'];

const MAX_ZIP = 60 * 1024 * 1024;          // 60 MB descomprimidos

/**
 * REVISA EL ZIP SIN INSTALAR NADA.
 *
 * Devuelve { ok, version, archivos, avisos } o { ok: false, error }. La
 * pantalla lo usa para enseñar qué va a pasar ANTES de que el usuario
 * confirme: nadie debería apretar "actualizar" a ciegas.
 */
function revisar(buffer) {
  let entradas;
  try { entradas = leerZip(buffer); }
  catch (e) { return { ok: false, error: e.message }; }

  const archivos = entradas.filter((e) => !e.esCarpeta);
  if (!archivos.length) return { ok: false, error: 'El ZIP está vacío.' };

  const pesa = archivos.reduce((t, a) => t + a.tamano, 0);
  if (pesa > MAX_ZIP) {
    return { ok: false, error: `La actualización pesa ${Math.round(pesa / 1024 / 1024)} MB, ` +
                               'demasiado. ¿Se coló la carpeta node_modules?' };
  }

  // ¿Viene todo dentro de una carpeta? Es lo que pasa al comprimir con el
  // clic derecho de Windows, y hay que quitársela para que las rutas cuadren.
  const raiz = raizComun(archivos.map((a) => a.nombre));

  const malos = archivos.filter((a) => !nombreSeguro(a.nombre));
  if (malos.length) {
    return { ok: false,
             error: `El ZIP trae rutas que se salen de la carpeta: ${malos[0].nombre}` };
  }

  const sinRaiz = (nombre) => (raiz ? nombre.slice(raiz.length + 1) : nombre);

  // El package.json es la credencial: dice qué programa es y qué versión.
  const paquete = archivos.find((a) => sinRaiz(a.nombre) === 'package.json');
  if (!paquete) {
    return { ok: false, error: 'El ZIP no trae package.json: no parece una actualización ' +
                               'del sistema.' };
  }

  let datos;
  try { datos = JSON.parse(paquete.leer().toString('utf8')); }
  catch { return { ok: false, error: 'El package.json del ZIP está dañado.' }; }

  if (datos.name !== 'fabrica-hielo') {
    return { ok: false, error: `Ese ZIP es de otro programa ("${datos.name}").` };
  }
  if (!datos.version) return { ok: false, error: 'El ZIP no dice qué versión trae.' };

  const actual = require('../../../package.json').version;
  const comparacion = compararVersiones(datos.version, actual);

  // Los que se van a copiar de verdad.
  const aplicables = archivos.filter((a) => {
    const rel = sinRaiz(a.nombre);
    const primero = rel.split('/')[0];
    if (INTOCABLE.includes(primero)) return false;
    return SE_REEMPLAZA.includes(primero) || ARCHIVOS_SUELTOS.includes(rel);
  });

  // Tiene que traer CÓDIGO. Un ZIP con solo package.json pasaría el resto
  // de las revisiones y lo único que haría es subirle el número de versión
  // al sistema sin cambiar una línea: peor que no hacer nada, porque
  // después nadie entendería por qué la v9 se comporta como la v2.
  const traeCodigo = aplicables.some((a) => {
    const primero = sinRaiz(a.nombre).split('/')[0];
    return SE_REEMPLAZA.includes(primero);
  });
  if (!traeCodigo) {
    return { ok: false, error: 'El ZIP no trae ni la carpeta src ni la public. ' +
                               'Comprime la carpeta del sistema completa.' };
  }

  const avisos = [];
  if (comparacion < 0) {
    avisos.push(`Ese ZIP trae la v${datos.version} y aquí ya está la v${actual}: ` +
                'sería regresar a una versión vieja.');
  }
  if (comparacion === 0) {
    avisos.push(`Ya tienes la v${actual} instalada. Se puede reinstalar encima.`);
  }
  if (archivos.some((a) => sinRaiz(a.nombre).startsWith('datos/'))) {
    avisos.push('El ZIP trae una carpeta "datos". NO se va a copiar: tus datos se quedan ' +
                'como están.');
  }

  return {
    ok: true,
    version: datos.version,
    versionActual: actual,
    esMasNueva: comparacion > 0,
    archivos: aplicables.length,
    raiz: raiz || null,
    avisos,
    // Para que instalar() no vuelva a hacer todo el trabajo.
    _plan: { entradas: aplicables, sinRaiz }
  };
}

/**
 * INSTALA. Devuelve { ok, version, respaldo, guardadoEn } o lanza.
 *
 * El orden importa y no es negociable: primero el respaldo, después la
 * copia de seguridad de los archivos viejos, y hasta el final se escribe
 * encima. Si algo revienta a la mitad, lo de antes sigue guardado.
 */
/**
 * `raiz` y `carpetaDatos` se pueden pasar para poder PROBAR esto de verdad,
 * sobre una copia del sistema en una carpeta temporal. Es el código más
 * peligroso del programa —borra y escribe carpetas enteras— y probarlo solo
 * "de mentiritas" sería no probarlo. En el uso normal no se pasan.
 */
function instalar(buffer, { raiz = config.RAIZ, carpetaDatos = config.CARPETA_DATOS,
                            respaldarBase = respaldar } = {}) {
  const revision = revisar(buffer);
  if (!revision.ok) throw new Error(revision.error);

  // ---- 1. El respaldo de la base ----
  const respaldo = respaldarBase(`antes-de-v${revision.version}`);

  // ---- 2. La versión que se está reemplazando ----
  const guardadoEn = path.join(carpetaDatos, 'version-anterior');
  fs.rmSync(guardadoEn, { recursive: true, force: true });
  fs.mkdirSync(guardadoEn, { recursive: true });
  for (const carpeta of SE_REEMPLAZA) {
    const origen = path.join(raiz, carpeta);
    if (fs.existsSync(origen)) {
      fs.cpSync(origen, path.join(guardadoEn, carpeta), { recursive: true });
    }
  }
  for (const archivo of ARCHIVOS_SUELTOS) {
    const origen = path.join(raiz, archivo);
    if (fs.existsSync(origen)) fs.copyFileSync(origen, path.join(guardadoEn, archivo));
  }

  // ---- 3. Ahora sí, escribir ----
  //
  // Las carpetas que se reemplazan se BORRAN antes: si no, un archivo que
  // la versión nueva ya no usa se quedaría ahí para siempre, y esos son los
  // que producen los errores imposibles de explicar.
  const { entradas, sinRaiz } = revision._plan;
  const carpetasQueVienen = new Set(
    entradas.map((e) => sinRaiz(e.nombre).split('/')[0]).filter((c) => SE_REEMPLAZA.includes(c))
  );
  for (const carpeta of carpetasQueVienen) {
    fs.rmSync(path.join(raiz, carpeta), { recursive: true, force: true });
  }

  let escritos = 0;
  for (const entrada of entradas) {
    const relativo = sinRaiz(entrada.nombre);
    const destino = path.join(raiz, relativo);

    // Segunda revisión, ya con la ruta resuelta: la de nombreSeguro() mira
    // el texto, esta mira dónde acabaría de verdad. Las dos son baratas y
    // lo que está en juego es el disco entero.
    if (!destino.startsWith(raiz + path.sep)) {
      throw new Error(`"${relativo}" se sale de la carpeta del sistema.`);
    }

    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, entrada.leer());
    escritos++;
  }

  return {
    ok: true,
    version: revision.version,
    versionAnterior: revision.versionActual,
    archivos: escritos,
    respaldo: respaldo ? path.basename(respaldo) : null,
    guardadoEn
  };
}

/**
 * La carpeta que envuelve a todo, si la hay.
 *
 * Comprimir con el clic derecho de Windows mete todo dentro de una carpeta
 * con el nombre del original. Si no se le quita, los archivos acabarían en
 * "Fabrica-Software/src/..." en vez de "src/...".
 */
function raizComun(nombres) {
  const primeros = new Set(nombres.map((n) => n.split('/')[0]));
  if (primeros.size !== 1) return '';
  const unico = [...primeros][0];
  // Solo es "envoltura" si todo cuelga de ella; un ZIP que solo trae src/
  // no lleva envoltura, lleva src.
  if (SE_REEMPLAZA.includes(unico) || ARCHIVOS_SUELTOS.includes(unico)) return '';
  return nombres.every((n) => n.startsWith(unico + '/')) ? unico : '';
}

/** ¿Es a más nueva que b? 1 sí, 0 iguales, -1 más vieja. */
function compararVersiones(a, b) {
  const partes = (v) => String(v).split('.').map((n) => Number(n) || 0);
  const x = partes(a); const y = partes(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) > (y[i] || 0)) return 1;
    if ((x[i] || 0) < (y[i] || 0)) return -1;
  }
  return 0;
}

module.exports = { revisar, instalar, compararVersiones, SE_REEMPLAZA, ARCHIVOS_SUELTOS };
