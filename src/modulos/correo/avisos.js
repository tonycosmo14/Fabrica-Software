/**
 * QUÉ AVISA Y CUÁNDO  (v4.9)
 *
 * DE DÓNDE SALEN LOS AVISOS
 *
 * De la BITÁCORA. Este sistema ya apuntaba todo lo que pasa en una sola
 * tabla —quién abrió una caja, quién anuló un ticket, quién dio de alta
 * un tanque— desde la primera versión. Así que los avisos no se salpican
 * por veinte archivos: se cuelgan de esa tabla, en un solo sitio.
 *
 * Eso tiene una consecuencia que vale oro: un aviso nuevo es una entrada
 * en esta lista, y ya. No hay que ir a tocar la caja, ni las ventas, ni
 * la producción — y por lo tanto no se puede romper nada de eso.
 *
 * LOS TRES QUE NO SALEN DE AQUÍ
 *
 * El resumen del día, el informe del mes y el inventario bajo no pasan
 * "cuando alguien hace algo": pasan cuando pasa el tiempo. Ésos viven en
 * `programados.js` y los dispara el reloj.
 */
const { bd } = require('../../db/conexion');
const { formato } = require('../../lib/dinero');
const { aTexto } = require('../../lib/fracciones');
const cola = require('./cola');
const { correo, escapar, dinero } = require('./plantilla');

// ============================================================
// LA LISTA DE INTERRUPTORES
//
// Es la misma que pinta la pantalla de configuración, para que no haya
// dos listas que se puedan desincronizar.
// ============================================================
const AVISOS = [
  { id: 'corte', nombre: 'Cada corte de caja', icono: '💵', grupo: 'El dinero',
    ayuda: 'Al cerrar un turno llega el corte completo: lo que debía haber, ' +
           'lo que entregaron y en qué se fue.' },

  { id: 'corte_descuadrado', nombre: 'Solo los cortes que no cuadran', icono: '⚠️', grupo: 'El dinero',
    ayuda: 'Nada más cuando falta o sobra dinero. Si prefieres no recibir ' +
           'todos los cortes, prende éste y apaga el de arriba.' },

  { id: 'vale', nombre: 'Vale de sueldo', icono: '📤', grupo: 'El dinero',
    ayuda: 'Cada vez que alguien pide dinero a cuenta de su sueldo.' },

  { id: 'raya', nombre: 'Raya pagada', icono: '🧾', grupo: 'El dinero',
    ayuda: 'Cuando se le paga la semana a alguien, con la cuenta de cómo salió.' },

  { id: 'gasto_grande', nombre: 'Gasto grande de la empresa', icono: '🏭', grupo: 'El dinero',
    ayuda: 'Los gastos de la empresa que pasen del monto que pongas abajo.' },

  { id: 'precios', nombre: 'Cambio de precios', icono: '🏷️', grupo: 'El dinero',
    ayuda: 'Cuando alguien cambia un precio, una lista o el mayoreo.' },

  { id: 'anulaciones', nombre: 'Anulaciones que no hiciste tú', icono: '🚫', grupo: 'Lo que se deshace',
    ayuda: 'Tickets cancelados, sacadas anuladas, cosas dadas de baja o ' +
           'eliminadas. Lo que anula un administrador NO avisa: eso lo hiciste tú.' },

  { id: 'inventario_bajo', nombre: 'Producto bajo de inventario', icono: '📦', grupo: 'Lo que se acaba',
    ayuda: 'Cuando algo baja de su mínimo. Avisa una vez, cuando cruza — ' +
           'no todos los días mientras siga bajo.' },

  { id: 'hielo_bajo', nombre: 'Hielo por debajo del mínimo', icono: '🧊', grupo: 'Lo que se acaba',
    ayuda: 'Cuando el cuarto frío baja del mínimo de marquetas que tienes puesto.' },

  { id: 'conteo_descuadrado', nombre: 'El cuarto frío no cuadró', icono: '❄️', grupo: 'Lo que se acaba',
    ayuda: 'Cuando lo contado no coincide con lo que debía haber. Es la señal ' +
           'de un paño sin capturar, o de hielo que se fue sin ticket.' },

  { id: 'reparto_descuadre', nombre: 'Reparto que no cuadró', icono: '🚚', grupo: 'El dinero',
    ayuda: 'Cuando el repartidor entrega menos (o más) dinero del que dicen sus ' +
           'entregas. Llega en cuanto la cajera lo recibe, no al día siguiente.' },

  { id: 'reparto_merma', nombre: 'Se derritió de más en un viaje', icono: '🧊', grupo: 'Lo que se acaba',
    ayuda: 'Cuando el hielo que se derritió en la camioneta pasa del porcentaje ' +
           'que pusiste como normal. Suele ser el aviso de una lona rota o de una ' +
           'ruta que se está haciendo demasiado larga.' },

  { id: 'revision_tanque', nombre: 'Una revisión de tanque no cuadró', icono: '🔎', grupo: 'Lo que se acaba',
    ayuda: 'Cuando alguien da la vuelta al tanque y encuentra un paño que no está ' +
           'como dice el sistema: hielo donde debería haber agua, o al revés. Es el ' +
           'aviso de que lo reportado no fue lo que pasó.' },

  { id: 'nevera_sin_pedir', nombre: 'Nevera que no ha pedido', icono: '📞', grupo: 'Las neveras',
    ayuda: 'Las neveras que llevan más días sin pedir bolsas de los que les ' +
           'pusiste. Sale una vez al día, no cada vez que se mira.' },

  { id: 'nevera_falla', nombre: 'Nevera descompuesta', icono: '🔧', grupo: 'Las neveras',
    ayuda: 'Cuando alguien reporta que una nevera no sirve, con lo que dijo ' +
           'el cliente y dónde está.' },

  { id: 'agua_cloro', nombre: 'Cloro pasando por el carbón', icono: '⚠️', grupo: 'La planta de agua',
    ayuda: 'El más importante de todos: si el carbón deja pasar cloro, las seis ' +
           'membranas se echan a perder en días. Avisa en cuanto una vuelta lo mide.' },

  { id: 'agua_tds', nombre: 'El agua se pasó del TDS', icono: '🚱', grupo: 'La planta de agua',
    ayuda: 'Cuando el agua de salida sale más dura de lo que pusiste como límite. ' +
           'Esa agua no debería embotellarse.' },

  { id: 'agua_membranas', nombre: 'Las membranas se están acabando', icono: '🌀', grupo: 'La planta de agua',
    ayuda: 'Cuando el rechazo de sales baja del mínimo. Es el aviso de ir pidiendo ' +
           'membranas, que no llegan el mismo día.' },

  { id: 'agua_pieza', nombre: 'Pieza que ya cumplió su vida', icono: '🔧', grupo: 'La planta de agua',
    ayuda: 'Carbón, zeolita, membranas, lámpara de UV: lo que ya pasó de los días ' +
           'que le pusiste. Sale una vez al día, no cada vez que se mira.' },

  { id: 'agua_sin_lectura', nombre: 'Nadie dio la vuelta', icono: '📋', grupo: 'La planta de agua',
    ayuda: 'Cuando pasan más días de los que pusiste sin que nadie anote una lectura. ' +
           'Una planta sin lecturas es una planta a ciegas.' },

  { id: 'agua_falla', nombre: 'Falla en la planta de agua', icono: '🛠️', grupo: 'La planta de agua',
    ayuda: 'Cuando alguien reporta que un equipo de la planta no está funcionando.' },

  { id: 'tanque_nuevo', nombre: 'Tanque nuevo', icono: '🛢️', grupo: 'La gente y la fábrica',
    ayuda: 'Cuando se da de alta un tanque.' },

  { id: 'empleado_nuevo', nombre: 'Empleado nuevo', icono: '👤', grupo: 'La gente y la fábrica',
    ayuda: 'Cuando se da de alta a alguien, con el trabajo que se le puso.' },

  { id: 'entrada_salida', nombre: 'Llegada y salida de un trabajador', icono: '🚪', grupo: 'La gente y la fábrica',
    ayuda: 'Cada vez que alguien entra al sistema con su PIN y cada vez que sale. ' +
           'Ojo: es cuando toca el sistema, no un checador de la puerta.' },

  { id: 'resumen_dia', nombre: 'Resumen del día', icono: '🌙', grupo: 'Los resúmenes',
    ayuda: 'Una vez al día, a la hora que pongas: lo que se vendió, lo que se ' +
           'produjo, lo que se gastó y cómo quedó el cuarto frío.' },

  { id: 'informe_mes', nombre: 'Informe del mes', icono: '📅', grupo: 'Los resúmenes',
    ayuda: 'Al cerrar el mes del negocio: ventas, producción, gastos, la luz y ' +
           'el costo por marqueta.' }
];

