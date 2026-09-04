/**
 * LOS AVISOS QUE NO SALEN DE UN BOTÓN  (v4.9)
 *
 * Tres de los quince avisos no pasan porque alguien haga algo, sino
 * porque pasa el tiempo: el resumen del día, el informe del mes y el
 * producto que se está acabando. A éstos los despierta el reloj de la
 * cola, cada cinco minutos.
 *
 * LO QUE HAY QUE CUIDAR AQUÍ, Y ES TODO
 *
 * Que no se repitan. Un reloj que da la vuelta cada cinco minutos manda
 * el mismo resumen 288 veces al día si no se le pone una marca de "esto
 * ya lo mandé". Por eso cada aviso de aquí deja escrito hasta dónde
 * llegó, y esa marca es lo que decide si sale o no.
 */
const { bd } = require('../../db/conexion');
const { ahora } = require('../../lib/ids');
const { formato } = require('../../lib/dinero');
const { aTexto } = require('../../lib/fracciones');
const periodos = require('../../lib/periodos');
const estadisticas = require('../estadisticas/calculo');
const cola = require('./cola');
const { correo, escapar, dinero } = require('./plantilla');
const { encendido, momento } = require('./avisos');

/** El reloj llama aquí. Nunca lanza: un aviso roto no puede parar nada. */
function revisar() {
  if (!cola.configurado()) return { hizo: [] };
  const hizo = [];
  for (const [nombre, f] of [['inventario', inventarioBajo],
                             ['neveras', neverasSinPedir],
                             ['dia', resumenDelDia],
                             ['mes', informeDelMes]]) {
    try { if (f()) hizo.push(nombre); }
    catch (e) { console.error(`  Aviso «${nombre}»:`, e.message); }
  }
  return { hizo };
}

const hoy = () => new Date().toISOString().slice(0, 10);

// ============================================================
// 1 · PRODUCTO BAJO DE INVENTARIO
// ============================================================

/**
 * AVISA CUANDO ALGO CRUZA SU MÍNIMO, UNA SOLA VEZ.
 *
 * Un producto bajo sigue bajo mañana. Avisar cada media hora hasta que
 * alguien surta convierte el aviso en ruido, y el ruido se apaga: a la
 * tercera vez, este correo se manda a la carpeta de spam y con él se van
 * los catorce avisos que sí importaban.
 *
 * Así que se guarda en `avisos_inventario` de qué ya se avisó, y solo
 * vuelve a avisar si el producto SUBIÓ por encima del mínimo y volvió a
 * bajar. Surtir y volverse a acabar sí es noticia; seguir acabado no.
 */
