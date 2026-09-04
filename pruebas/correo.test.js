/**
 * PRUEBAS DE LOS AVISOS POR CORREO  (v4.9)
 *
 * "Los correos serán varios que pueda activar y desactivar desde
 *  configuraciones, ya que habrá momentos en los que quiera saber y otros
 *  en los que no."
 *
 * Aquí hay dos cosas distintas que probar, y las dos importan:
 *
 *  1. QUE EL PROTOCOLO ESTÉ BIEN HABLADO. El cliente de SMTP está escrito
 *     a mano, sin librería. Se levanta un servidor de correo de mentira
 *     en esta misma máquina y se comprueba la conversación entera: el
 *     saludo, la identificación, el sobre y la carta.
 *
 *  2. QUE LOS INTERRUPTORES MANDEN. Un aviso apagado no puede encolar
 *     nada, y uno prendido tiene que encolar exactamente uno. Y la regla
 *     que pidió Tony: lo que anula el administrador NO avisa.
 */
const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const { fabricaDePrueba } = require('./ayudante');

const { llamar, entrarAdmin, entrarPorNombre, bd, preparar } = fabricaDePrueba('correo');

const smtp = require('../src/modulos/correo/smtp');
const cola = require('../src/modulos/correo/cola');
const avisos = require('../src/modulos/correo/avisos');

let chuy;

preparar(async () => {
  chuy = (await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Chuy Pech', rol: 'operario', pin: '2222' }
  })).json.datos.usuario;
});

// ============================================================
// UN SERVIDOR DE CORREO DE MENTIRA
// ============================================================

/**
 * Habla SMTP lo justo para contestar que sí a todo y quedarse con lo que
 * le mandaron. Sin cifrar, que es lo que hace `seguridad: 'plano'`.
 */
function servidorFalso({ falla = null } = {}) {
  const recibidos = [];
  const servidor = net.createServer((s) => {
    const dicho = [];
    let enDatos = false;
    let carta = '';

    s.write('220 mentiras.local listo\r\n');
    s.on('data', (b) => {
      for (const renglon of String(b).split('\r\n')) {
        if (enDatos) {
          if (renglon === '.') {
            enDatos = false;
            recibidos.push({ dicho: [...dicho], carta });
            s.write('250 2.0.0 recibido\r\n');
          } else { carta += renglon + '\n'; }
          continue;
        }
        if (!renglon) continue;
        dicho.push(renglon);

        const orden = renglon.split(' ')[0].toUpperCase();
        if (falla && falla.en === orden) { s.write(falla.respuesta + '\r\n'); continue; }

        if (orden === 'EHLO') s.write('250-mentiras.local\r\n250 AUTH LOGIN PLAIN\r\n');
        else if (orden === 'AUTH') s.write('334 VXNlcm5hbWU6\r\n');
        else if (orden === 'MAIL') s.write('250 2.1.0 ok\r\n');
        else if (orden === 'RCPT') s.write('250 2.1.5 ok\r\n');
        else if (orden === 'DATA') { enDatos = true; carta = ''; s.write('354 dale\r\n'); }
        else if (orden === 'QUIT') { s.write('221 adios\r\n'); s.end(); }
        // Lo que queda son las dos líneas del usuario y la contraseña en
        // base64, que en esta charla llegan sueltas y sin orden delante.
        else if (dicho.filter((d) => /^[A-Za-z0-9+/=]+$/.test(d)).length === 1) {
          s.write('334 UGFzc3dvcmQ6\r\n');
        } else s.write('235 2.7.0 entrale\r\n');
      }
    });
    s.on('error', () => {});
  });

  return {
    recibidos,
    escuchar: () => new Promise((listo) => servidor.listen(0, '127.0.0.1', () => listo(servidor.address().port))),
    cerrar: () => new Promise((listo) => servidor.close(listo))
  };
}

// ============================================================
// 1 · EL PROTOCOLO
// ============================================================