const clave = (id) => `aviso_${id}`;
const encendido = (id) => cola.valor(clave(id), '0') === '1';

/** La lista con su estado, como la pide la pantalla. */
function catalogo() {
  return AVISOS.map((a) => ({ ...a, encendido: encendido(a.id) }));
}

// ============================================================
// EL ENGANCHE A LA BITÁCORA
// ============================================================

/**
 * MIRA UN EVENTO Y DECIDE SI HAY QUE AVISAR.
 *
 * Se le llama desde `bitacora.registrar`, o sea desde dentro del trabajo
 * de la fábrica. Por eso está entera dentro de un try: si un aviso se
 * rompe, se rompe el aviso — no el cierre del turno.
 */
function mirar(evento) {
  try {
    if (!cola.configurado()) return;
    const armar = SEGUN_ACCION[evento.accion] || porFamilia(evento.accion);
    if (!armar) return;

    const quien = persona(evento.ejecutor_id || evento.ejecutorId);
    const carta = armar({ ...evento, detalle: leerDetalle(evento.detalle), quien });
    if (!carta) return;

    cola.encolar({
      aviso: carta.aviso,
      asunto: carta.asunto,
      html: correo({ negocio: cola.negocio(), cuando: momento(), ...carta })
    });
  } catch (e) {
    console.error('  No se pudo armar el aviso:', e.message);
  }
}