function inventarioBajo() {
  if (!encendido('inventario_bajo')) {
    // Apagado el aviso, se limpian las marcas: si mañana se prende, tiene
    // que avisar de lo que esté bajo entonces y no callarse por algo que
    // pasó hace tres meses.
    bd.prepare('DELETE FROM avisos_inventario').run();
    return false;
  }

  const { productosBajos } = require('../catalogo/avisos');
  const bajos = productosBajos();
  const ahoraBajos = new Set(bajos.map((p) => p.id));

  // Los que ya se surtieron dejan de estar marcados.
  for (const fila of bd.prepare('SELECT producto_id FROM avisos_inventario').all()) {
    if (!ahoraBajos.has(fila.producto_id)) {
      bd.prepare('DELETE FROM avisos_inventario WHERE producto_id = ?').run(fila.producto_id);
    }
  }

  const yaAvisados = new Set(
    bd.prepare('SELECT producto_id FROM avisos_inventario').all().map((f) => f.producto_id));
  const nuevos = bajos.filter((p) => !yaAvisados.has(p.id));
  if (!nuevos.length) return false;

  for (const p of nuevos) {
    bd.prepare('INSERT INTO avisos_inventario (producto_id, avisado_en, cantidad) VALUES (?, ?, ?)')
      .run(p.id, ahora(), p.quedan);
  }

  const agotados = nuevos.filter((p) => p.agotado);
  const uno = nuevos.length === 1;

  cola.encolar({
    aviso: 'inventario_bajo',
    asunto: uno
      ? `${agotados.length ? 'Se acabó' : 'Queda poco'}: ${nuevos[0].nombre}`
      : `${nuevos.length} productos bajos de inventario`,
    html: correo({
      negocio: cola.negocio(),
      cuando: momento(),
      titulo: agotados.length === nuevos.length && nuevos.length
        ? (uno ? 'Se acabó un producto' : 'Se acabaron varios productos')
        : (uno ? 'Un producto está bajo' : 'Hay productos bajos'),
      entradilla: 'Éstos acaban de bajar de su mínimo. No se vuelve a avisar de ' +
                  'ellos hasta que se surtan y se vuelvan a acabar.',
      grande: uno ? escapar(nuevos[0].nombre) : `${nuevos.length}`,
      color: agotados.length ? 'rojo' : 'ambar',
      renglones: nuevos.slice(0, 20).map((p) => [
        escapar(p.nombre),
        p.agotado ? 'se acabó' : `quedan ${p.quedan}${p.minimo != null ? ` (mínimo ${p.minimo})` : ''}`,
        p.agotado ? 'rojo' : 'ambar'
      ]),
      nota: nuevos.length > 20 ? `Y ${nuevos.length - 20} más.` : null
    })
  });
  return true;
}

// ============================================================
// 2 · LAS NEVERAS QUE NO HAN PEDIDO
// ============================================================

/**
 * LAS QUE LLEVAN MÁS DÍAS SIN PEDIR DE LOS QUE SE LES PUSO.
 *
 * Una vez al día y no cada vez que el reloj da la vuelta: la lista de hoy
 * es casi la misma que la de ayer —una nevera que no pidió sigue sin
 * pedir— y un correo repetido cada cinco minutos acaba en spam con los
 * otros dieciséis avisos detrás.
 *
 * Y por eso es el aviso que más vende de todos: es el único que dice a
 * quién hay que llamarle HOY.
 */
function neverasSinPedir() {
  if (!encendido('nevera_sin_pedir')) return false;

  const dia = hoy();
  if (cola.valor('aviso_nevera_sin_pedir_ultimo', '') === dia) return false;
  cola.guardarValor('aviso_nevera_sin_pedir_ultimo', dia);

  const { pendientesDeTodas } = require('../neveras/calculo');
  const tarde = pendientesDeTodas().sinPedir;
  if (!tarde.length) return false;

  // De la que más se tardó a la que menos: la de arriba es a la que hay
  // que llamarle primero.
  tarde.sort((a, b) => (b.ritmo.dias || 0) - (a.ritmo.dias || 0));
  const una = tarde.length === 1;

  cola.encolar({
    aviso: 'nevera_sin_pedir',
    asunto: una
      ? `${tarde[0].comodato?.quien || `Nevera ${tarde[0].numero}`} lleva ` +
        `${tarde[0].ritmo.dias} días sin pedir`
      : `${tarde.length} neveras llevan días sin pedir`,
    html: correo({
      negocio: cola.negocio(),
      cuando: momento(),
      titulo: una ? 'Una nevera lleva días sin pedir' : 'Hay neveras sin pedir',
      entradilla: 'Éstas pasaron de los días que les pusiste. Son a las que ' +
                  'hay que llamarles hoy.',
      grande: una ? escapar(tarde[0].comodato?.quien || '') : String(tarde.length),
      color: 'ambar',
      renglones: tarde.slice(0, 25).map((n) => [
        `<b>${escapar(n.numero)}</b> ${escapar(n.comodato?.quien || '')}` +
        (n.comodato?.telefono_util ? `<br><span style="color:#5b6b78">${
          escapar(n.comodato.telefono_util)}</span>` : ''),
        n.ritmo.nuncaPidio ? 'nunca ha pedido' : `hace ${n.ritmo.dias} días`,
        'ambar'
      ]),
      nota: (tarde.length > 25 ? `Y ${tarde.length - 25} más. ` : '') +
            'Los días de cada una se cambian en su ficha, en Las neveras.'
    })
  });
  return true;
}