test('el correo se arma con las cabeceras que pide el estándar', () => {
  const m = smtp.armar({
    de: 'fabrica@ejemplo.com', deNombre: 'Hielo LOLHA',
    destinos: ['tony@ejemplo.com'],
    asunto: 'Corte de caja · faltó $120',
    html: '<p>Faltaron <b>$120</b>.</p>'
  });

  assert.match(m, /^From: Hielo LOLHA <fabrica@ejemplo\.com>/m);
  assert.match(m, /^To: tony@ejemplo\.com/m);
  assert.match(m, /^Date: \w{3}, \d\d \w{3} \d{4} \d\d:\d\d:\d\d [+-]\d{4}$/m);
  assert.match(m, /^Message-ID: <[^>]+@ejemplo\.com>$/m);
  assert.match(m, /multipart\/alternative/);

  // El asunto lleva acentos y un signo raro: tiene que ir codificado, o
  // llega hecho garabatos.
  assert.match(m, /^Subject: =\?UTF-8\?B\?/m,
    'un asunto con acentos va en base64, no en crudo');
  assert.ok(!m.includes('faltó'), 'y por lo tanto el texto crudo no aparece');
});

test('el correo lleva su versión en texto pelón', () => {
  const m = smtp.armar({
    de: 'a@b.com', destinos: ['c@d.com'], asunto: 'Prueba',
    html: '<h3>Corte</h3><p>Faltó <b>$120</b></p>'
  });

  const partes = m.split(/--lolha-[a-z0-9-]+/);
  assert.ok(partes.some((p) => /text\/plain/.test(p)), 'la de texto');
  assert.ok(partes.some((p) => /text\/html/.test(p)), 'y la de HTML');

  const texto = Buffer.from(
    partes.find((p) => /text\/plain/.test(p)).split('\r\n\r\n')[1].replace(/\r\n/g, ''),
    'base64').toString('utf8');
  assert.match(texto, /Corte/);
  assert.match(texto, /Faltó \$120/);
  assert.ok(!texto.includes('<b>'), 'sin etiquetas');
});

test('los renglones largos se parten: el correo no admite renglones eternos', () => {
  const m = smtp.armar({
    de: 'a@b.com', destinos: ['c@d.com'], asunto: 'x',
    html: '<p>' + 'ñ'.repeat(4000) + '</p>'
  });
  for (const r of m.split('\r\n')) {
    assert.ok(r.length <= 998, `un renglón de ${r.length} no cabe en un correo`);
  }
});

test('el cliente habla la conversación entera y entrega la carta', async () => {
  const falso = servidorFalso();
  const puerto = await falso.escuchar();

  const r = await smtp.mandar({
    servidor: '127.0.0.1', puerto, seguridad: 'plano',
    usuario: 'fabrica@ejemplo.com', contrasena: 'clave-de-aplicacion',
    de: 'fabrica@ejemplo.com', deNombre: 'Hielo LOLHA',
    para: 'tony@ejemplo.com, mari@ejemplo.com',
    asunto: 'Corte de caja', html: '<p>Faltaron <b>$120</b>.</p>'
  });
  await falso.cerrar();

  assert.equal(r.ok, true, r.error);
  assert.equal(falso.recibidos.length, 1, 'llegó una carta');

  const { dicho, carta } = falso.recibidos[0];
  const frases = dicho.map((d) => d.split(' ')[0].toUpperCase());
  assert.deepEqual(
    frases.filter((f) => ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA'].includes(f)),
    ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'RCPT', 'DATA'],
    'las frases, en su orden, y un RCPT por cada destino');

  // La cuenta y la contraseña van en base64, que es como las pide SMTP.
  assert.ok(dicho.includes(Buffer.from('fabrica@ejemplo.com').toString('base64')));
  assert.ok(dicho.includes(Buffer.from('clave-de-aplicacion').toString('base64')));

  assert.match(carta, /^From: Hielo LOLHA <fabrica@ejemplo\.com>/m);
  assert.match(carta, /^To: tony@ejemplo\.com, mari@ejemplo\.com/m);
  assert.match(carta, /multipart\/alternative/);
});

test('sin cifrar solo se puede contra esta misma computadora', async () => {
  assert.equal(smtp.esEstaMaquina('127.0.0.1'), true);
  assert.equal(smtp.esEstaMaquina('smtp.gmail.com'), false);

  const r = await smtp.mandar({
    servidor: 'smtp.gmail.com', puerto: 25, seguridad: 'plano',
    usuario: 'a@b.com', contrasena: 'x', para: 'c@d.com', asunto: 'x', html: 'x'
  });
  assert.equal(r.ok, false);
  assert.equal(r.reintentable, false, 'no es un problema de red: no se insiste');
  assert.match(r.error, /misma computadora/,
    'sin cifrar, la contraseña viajaría legible por la red');
});