/**
 * LAS CARTAS DE UNA SALIDA QUE SE ACABA DE RECIBIR.
 *
 * Puede mandar una, dos o ninguna. La del dinero solo si no cuadró; la del
 * hielo solo si se derritió más de lo normal.
 */
function cartasDelReparto(e, { descuadre }) {
  const d = e.detalle;
  const cartas = [];

  if (descuadre && encendido('reparto_descuadre')) {
    const dif = Number(d.diferencia || 0);
    const falto = dif < 0;
    cartas.push({
      aviso: 'reparto_descuadre',
      asunto: `Reparto #${escapar(d.folio)} · ${falto ? 'FALTÓ' : 'sobró'} `
            + `${formato(Math.abs(dif))} · ${escapar(d.repartidor || '')}`,
      titulo: falto ? 'Faltó dinero en un reparto' : 'Sobró dinero en un reparto',
      entradilla: `Se lo recibió <b>${escapar(d.recibio || '—')}</b> a `
                + `<b>${escapar(d.repartidor || '—')}</b>.`,
      grande: dinero(Math.abs(dif)),
      color: falto ? 'rojo' : 'ambar',
      renglones: [
        ['Debía traer', dinero(d.esperado)],
        ['Entregó', dinero(d.recibido)],
        [falto ? 'Faltó' : 'Sobró', dinero(Math.abs(dif)), falto ? 'rojo' : 'ambar'],
        ['Pedidos entregados', escapar(String(d.entregados ?? 0))],
        Number(d.sinEntregar) ? ['Volvieron sin entregar', escapar(String(d.sinEntregar))] : null
      ].filter(Boolean),
      // Es lo que hay que saber al leerlo desde el teléfono: nadie cerró
      // nada todavía, y el turno va a salir corto hasta que se cierre.
      nota: 'La salida queda ABIERTA hasta que un responsable la cierre con su '
          + 'motivo. Mientras tanto, el corte del turno va a salir con ese hueco.'
    });
  }

  // LA MERMA VA APARTE, y sale aunque el dinero haya cuadrado: son dos
  // cosas distintas. Un viaje puede traer el dinero exacto y haber
  // perdido media carga en el camino.
  const porciento = Number(d.porcientoMerma || 0);
  const normal = Number(d.mermaNormal || 8);
  if (porciento > normal && encendido('reparto_merma')) {
    cartas.push({
      aviso: 'reparto_merma',
      asunto: `Reparto #${escapar(d.folio)} · se derritió el ${porciento}% del hielo suelto`,
      titulo: 'Se derritió de más en un viaje',
      entradilla: `Lo llevaba <b>${escapar(d.repartidor || '—')}</b>.`,
      grande: `${porciento}%`,
      color: 'ambar',
      renglones: [
        ['Se derritió', escapar(d.mermaTexto || '—')],
        ['Lo normal es hasta', `${normal}%`]
      ],
      nota: 'Suele ser una lona rota, una hielera que ya no cierra, o una ruta '
          + 'que se está haciendo demasiado larga para el calor que hace.'
    });
  }

  if (!cartas.length) return null;

  // Igual que la vuelta de la planta de agua: la primera se devuelve para
  // que la encole `mirar()` y las demás se encolan aquí, sin cambiarle la
  // forma al archivo entero por los dos eventos que pueden dar más de una.
  for (const otra of cartas.slice(1)) {
    cola.encolar({
      aviso: otra.aviso,
      asunto: otra.asunto,
      html: correo({ negocio: cola.negocio(), cuando: momento(), ...otra })
    });
  }
  return cartas[0];
}

function leerDetalle(d) {
  if (!d) return {};
  if (typeof d === 'object') return d;
  try { return JSON.parse(d); } catch { return {}; }
}

function persona(id) {
  if (!id) return null;
  return bd.prepare('SELECT id, nombre, rol FROM usuarios WHERE id = ?').get(id) || null;
}

const esAdmin = (u) => u?.rol === 'admin';

function momento(d = new Date()) {
  return d.toLocaleString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit'
  });
}

const nombreDe = (u) => escapar(u?.nombre || 'alguien');

// ============================================================
// CADA AVISO, CON SU CARTA
// ============================================================

