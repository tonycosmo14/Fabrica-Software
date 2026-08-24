/**
 * LA FÁBRICA DE MENTIRA
 *
 * Todas las pruebas necesitan lo mismo: una carpeta nueva, una base nueva,
 * un servidor propio y una forma de llamar a la API con la sesión puesta.
 * Eso eran treinta y cinco renglones idénticos copiados en dieciséis
 * archivos: ochocientas líneas que no probaban nada y que había que
 * corregir dieciséis veces cada que cambiaba el arranque.
 *
 * Aquí está una sola vez.
 *
 * ── OJO CON EL ORDEN DE CARGA ──
 * `src/config.js` lee las variables de entorno cuando se carga, y Node
 * guarda en caché lo que ya cargó. Por eso CARPETA_DATOS se pone ANTES de
 * pedir cualquier cosa de src/, y por eso esos require van dentro de la
 * función y no arriba del archivo. Si se suben, las pruebas escribirían en
 * los datos de verdad de la fábrica.
 *
 * ── OJO CON LOS HOOKS ──
 * `test.before` de Node NO espera al anterior: dos before en el mismo
 * archivo arrancan a la vez. Así que aquí hay UN SOLO before, y lo que cada
 * archivo necesite preparar se registra con `preparar()`, que se ejecuta
 * dentro de ese único before y en orden.
 *
 *     const { llamar, preparar } = fabricaDePrueba('ventas');
 *     preparar(async () => { ... });      // sí
 *     test.before(async () => { ... });   // NO: corre en paralelo
 *
 * Cada archivo de pruebas corre en su propio proceso (así funciona
 * `node --test`), así que cada uno tiene su fábrica y no se pisan.
 */
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ADMIN = {
  nombre: 'Tony', usuario: 'tony', contrasena: 'clavelarga1', pin: '1111'
};

/**
 * Levanta una fábrica vacía y devuelve las herramientas para probarla.
 *
 * El servidor se abre antes de la primera prueba y se cierra al final, con
 * la carpeta borrada: no queda basura en el disco de nadie.
 *
 * @param nombre            para distinguir la carpeta temporal en /tmp
 * @param opciones.admin    credenciales del administrador inicial
 * @param opciones.sinAdmin no crear la cuenta (para probar el primer arranque)
 */
function fabricaDePrueba(nombre, opciones = {}) {
  const { admin = ADMIN, sinAdmin = false } = opciones;

  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), `fabrica-${nombre}-`));
  process.env.CARPETA_DATOS = carpeta;
  process.env.ARCHIVO_BD = path.join(carpeta, 'prueba.db');

  const { migrar } = require('../src/db/migrar');
  const { crearApp } = require('../src/servidor');
  const { bd } = require('../src/db/conexion');

  migrar({ silencioso: true });

  let servidor = null;
  let base = '';
  let cookie = '';
  const preparativos = [];

  /**
   * Una llamada a la API con la sesión puesta.
   *
   * Devuelve { estado, json, cabeceras } y NUNCA lanza: así se comprueban
   * los errores igual que los aciertos. El cuerpo solo se lee como JSON si
   * el servidor dice que lo es — hay rutas que devuelven un PNG o un ticket
   * en bytes, y ahí `json` viene en null en vez de reventar.
   */
  async function llamar(ruta, config = {}) {
    if (!base) {
      throw new Error(
        'El servidor todavía no arranca. Los preparativos van en preparar(), no en test.before().');
    }
    const r = await fetch(base + ruta, {
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      ...config,
      body: config.cuerpo ? JSON.stringify(config.cuerpo) : undefined
    });
    const puesta = r.headers.get('set-cookie');
    if (puesta) cookie = puesta.split(';')[0];

    const tipo = r.headers.get('content-type') || '';
    return {
      estado: r.status,
      cabeceras: r.headers,
      json: tipo.includes('json') ? await r.json() : null
    };
  }

  /** Vuelve a entrar como administrador. */
  function entrarAdmin(quien = admin) {
    return llamar('/api/auth/entrar-contrasena', {
      method: 'POST', cuerpo: { usuario: quien.usuario, contrasena: quien.contrasena }
    });
  }

  /** Entra con el PIN de alguien, buscándolo por su nombre. */
  async function entrarPorNombre(nombre2, pin) {
    const lista = (await llamar('/api/auth/usuarios-disponibles')).json.datos.usuarios;
    const u = lista.find((x) => x.nombre === nombre2);
    if (!u) throw new Error(`No hay ningún usuario que se llame ${nombre2}`);
    await llamar('/api/auth/entrar-pin', { method: 'POST', cuerpo: { usuarioId: u.id, pin } });
    return u;
  }

  /** Da de alta a alguien y devuelve su ficha. */
  async function crearUsuario(nombre2, rol, pin) {
    const r = await llamar('/api/usuarios', { method: 'POST', cuerpo: { nombre: nombre2, rol, pin } });
    return r.json.datos?.usuario;
  }

  /** Olvida la sesión del lado de la prueba, sin cerrarla en el servidor. */
  function olvidarSesion() { cookie = ''; }

  /**
   * Corre algo como si nadie hubiera entrado, y deja la sesión como estaba.
   * Es para comprobar que una ruta pide sesión de verdad.
   */
  async function sinSesion(fn) {
    const guardada = cookie;
    cookie = '';
    try { return await fn(); }
    finally { cookie = guardada; }
  }

  /**
   * Lo que este archivo necesita listo antes de su primera prueba: dar de
   * alta usuarios, crear el catálogo, abrir un turno. Se puede llamar
   * varias veces y corren en orden, dentro del único before.
   */
  function preparar(fn) { preparativos.push(fn); }

  test.before(async () => {
    servidor = crearApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;

    if (!sinAdmin) {
      await llamar('/api/auth/configuracion-inicial', { method: 'POST', cuerpo: admin });
    }
    for (const fn of preparativos) await fn();
  });

  test.after(() => {
    servidor?.close();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  return {
    llamar, entrarAdmin, entrarPorNombre, crearUsuario, olvidarSesion, sinSesion, preparar,
    bd, carpeta, admin,
    /** La dirección del servidor, para lo poco que no pasa por `llamar`. */
    donde: () => base
  };
}

module.exports = { fabricaDePrueba, ADMIN };