test('un 535 no se reintenta; un 451 sí', async () => {
  for (const [respuesta, seReintenta] of [
    ['535 5.7.8 Username and Password not accepted', false],
    ['451 4.3.0 ahorita no', true]
  ]) {
    const falso = servidorFalso({ falla: { en: 'EHLO', respuesta } });
    const puerto = await falso.escuchar();
    const r = await smtp.mandar({
      servidor: '127.0.0.1', puerto, seguridad: 'plano',
      usuario: 'a@b.com', contrasena: 'x', para: 'c@d.com',
      asunto: 'x', html: 'x'
    });
    await falso.cerrar();

    assert.equal(r.ok, false);
    assert.equal(r.reintentable, seReintenta,
      `${respuesta} → ${seReintenta ? 'se vuelve a probar' : 'no se insiste'}`);
  }
});

test('sin cuenta configurada ni lo intenta', async () => {
  const r = await smtp.mandar({ servidor: '', usuario: '', contrasena: '', para: '' });
  assert.equal(r.ok, false);
  assert.equal(r.reintentable, false, 'lo que falta es configuración, no red');
});

// ============================================================
// 2 · LOS INTERRUPTORES
// ============================================================

/** Deja la cuenta puesta para que la cola acepte encolar. */
function configurarCuenta() {
  cola.guardarValor('correo_activo', '1');
  cola.guardarValor('correo_servidor', '127.0.0.1');
  cola.guardarValor('correo_usuario', 'fabrica@ejemplo.com');
  cola.guardarValor('correo_contrasena', 'clave');
  cola.guardarValor('correo_para', 'tony@ejemplo.com');
  // El puerto no lleva a ningún lado: los correos se quedan en la cola,
  // que es justo lo que se quiere mirar.
  cola.guardarValor('correo_puerto', '1');
}

const encolados = (aviso = null) => bd.prepare(
  `SELECT * FROM correos ${aviso ? 'WHERE aviso = ?' : ''} ORDER BY creado_en DESC`
).all(...(aviso ? [aviso] : []));

const vaciar = () => bd.prepare('DELETE FROM correos').run();

const prender = (id, si = true) => cola.guardarValor(`aviso_${id}`, si ? '1' : '0');

/** Cierra el turno que haya quedado abierto de otra prueba. */
async function cerrarTurnoAbierto() {
  const { json } = await llamar('/api/caja');
  if (json?.datos?.abierta) {
    await llamar('/api/caja/cerrar', {
      method: 'POST', cuerpo: { contado: json.datos.abierta.esperado / 100 } });
  }
}

/** Espera a que el cartero acabe lo que ya traía entre manos. */
const asentar = async () => {
  await new Promise((r) => setImmediate(r));
  await cola.entregarPendientes();
};

test('sin cuenta configurada no se encola nada, aunque el aviso esté prendido', async () => {
  cola.guardarValor('correo_activo', '0');
  prender('empleado_nuevo');
  vaciar();

  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Nadie Uno', rol: 'operario', pin: '9911' } });

  assert.equal(encolados().length, 0);
});

test('un aviso apagado no encola; prendido, encola uno', async () => {
  configurarCuenta();
  await entrarAdmin();

  prender('empleado_nuevo', false);
  vaciar();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Nadie Dos', rol: 'operario', pin: '9912' } });
  assert.equal(encolados().length, 0, 'apagado, ni uno');

  prender('empleado_nuevo', true);
  vaciar();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Pedro Ake', rol: 'repartidor', pin: '9913' } });

  const c = encolados('empleado_nuevo');
  assert.equal(c.length, 1);
  assert.match(c[0].asunto, /Pedro Ake/);
  assert.match(c[0].cuerpo, /Repartidor/, 'dice qué trabajo se le puso');
  assert.equal(c[0].para, 'tony@ejemplo.com');
  assert.equal(c[0].enviado_en, null, 'encolado, no mandado');
});

test('el tanque nuevo avisa con sus paños y sus moldes', async () => {
  configurarCuenta(); prender('tanque_nuevo'); vaciar();
  await entrarAdmin();

  await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'Tanque de prueba', panos: 6, plantilla: [3, 3], horasCongelacion: 24 } });

  const c = encolados('tanque_nuevo');
  assert.equal(c.length, 1);
  assert.match(c[0].asunto, /Tanque de prueba/);
});