const SEGUN_ACCION = {

  // ---------- LA REVISIÓN DEL TANQUE  (v6.7) ----------
  //
  // Solo cuando NO cuadra. Una vuelta en la que todo estaba en su sitio es
  // una buena noticia, pero no es una noticia que valga un correo.
  'produccion.revision_no_cuadra': (e) => {
    if (!encendido('revision_tanque')) return null;
    const d = e.detalle;
    const cuales = Array.isArray(d.cuales) ? d.cuales : [];
    const COMO = {
      con_hielo: 'tiene hielo y el sistema dice que ya se sacó',
      con_agua: 'tiene agua y el sistema dice que está listo',
      vacio: 'está vacío'
    };
    return {
      aviso: 'revision_tanque',
      asunto: `${d.tanque}: ${d.diferencias} ${d.diferencias === 1 ? 'paño no cuadra' : 'paños no cuadran'}`,
      titulo: 'Una revisión de tanque no cuadró',
      entradilla: `Lo revisó <b>${escapar(e.quien || '—')}</b>: miró `
        + `${d.panos} ${d.panos === 1 ? 'paño' : 'paños'} de ${escapar(d.tanque)}.`,
      grande: String(d.diferencias),
      color: 'rojo',
      renglones: cuales.slice(0, 10).map((c) => [
        `Paño ${escapar(c.pano)}`,
        `${escapar(COMO[c.encontrado] || c.encontrado)}`
          + (c.reporto ? ` · lo reportó ${escapar(c.reporto)}` : '')
      ]),
      nota: 'Un paño con hielo que se reportó sacado es producción que se '
          + 'apuntó y no existió: el faltante aparece días después y le cae a '
          + 'quien esté en la caja ese día. Se corrige en la historia de ese '
          + 'paño, en la fecha en que se reportó.'
    };
  },

  // ---------- EL CORTE ----------
  'caja.cerrada': (e) => {
    const d = e.detalle;
    const dif = Number(d.diferencia || 0);
    const cuadra = dif === 0;

    // Dos interruptores para el mismo momento: el que quiere todos los
    // cortes y el que solo quiere los que no cuadran. Si están los dos
    // prendidos sale UN correo, no dos.
    const todos = encendido('corte');
    const soloMalos = encendido('corte_descuadrado');
    if (!todos && !(soloMalos && !cuadra)) return null;

    const detalle = detalleDelCorte(e.entidad_id || e.entidadId);

    return {
      aviso: cuadra ? 'corte' : 'corte_descuadrado',
      asunto: cuadra
        ? `Corte ${d.folio ? `#${d.folio} ` : ''}· cuadró · ${formato(d.contado)}`
        : `Corte ${d.folio ? `#${d.folio} ` : ''}· ${dif > 0 ? 'FALTÓ' : 'sobró'} ${formato(Math.abs(dif))}`,
      titulo: cuadra ? 'El turno cerró cuadrado' : (dif > 0 ? 'Faltó dinero en el corte' : 'Sobró dinero en el corte'),
      entradilla: `Cerró <b>${nombreDe(e.quien)}</b>${d.folio ? `, turno #${escapar(d.folio)}` : ''}.`,
      grande: cuadra ? dinero(d.contado) : dinero(Math.abs(dif)),
      color: cuadra ? 'verde' : (dif > 0 ? 'rojo' : 'ambar'),
      renglones: [
        ['Debía haber', dinero(d.esperado)],
        ['Entregaron', dinero(d.contado)],
        [cuadra ? 'Diferencia' : (dif > 0 ? 'Faltó' : 'Sobró'),
         cuadra ? '$0' : dinero(Math.abs(dif)), cuadra ? 'verde' : (dif > 0 ? 'rojo' : 'ambar')],
        ...detalle
      ],
      nota: cuadra ? null
        : 'Sobrar no es bueno tampoco: quiere decir que algo se cobró y no se capturó.'
    };
  },

  // ---------- LOS VALES ----------
  'caja.vale.raya': (e) => {
    if (!encendido('vale')) return null;
    const d = e.detalle;
    return {
      aviso: 'vale',
      asunto: `Vale de sueldo · ${escapar(d.quien || '')} · ${formato(d.centavos)}`,
      titulo: 'Se dio un vale de sueldo',
      entradilla: `<b>${escapar(d.quien || 'alguien')}</b> pidió dinero a cuenta de su sueldo.`,
      grande: dinero(d.centavos),
      color: 'ambar',
      renglones: [
        ['Quién', escapar(d.quien || '—')],
        ['Turno', d.cajaFolio ? `#${escapar(d.cajaFolio)}` : '—'],
        ['Lo capturó', nombreDe(persona(e.capturista_id || e.capturistaId))]
      ],
      nota: 'Se le descuenta solo el día que se le pague su raya.'
    };
  },

  // ---------- LA RAYA ----------
  'raya.pagada': (e) => {
    if (!encendido('raya')) return null;
    const d = e.detalle;
    return {
      aviso: 'raya',
      asunto: `Raya pagada · ${escapar(d.quien || '')} · ${formato(d.pagado)}`,
      titulo: `Se le pagó la semana a ${escapar(d.quien || 'alguien')}`,
      entradilla: `Del <b>${escapar(d.desde)}</b> al <b>${escapar(d.hasta)}</b>. ` +
                  (d.deDonde === 'cajon'
                    ? 'Salió <b>del cajón</b>, así que el corte de ese turno lo resta.'
                    : 'Salió <b>de fuera</b>: el cajón no se entera.'),
      grande: dinero(d.pagado),
      renglones: [
        ['Sueldo', dinero(d.sueldo)],
        d.extras ? ['Extras', '+' + dinero(d.extras)] : null,
        d.vales ? ['Vales que se llevó', '−' + dinero(d.vales), 'ambar'] : null,
        d.descuentos ? ['Otros descuentos', '−' + dinero(d.descuentos)] : null,
        ['Se le pagó', dinero(d.pagado)],
        ['Lo pagó', nombreDe(persona(e.capturista_id || e.capturistaId))]
      ].filter(Boolean)
    };
  },

  // ---------- GASTOS GRANDES ----------
  'empresa.gasto': (e) => {
    if (!encendido('gasto_grande')) return null;
    const desde = Number(cola.valor('aviso_gasto_grande_desde', '200000')) || 200000;
    const cuanto = Number(e.detalle.centavos || 0);
    if (cuanto < desde) return null;

    return {
      aviso: 'gasto_grande',
      asunto: `Gasto de la empresa · ${escapar(e.detalle.concepto || '')} · ${formato(cuanto)}`,
      titulo: 'Se anotó un gasto grande',
      entradilla: `Lo capturó <b>${nombreDe(e.quien)}</b>.`,
      grande: dinero(cuanto),
      renglones: [
        ['Concepto', escapar(e.detalle.concepto || '—')],
        ['Fecha', escapar(e.detalle.fecha || '—')],
        e.detalle.cantidad ? ['Cantidad', `${escapar(e.detalle.cantidad)} ${escapar(e.detalle.unidad || '')}`] : null,
        e.detalle.iva ? ['IVA', dinero(e.detalle.iva)] : null,
        ['Trae comprobante', e.detalle.conArchivo ? 'sí' : 'no']
      ].filter(Boolean),
      nota: `Avisa desde ${formato(desde)}. Ese monto se cambia en Sistema › Avisos por correo.`
    };
  },

  // ---------- PRECIOS ----------
  'precios.cambio': (e) => cambioDePrecios(e, `la lista «${escapar(e.detalle.lista || '')}»`),
  'precios.lista': (e) => cambioDePrecios(e, 'las listas de precios'),
  'precios.mayoreo': (e) => cambioDePrecios(e, 'el mayoreo'),

  // ---------- EL CUARTO FRÍO ----------
  'existencia.conteo': (e) => {
    if (!encendido('conteo_descuadrado')) return null;
    const d = e.detalle;
    // `faltante` viene ya en texto de fracciones ("3 1/2 marquetas"), y
    // "0" o vacío quiere decir que cuadró. Un conteo que cuadra no es
    // noticia: sería un correo diario que nadie abre.
    const falta = String(d.faltante || '').trim();
    if (!falta || falta === '0' || /^0\b/.test(falta)) return null;

    return {
      aviso: 'conteo_descuadrado',
      asunto: `El cuarto frío no cuadró · ${falta}`,
      titulo: 'El conteo del cuarto frío no cuadró',
      entradilla: `Contó <b>${nombreDe(e.quien)}</b> en <b>${escapar(d.almacen || 'el cuarto frío')}</b>.`,
      grande: escapar(falta),
      color: 'rojo',
      renglones: [
        ['Había antes', escapar(d.anterior || '—')],
        ['Se produjo', escapar(d.producido || '—')],
        ['Se vendió', escapar(d.vendido || '—')],
        d.merma && d.merma !== '0' ? ['Se derritió', escapar(d.merma)] : null,
        d.cortado && d.cortado !== '0' ? ['Se cortó', escapar(d.cortado)] : null,
        ['Se contó', escapar(d.contado || '—')],
        ['Diferencia', escapar(falta), 'rojo']
      ].filter(Boolean),
      nota: 'Casi siempre es un paño que no se capturó, o hielo que salió sin ticket.'
    };
  },

  'avisos.hielo': (e) => {
    if (!encendido('hielo_bajo')) return null;
    const d = e.detalle;
    return {
      aviso: 'hielo_bajo',
      asunto: `Queda poco hielo · ${escapar(d.texto || '')}`,
      titulo: 'El cuarto frío está bajo',
      entradilla: 'Quedó por debajo del mínimo que tienes puesto.',
      grande: escapar(d.texto || ''),
      color: 'ambar',
      renglones: [
        ['Queda', escapar(d.texto || '—')],
        ['El mínimo es', `${escapar(d.minimoMarquetas ?? '—')} marquetas`]
      ]
    };
  },

  // ---------- LA FÁBRICA ----------
  'tanque.alta': (e) => {
    if (!encendido('tanque_nuevo')) return null;
    const d = e.detalle;
    return {
      aviso: 'tanque_nuevo',
      asunto: `Tanque nuevo · ${escapar(d.nombre || '')}`,
      titulo: 'Se dio de alta un tanque',
      entradilla: `Lo dio de alta <b>${nombreDe(e.quien)}</b>.`,
      grande: escapar(d.nombre || ''),
      renglones: [
        ['Paños', String(d.panos ?? '—')],
        ['Moldes', String(d.moldes ?? '—')],
        d.plantilla ? ['Copiado de', escapar(d.plantilla)] : null
      ].filter(Boolean)
    };
  },

  'usuario.alta': (e) => {
    if (!encendido('empleado_nuevo')) return null;
    const d = e.detalle;
    return {
      aviso: 'empleado_nuevo',
      asunto: `Empleado nuevo · ${escapar(d.nombre || '')}`,
      titulo: 'Se dio de alta a alguien',
      entradilla: `Lo dio de alta <b>${nombreDe(e.quien)}</b>.`,
      grande: escapar(d.nombre || ''),
      renglones: [
        ['Trabajo', escapar(ROLES[d.rol] || d.rol || '—')],
        ['Ya puede entrar', 'sí, con su PIN']
      ],
      nota: 'Si va a cobrar sueldo, ponle cuánto gana en <b>La raya</b>.'
    };
  },

  // ---------- LAS NEVERAS ----------
  'nevera.falla': (e) => {
    if (!encendido('nevera_falla')) return null;
    const d = e.detalle;
    return {
      aviso: 'nevera_falla',
      asunto: `Nevera ${escapar(d.numero || '')} descompuesta` +
              (d.quien ? ` · ${escapar(d.quien)}` : ''),
      titulo: 'Reportaron una nevera descompuesta',
      entradilla: `Lo anotó <b>${nombreDe(e.quien)}</b>.`,
      grande: `Nevera ${escapar(d.numero || '?')}`,
      color: 'rojo',
      renglones: [
        ['Qué tiene', escapar(d.queTiene || '—')],
        d.quien ? ['Dónde está', escapar(d.quien)] : null
      ].filter(Boolean),
      nota: 'Queda marcada como «por reparar» hasta que se anote qué se le hizo.'
    };
  },

  // ---------- EL REPARTO ----------
  //
  // DOS AVISOS DISTINTOS PARA EL MISMO MOMENTO, y salen los dos si los dos
  // aplican: que falte dinero y que se haya derretido medio camión son dos
  // problemas con dos arreglos distintos. Juntarlos haría que el del
  // dinero —que es el que se atiende hoy— se leyera como un renglón de un
  // informe.
  'salida.descuadrada': (e) => cartasDelReparto(e, { descuadre: true }),
  'salida.recibida': (e) => cartasDelReparto(e, { descuadre: false }),

  // ---------- LA PLANTA DE AGUA ----------
  //
  // UNA VUELTA PUEDE DISPARAR TRES AVISOS DISTINTOS, y salen los tres:
  // son tres problemas diferentes con tres arreglos diferentes. Juntarlos
  // en un correo haría que el del cloro —que es el urgente— se leyera
  // como un renglón más de un informe.
  'agua.lectura': (e) => cartasDeLaVuelta(e),

  'agua.falla': (e) => {
    if (!encendido('agua_falla')) return null;
    const d = e.detalle;
    return {
      aviso: 'agua_falla',
      asunto: `Falla en la planta de agua · ${escapar(d.equipo || '')}`,
      titulo: 'Reportaron una falla en la planta',
      entradilla: `Lo anotó <b>${nombreDe(e.quien)}</b>.`,
      grande: escapar(d.equipo || 'La planta'),
      color: 'rojo',
      renglones: [['Qué tiene', escapar(d.queTiene || '—')]],
      nota: 'El equipo queda marcado como «por reparar» hasta que se anote qué se le hizo.'
    };
  },

  // ---------- LLEGADAS Y SALIDAS ----------
  'sesion.inicio': (e) => llegadaOSalida(e, true),
  'sesion.fin': (e) => llegadaOSalida(e, false)
};