// ============================================================
// 3 · EL RESUMEN DEL DÍA
// ============================================================

/**
 * CÓMO FUE EL DÍA, una vez, a la hora que se diga.
 *
 * Sale a partir de la hora configurada y no antes: a las nueve de la
 * noche el día ya está hecho. Si la computadora estuvo apagada a esa
 * hora, sale en cuanto se encienda —el resumen de ayer sirve igual— y
 * eso lo resuelve la marca: si el último día resumido no es el de hoy y
 * ya pasó la hora, va.
 */
function resumenDelDia() {
  if (!encendido('resumen_dia')) return false;

  const hora = Number(cola.valor('aviso_resumen_dia_hora', '21'));
  const ahoraHora = new Date().getHours();
  const dia = hoy();
  if (cola.valor('aviso_resumen_dia_ultimo', '') === dia) return false;
  if (ahoraHora < (Number.isInteger(hora) ? hora : 21)) return false;

  const rango = { desde: `${dia} 00:00:00`, hasta: `${dia} 23:59:59` };
  const v = estadisticas.ventas(rango);
  const p = estadisticas.produccion(rango);
  const g = estadisticas.gastosDelCajon(rango);
  const hielo = estadisticas.hieloVendido(rango);

  cola.guardarValor('aviso_resumen_dia_ultimo', dia);

  // Un día sin nada no se manda. Un domingo cerrado no es noticia, y un
  // correo que dice "cero, cero, cero" enseña a no abrir los correos.
  if (!v.tickets && !p.producidas && !g.gastado) return false;

  cola.encolar({
    aviso: 'resumen_dia',
    asunto: `El día · ${formato(v.centavos)} en ${v.tickets} ${v.tickets === 1 ? 'ticket' : 'tickets'}`,
    html: correo({
      negocio: cola.negocio(),
      cuando: enLetra(dia),
      titulo: 'Cómo fue el día',
      grande: dinero(v.centavos),
      renglones: [
        { titulo: 'Se vendió', filas: [
          ['Tickets', String(v.tickets)],
          ['En efectivo', dinero(v.contado)],
          v.fiado ? ['Fiado', dinero(v.fiado), 'ambar'] : null,
          ['Por ticket', dinero(v.porTicket)],
          ['Hielo que salió', escapar(aTexto(hielo.dieciseisavos))],
          v.canceladas?.cuantas
            ? ['Tickets cancelados', `${v.canceladas.cuantas} · ${formato(v.canceladas.centavos)}`, 'rojo']
            : null
        ].filter(Boolean) },

        { titulo: 'Se produjo', filas: [
          ['Marquetas', String(p.producidas || 0)],
          ['Salieron enteras', String(p.salieron || 0)],
          p.merma ? ['Se perdieron', String(p.merma), 'rojo'] : null
        ].filter(Boolean) },

        { titulo: 'Se gastó del cajón', filas:
          (g.porConcepto || []).slice(0, 10).map((c) => [
            escapar(c.nombre) + (c.veces > 1 ? ` ×${c.veces}` : ''),
            dinero(c.centavos), 'rojo'
          ]).concat([['Total', dinero(g.gastado), 'rojo']]) }
      ],
      nota: 'Este resumen es del día natural, de las 12 de la noche a las 12 ' +
            'de la noche — no de un turno de caja.'
    })
  });
  return true;
}

function enLetra(dia) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ============================================================
// 4 · EL INFORME DEL MES
// ============================================================