test('LO QUE ANULA EL ADMINISTRADOR NO AVISA; lo que anula otro, sí', async () => {
  configurarCuenta(); prender('anulaciones'); vaciar();

  // El administrador da de baja un tanque: no avisa. Lo hizo él.
  await entrarAdmin();
  const t = (await llamar('/api/tanques', {
    method: 'POST',
    cuerpo: { nombre: 'Tanque que se va', panos: 6, plantilla: [3, 3], horasCongelacion: 24 }
  })).json.datos.tanque;
  await llamar(`/api/tanques/${t.id}`, { method: 'DELETE' });

  assert.equal(encolados('anulaciones').length, 0,
    'un correo por cada cosa que uno mismo acaba de hacer es ruido');

  // El gerente cancela un ticket: eso sí avisa. (Cancelar no es del
  // cajero: no puede deshacer su propia venta sin que nadie lo vea.)
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Mari Uc', rol: 'gerente', pin: '4477' } });
  await entrarPorNombre('Mari Uc', '4477');
  await cerrarTurnoAbierto();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 50 } });
  const venta = (await llamar('/api/ventas', {
    method: 'POST', cuerpo: { lineas: [{ dieciseisavos: 16 }], pago: 300 }
  })).json.datos.venta;

  vaciar();
  const r = await llamar(`/api/ventas/${venta.id}/cancelar`, {
    method: 'POST', cuerpo: { motivo: 'se equivocó de cliente' } });
  assert.equal(r.estado, 200);

  const c = encolados('anulaciones');
  assert.equal(c.length, 1, 'lo que hace otro sí se avisa');
  assert.match(c[0].asunto, /Mari Uc/);
  assert.match(c[0].cuerpo, /se equivocó de cliente/, 'con el motivo que escribió');
});

test('el corte avisa con lo que faltó y en qué se fue', async () => {
  configurarCuenta(); prender('corte'); prender('corte_descuadrado'); vaciar();

  await entrarPorNombre('Mari Uc', '4477');
  await llamar('/api/caja/movimientos', {
    method: 'POST', cuerpo: { tipo: 'salida', concepto: 'Diesel', monto: 200 } });
  vaciar();
  // Se entrega menos de lo que debía haber: el corte no cuadra.
  const r = await llamar('/api/caja/cerrar', { method: 'POST', cuerpo: { contado: 1 } });
  assert.equal(r.estado, 200);

  const c = encolados();
  const corte = c.find((x) => /^corte/.test(x.aviso));
  assert.ok(corte, 'sale un correo del corte');
  assert.equal(c.filter((x) => /^corte/.test(x.aviso)).length, 1,
    'los dos interruptores prendidos mandan UN correo, no dos');
  assert.equal(corte.aviso, 'corte_descuadrado');
  assert.match(corte.asunto, /FALTÓ/);
  assert.match(corte.cuerpo, /Debía haber/);
  assert.match(corte.cuerpo, /Diesel/, 'y en qué se fue el dinero');
  await entrarAdmin();
});

test('el vale de sueldo avisa de quién es y de cuánto', async () => {
  configurarCuenta(); prender('vale'); vaciar();
  await entrarAdmin();
  await llamar('/api/caja/abrir', { method: 'POST', cuerpo: { fondo: 5000 } });
  await llamar('/api/caja/vales', {
    method: 'POST', cuerpo: { clase: 'raya', monto: 400, ejecutorId: chuy.id } });

  const c = encolados('vale');
  assert.equal(c.length, 1);
  assert.match(c[0].asunto, /Chuy Pech/);
  assert.match(c[0].asunto, /\$400/);
});

test('la llegada y la salida avisan de quién y a qué hora', async () => {
  configurarCuenta(); prender('entrada_salida'); vaciar();

  await entrarPorNombre('Chuy Pech', '2222');
  const llegada = encolados('entrada_salida');
  assert.equal(llegada.length, 1);
  assert.match(llegada[0].asunto, /Llegó Chuy Pech/);

  await llamar('/api/auth/salir', { method: 'POST' });
  const todas = encolados('entrada_salida');
  assert.equal(todas.length, 2);
  assert.match(todas[0].asunto, /Salió Chuy Pech/);
  await entrarAdmin();
});

// ============================================================
// 3 · LA COLA
// ============================================================