/**
 * LA VUELTA DE LA PLANTA, CONVERTIDA EN AVISO.
 *
 * Se manda UNA carta por problema, y en el orden del daño: el cloro
 * primero. Como `mirar()` solo encola una carta por evento, se devuelve
 * la más grave y las otras se encolan aquí mismo.
 */
function cartasDeLaVuelta(e) {
  const agua = require('../agua/calculo');
  const a = agua.ajustes();
  const d = e.detalle;
  const quien = nombreDe(e.quien);
  const cartas = [];

  if (d.cloro != null && Number(d.cloro) > 0 && encendido('agua_cloro')) {
    cartas.push({
      aviso: 'agua_cloro',
      asunto: '⚠️ Está pasando cloro por el carbón',
      titulo: 'El carbón está dejando pasar cloro',
      entradilla: `Lo midió <b>${quien}</b> en la vuelta de hoy.`,
      grande: `${d.cloro} ppm`,
      color: 'rojo',
      renglones: [
        ['Cloro después del carbón', `${d.cloro} ppm`],
        ['Debería dar', '0 ppm']
      ],
      nota: 'El cloro que llega a las membranas se las come en días. '
          + 'Hay que cambiar el carbón antes de seguir produciendo.'
    });
  }

  if (d.tdsSalida != null && d.tdsSalida > a.tdsMaximo && encendido('agua_tds')) {
    cartas.push({
      aviso: 'agua_tds',
      asunto: `El agua salió en ${d.tdsSalida} ppm`,
      titulo: 'El agua se pasó del TDS permitido',
      entradilla: `Lo midió <b>${quien}</b>.`,
      grande: `${d.tdsSalida} ppm`,
      color: 'rojo',
      renglones: [
        ['Salió en', `${d.tdsSalida} ppm`],
        ['El límite está en', `${a.tdsMaximo} ppm`]
      ],
      nota: 'Esa agua no debería embotellarse.'
    });
  }

  if (d.rechazo != null && d.rechazo < a.rechazoMinimo && encendido('agua_membranas')) {
    cartas.push({
      aviso: 'agua_membranas',
      asunto: `Rechazo de sales en ${d.rechazo} %`,
      titulo: 'Las membranas se están acabando',
      entradilla: `De la vuelta que dio <b>${quien}</b>.`,
      grande: `${d.rechazo} %`,
      color: 'ambar',
      renglones: [
        ['Rechazo de sales', `${d.rechazo} %`],
        ['El mínimo es', `${a.rechazoMinimo} %`],
        ['Entró con', `${d.tdsEntrada ?? '—'} ppm`],
        ['Salió con', `${d.tdsSalida ?? '—'} ppm`]
      ],
      nota: 'Ve pidiendo membranas: no llegan el mismo día.'
    });
  }

  if (!cartas.length) return null;

  // La primera se devuelve para que la encole `mirar()`; las demás se
  // encolan aquí. Así no hay que cambiar la forma de todo el archivo por
  // el único evento que puede dar más de una carta.
  for (const otra of cartas.slice(1)) {
    cola.encolar({
      aviso: otra.aviso,
      asunto: otra.asunto,
      html: correo({ negocio: cola.negocio(), cuando: momento(), ...otra })
    });
  }
  return cartas[0];
}