/**
 * EL MES, cuando el mes se cierra.
 *
 * El mes del negocio no es el del calendario: puede ir del 12 al 12, como
 * está puesto en Empresa. Así que se pregunta en qué periodo estamos y,
 * si es distinto al último que se informó, se manda el ANTERIOR — el que
 * acaba de cerrar y ya no va a cambiar.
 */
function informeDelMes() {
  if (!encendido('informe_mes')) return false;

  const actual = periodos.periodoDe();
  const ultimo = cola.valor('aviso_informe_mes_ultimo', '');

  // La primera vez no se manda nada: se apunta dónde estamos y a partir
  // del mes que entra sale solo. Mandar de golpe el informe del mes
  // pasado el día que se prende el aviso confunde más de lo que informa.
  if (!ultimo) { cola.guardarValor('aviso_informe_mes_ultimo', actual.clave); return false; }
  if (ultimo === actual.clave) return false;

  const cerrado = periodos.anterior(actual);
  cola.guardarValor('aviso_informe_mes_ultimo', actual.clave);

  const rango = periodos.instantes(cerrado);
  const v = estadisticas.ventas(rango);
  const p = estadisticas.produccion(rango);
  const costo = estadisticas.costoPorMarqueta(cerrado);
  const luz = estadisticas.luzPorMarqueta(cerrado);
  const clientes = estadisticas.porCliente(rango, 5);

  cola.encolar({
    aviso: 'informe_mes',
    asunto: `Informe de ${cerrado.nombre} · ${formato(v.centavos)}`,
    html: correo({
      negocio: cola.negocio(),
      cuando: cerrado.fechas ? `${cerrado.nombre} · ${cerrado.fechas}` : cerrado.nombre,
      titulo: `Cómo fue ${cerrado.nombre}`,
      grande: dinero(v.centavos),
      renglones: [
        { titulo: 'Se vendió', filas: [
          ['Tickets', String(v.tickets)],
          ['En efectivo', dinero(v.contado)],
          v.fiado ? ['Fiado', dinero(v.fiado), 'ambar'] : null,
          ['Por ticket', dinero(v.porTicket)]
        ].filter(Boolean) },

        { titulo: 'Se produjo', filas: [
          ['Marquetas', String(p.producidas || 0)],
          ['Salieron enteras', String(p.salieron || 0)],
          p.merma ? ['Se perdieron', String(p.merma), 'rojo'] : null
        ].filter(Boolean) },

        { titulo: 'Lo que costó', filas: [
          ['Costo por marqueta', costo.centavos != null ? dinero(costo.centavos) : '—'],
          ['Gastos del cajón', dinero(costo.cajon)],
          ['Gastos de la empresa', dinero(costo.grandes)],
          ['La luz', dinero(costo.luz)],
          costo.rayaCentavos ? ['De eso, sueldos', dinero(costo.rayaCentavos)] : null,
          !costo.completo
            ? ['Ojo', `faltan ${costo.faltanDiasDeLuz} días de recibo de luz`, 'ambar'] : null
        ].filter(Boolean) },

        luz?.kwh ? { titulo: 'La luz', filas: [
          ['Kilowatts', `${Math.round(luz.kwh).toLocaleString('es-MX')} kWh`],
          ['A cómo salió', luz.centavosPorKwh != null ? dinero(luz.centavosPorKwh) : '—'],
          ['Por marqueta', luz.kwhPorMarqueta != null
            ? `${luz.kwhPorMarqueta.toFixed(2)} kWh` : '—']
        ] } : null,

        clientes?.length ? { titulo: 'Quién compró más', filas:
          clientes.map((c) => [escapar(c.nombre), dinero(c.centavos)]) } : null
      ].filter(Boolean),
      nota: 'Los números completos, con sus gráficas, están en <b>Los números</b>.'
    })
  });
  return true;
}

module.exports = { revisar, inventarioBajo, neverasSinPedir, resumenDelDia, informeDelMes };