test('un correo que falla se reprograma, y a la octava se rinde', async () => {
  configurarCuenta();
  cola.guardarValor('correo_puerto', '1');
  cola.guardarValor('correo_seguridad', 'tls');
  vaciar();
  const id = cola.encolar({ aviso: 'corte', asunto: 'prueba', html: '<p>x</p>' });
  const antes = bd.prepare('SELECT * FROM correos WHERE id = ?').get(id);
  assert.equal(antes.intentos, 0, 'recién apuntado, todavía sin intentos');

  // El puerto 1 no contesta: falla, y como es un fallo de red se reprograma.
  await asentar();
  const despues = bd.prepare('SELECT * FROM correos WHERE id = ?').get(id);
  assert.ok(despues.intentos >= 1, 'se intentó');
  assert.equal(despues.enviado_en, null);
  assert.equal(despues.cancelado_en, null, 'un fallo de red se vuelve a probar');
  assert.ok(despues.ultimo_error, 'y queda escrito por qué');
  assert.ok(despues.proximo_intento > antes.creado_en, 'más tarde, no en el acto');

  // A la octava se rinde, para no insistir para siempre.
  bd.prepare('UPDATE correos SET intentos = 7, proximo_intento = NULL WHERE id = ?').run(id);
  await cola.entregarPendientes();
  const final = bd.prepare('SELECT * FROM correos WHERE id = ?').get(id);
  assert.ok(final.cancelado_en, 'se rinde');
  assert.match(final.motivo_cancelacion, /varios intentos/);
});

test('un correo entregado se marca, no se borra', async () => {
  const falso = servidorFalso();
  const puerto = await falso.escuchar();
  configurarCuenta();
  cola.guardarValor('correo_puerto', String(puerto));
  cola.guardarValor('correo_seguridad', 'plano');
  vaciar();

  cola.encolar({ aviso: 'corte', asunto: 'prueba', html: '<p>x</p>' });
  await asentar();
  await falso.cerrar();

  const c = encolados()[0];
  assert.ok(c, 'sigue ahí: nada se borra (regla 3.4)');
  assert.ok(c.enviado_en, 'marcado como entregado');
  assert.equal(c.cancelado_en, null);
  assert.equal(falso.recibidos.length, 1, 'y salió de verdad');

  cola.guardarValor('correo_puerto', '1');
  cola.guardarValor('correo_seguridad', 'tls');
});

// ============================================================
// 4 · QUIÉN PUEDE
// ============================================================

test('los avisos por correo son solo del administrador', async () => {
  await entrarAdmin();
  await llamar('/api/usuarios', {
    method: 'POST', cuerpo: { nombre: 'Otra Persona', rol: 'cajero', pin: '4488' } });
  await entrarPorNombre('Otra Persona', '4488');
  assert.equal((await llamar('/api/correo')).estado, 403,
    'ahí vive la contraseña de la cuenta de la fábrica');
  assert.equal((await llamar('/api/correo/cuenta', {
    method: 'PUT', cuerpo: { usuario: 'otro@ejemplo.com' } })).estado, 403);
  await entrarAdmin();
});

test('la contraseña NUNCA sale al navegador', async () => {
  configurarCuenta();
  const r = await llamar('/api/correo');
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.cuenta.tieneContrasena, true, 'se dice que está puesta');
  assert.ok(!('contrasena' in r.json.datos.cuenta), 'pero no se manda');
  assert.ok(!JSON.stringify(r.json).includes('clave'),
    'ni escondida en ningún otro rincón de la respuesta');
});

test('un correo mal escrito se rechaza antes de guardarse', async () => {
  await entrarAdmin();
  const r = await llamar('/api/correo/cuenta', {
    method: 'PUT', cuerpo: { para: 'esto-no-es-un-correo' } });
  assert.equal(r.estado, 400);
  assert.match(r.json.error, /no parece un correo/);
});

test('guardar sin contraseña no la borra: sirve para cambiar solo el servidor', async () => {
  configurarCuenta();
  await entrarAdmin();
  await llamar('/api/correo/cuenta', {
    method: 'PUT', cuerpo: { servidor: 'smtp.otro.com', contrasena: '' } });

  assert.equal(cola.cuenta().contrasena, 'clave', 'la de antes sigue puesta');
  assert.equal(cola.cuenta().servidor, 'smtp.otro.com');
});

test('todos los avisos se prenden y se apagan uno por uno', async () => {
  await entrarAdmin();
  const lista = (await llamar('/api/correo')).json.datos.avisos;
  // Quince en la v4.9, más los dos de las neveras en la v5.1.
  assert.equal(lista.length, 17);

  for (const a of lista) {
    const r = await llamar(`/api/correo/avisos/${a.id}`, {
      method: 'PUT', cuerpo: { encendido: true } });
    assert.equal(r.estado, 200, a.id);
    assert.equal(r.json.datos.aviso.encendido, true);
  }
  assert.equal(avisos.catalogo().filter((a) => a.encendido).length, 17);
});