const ROLES = {
  admin: 'Administrador', gerente: 'Gerente de turno', cajero: 'Encargado de caja',
  repartidor: 'Repartidor', operario: 'Operario'
};

function cambioDePrecios(e, que) {
  if (!encendido('precios')) return null;
  const cambios = Array.isArray(e.detalle.cambios) ? e.detalle.cambios : [];
  return {
    aviso: 'precios',
    asunto: `Se cambiaron precios · ${e.quien?.nombre || ''}`,
    titulo: 'Alguien cambió precios',
    entradilla: `<b>${nombreDe(e.quien)}</b> cambió ${que}.`,
    grande: cambios.length ? `${cambios.length} ${cambios.length === 1 ? 'precio' : 'precios'}` : null,
    color: 'ambar',
    renglones: cambios.slice(0, 12).map((c) => [
      escapar(c.producto || c.nombre || c.que || '—'),
      c.antes != null && c.ahora != null
        ? `${formato(c.antes)} → ${formato(c.ahora)}`
        : (c.ahora != null ? dinero(c.ahora) : '')
    ]),
    nota: cambios.length > 12 ? `Y ${cambios.length - 12} más.` : null
  };
}

function llegadaOSalida(e, llega) {
  if (!encendido('entrada_salida')) return null;
  const u = e.quien;
  if (!u) return null;

  const hora = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  return {
    aviso: 'entrada_salida',
    asunto: `${llega ? 'Llegó' : 'Salió'} ${u.nombre} · ${hora}`,
    titulo: `${llega ? 'Llegó' : 'Salió'} ${escapar(u.nombre)}`,
    grande: hora,
    color: llega ? 'verde' : 'gris',
    renglones: [
      ['Trabajo', escapar(ROLES[u.rol] || u.rol || '—')],
      ['Entró con', escapar(e.detalle?.via === 'contrasena' ? 'usuario y contraseña' : 'su PIN')]
    ].slice(0, llega ? 2 : 1),
    nota: 'Es cuando toca el sistema, no un checador de la puerta.'
  };
}

// ============================================================
// LAS ANULACIONES
//
// No hay una lista de acciones "que anulan": hay una FORMA de llamarlas.
// Todo lo que termina en .anulado, .anulada, .cancelada, .eliminado,
// .borrada o .baja es deshacer algo. Colgarse del nombre y no de una
// lista quiere decir que una anulación nueva que se agregue mañana en
// cualquier módulo va a avisar sola, sin acordarse de venir aquí.
// ============================================================
const DESHACE = /\.(anulad[oa]|anulacion|cancelada|eliminad[oa]|borrad[oa]|baja|baja_multiple)$/;

const COMO_SE_LLAMA = {
  venta: 'un ticket', movimiento_caja: 'un movimiento de la caja',
  gasto_empresa: 'un gasto de la empresa', pano: 'un paño', tanque: 'un tanque',
  usuario: 'un usuario', producto: 'un producto', cliente: 'un cliente',
  almacen: 'un almacén', canasta: 'una canasta', molde: 'un molde',
  categoria: 'una categoría', lista_precios: 'una lista de precios',
  encomienda: 'un encomendado', conteo: 'un conteo', sacada: 'una sacada'
};

function porFamilia(accion) {
  if (!DESHACE.test(String(accion || ''))) return null;

  return (e) => {
    if (!encendido('anulaciones')) return null;

    // "Siempre que no las haga el administrador". Lo que anula el
    // administrador no se avisa: lo hizo él, ya lo sabe, y un correo por
    // cada cosa que uno mismo acaba de hacer es la forma más rápida de
    // que se dejen de leer los correos de este sistema.
    if (esAdmin(e.quien)) return null;

    const d = e.detalle;
    const que = COMO_SE_LLAMA[e.entidad || e.entidadTipo] || 'algo';
    const cuanto = d.centavos ?? d.total ?? d.pagado ?? null;

    return {
      aviso: 'anulaciones',
      asunto: `${e.quien?.nombre || 'Alguien'} deshizo ${que}` +
              (cuanto != null ? ` · ${formato(cuanto)}` : ''),
      titulo: `Se deshizo ${que}`,
      entradilla: `Lo hizo <b>${nombreDe(e.quien)}</b>` +
                  (e.quien?.rol ? ` (${escapar(ROLES[e.quien.rol] || e.quien.rol)})` : '') + '.',
      grande: cuanto != null ? dinero(cuanto) : null,
      color: 'rojo',
      renglones: [
        ['Qué pasó', escapar(EN_CRISTIANO[accion] || accion)],
        d.folio ? ['Folio', `#${escapar(d.folio)}`] : null,
        d.concepto ? ['Concepto', escapar(d.concepto)] : null,
        d.nombre ? ['Nombre', escapar(d.nombre)] : null,
        d.motivo ? ['Motivo que escribió', escapar(d.motivo)] : null,
        ['Cuándo', momento()]
      ].filter(Boolean),
      nota: d.motivo ? null
        : 'No escribió motivo. Si esto pasa seguido, vale la pena preguntarlo.'
    };
  };
}

/** El nombre técnico de la acción, dicho como se dice. */
const EN_CRISTIANO = {
  'venta.cancelada': 'se canceló un ticket',
  'venta.borrada': 'se borró un ticket',
  'venta.devuelta': 'se devolvió un ticket',
  'caja.movimiento.anulado': 'se anuló un gasto de la caja',
  'caja.movimiento-borrado': 'se borró un movimiento de la caja',
  'produccion.anulacion': 'se anuló una sacada de hielo',
  'existencia.anulacion': 'se anuló un conteo del cuarto frío',
  'inventario.anulado': 'se anuló un conteo de inventario',
  'empresa.gasto_anulado': 'se anuló un gasto de la empresa',
  'empresa.cfe_anulado': 'se anuló un recibo de luz',
  'encomienda.anulada': 'se anuló un encomendado',
  'raya.anulada': 'se anuló una raya pagada',
  'producto.baja': 'se dio de baja un producto',
  'producto.eliminado': 'se eliminó un producto',
  'cliente.baja': 'se dio de baja un cliente',
  'cliente.eliminado': 'se eliminó un cliente',
  'tanque.baja': 'se dio de baja un tanque',
  'usuario.baja': 'se dio de baja a alguien',
  'pano.baja': 'se dio de baja un paño',
  'pano.baja_multiple': 'se dieron de baja varios paños',
  'molde.baja': 'se dio de baja un molde',
  'canasta.baja': 'se dio de baja una canasta'
};

// ============================================================
// EL DESGLOSE DEL CORTE
// ============================================================

/**
 * En qué se fue el dinero del turno, para meterlo en el correo del corte.
 *
 * Se lee de la base y no del detalle de la bitácora: ahí solo caben tres
 * números, y quien abre el correo del corte quiere ver los gastos.
 */
function detalleDelCorte(cajaId) {
  if (!cajaId) return [];
  try {
    const m = bd.prepare(`
      SELECT m.tipo, COALESCE(c.nombre, m.concepto) AS concepto,
             COALESCE(c.es_traspaso, 0) AS traspaso,
             SUM(m.centavos) c, COUNT(*) n
        FROM movimientos_caja m
        LEFT JOIN conceptos_gasto c ON c.id = m.concepto_id
       WHERE m.caja_id = ? AND m.anulado_en IS NULL
       GROUP BY m.tipo, COALESCE(c.nombre, m.concepto), COALESCE(c.es_traspaso, 0)
       ORDER BY m.tipo, c DESC
    `).all(cajaId);
    if (!m.length) return [];

    const renglon = (x, tono) => [
      escapar(x.concepto) + (x.n > 1 ? ` <span style="color:#5b6b78">×${x.n}</span>` : ''),
      (x.tipo === 'salida' ? '−' : '+') + dinero(x.c),
      tono
    ];

    const grupos = [];

    // UN RETIRO NO ES UN GASTO, aunque el cajón lo reste igual (v2.7.1).
    // Ese dinero salió del cajón pero no se lo llevó nadie: está en la
    // caja fuerte. Mezclarlo con el diesel haría creer que el turno gastó
    // dos mil pesos, y de ahí a "gastan de más" hay un paso.
    const gastos = m.filter((x) => !x.traspaso);
    const traspasos = m.filter((x) => x.traspaso);

    if (gastos.length) {
      grupos.push({
        titulo: 'En qué se fue',
        filas: gastos.slice(0, 14).map((x) => renglon(x, x.tipo === 'salida' ? 'rojo' : 'verde'))
      });
    }
    if (traspasos.length) {
      grupos.push({
        titulo: 'Salió del cajón, pero no se gastó',
        filas: traspasos.map((x) => renglon(x, 'ambar'))
      });
    }
    return grupos;
  } catch { return []; }
}

module.exports = { AVISOS, catalogo, encendido, clave, mirar, momento, ROLES, aTexto };
