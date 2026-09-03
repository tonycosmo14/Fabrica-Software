/**
 * HACER UN VALE  (v4.4)
 *
 * "Los vales se suelen pedir en Vender, ahí es más rápido."
 *
 * Y tiene razón: quien llega a llevarse el efectivo llega al mostrador, no
 * a la pantalla de Caja. Así que el mismo vale se hace desde los dos sitios
 * — y para que se hagan IGUAL desde los dos, está escrito una sola vez
 * aquí. Dos copias del mismo flujo se separan en la tercera corrección.
 *
 * Son tres toques: cuál de los dos vales, quién, y cuánto.
 */
import { api } from './api.js';
import { avisar } from './util.js';
import { pedirImporte, confirmar, menu } from './dialogo.js';
import { pesos } from './fracciones.js';
import { imprimirTicket, htmlDeEspejo } from './imprimir.js';

/**
 * Pregunta y hace el vale. Devuelve el vale creado, o `null` si se canceló
 * o algo falló — quien llama decide si repintar.
 */
export async function hacerVale() {
  let datos;
  try {
    datos = await api.obtener('/caja/vales');
  } catch (err) { avisar(err.message, 'error'); return null; }

  // LO PRIMERO ES CUÁL DE LOS DOS, con la diferencia escrita en el mismo
  // botón: se llaman igual y son opuestos, y nadie tiene por qué acordarse
  // de memoria cuál deja deuda y cuál no.
  const clase = await menu({
    titulo: 'Vale',
    texto: '¿Cuál de los dos?',
    opciones: [
      { valor: 'retiro', texto: '🏦 Se llevaron dinero',
        detalle: 'El dueño o un gerente, para que no se junte mucho. Nadie queda debiendo.' },
      { valor: 'raya', texto: '🧑‍🏭 Vale de sueldo',
        detalle: 'Parte de su sueldo de la semana, pedida antes. El día de pago se le da de menos.' }
    ]
  });
  if (!clase) return null;

  const gente = datos.gente?.[clase] || [];
  if (!gente.length) {
    avisar(clase === 'retiro'
      ? 'No hay ningún gerente ni administrador dado de alta.'
      : 'No hay nadie dado de alta.', 'error');
    return null;
  }

  // QUIÉN SE LO LLEVÓ, y es obligatorio: un vale sin nombre no es un vale,
  // es un faltante. Se pregunta ANTES del importe porque es lo que se tiene
  // enfrente —la persona— y el número viene después.
  const quienId = await menu({
    titulo: clase === 'retiro' ? '¿Quién se llevó el dinero?' : '¿A quién es el vale?',
    texto: clase === 'retiro'
      ? 'Aunque no sea quien está en la computadora: el papel sale con los dos nombres.'
      : 'Se le apunta en su ficha para descontárselo el día que se le pague.',
    opciones: gente.map((u) => ({ valor: u.id, texto: u.nombre }))
  });
  if (!quienId) return null;

  const quien = gente.find((u) => u.id === quienId);
  const monto = await pedirImporte({
    titulo: quien?.nombre || 'Vale',
    texto: '¿Cuánto se llevó?',
    ok: 'Hacer el vale',
    ayuda: clase === 'raya'
      ? 'Sale del cajón hoy y se le descuenta de su sueldo de esta semana.'
      : 'Sale del cajón, pero no es un gasto de la fábrica: el dinero cambió de sitio.'
  });
  if (!monto) return null;

  // UN CERO DE MÁS. Nadie se lleva más dinero del que hay en el cajón, así
  // que un vale más grande que el turno casi siempre es $15,000 tecleado
  // donde iban $1,500. No se prohíbe —el cajón puede ir atrasado— pero se
  // pregunta, que es lo que hubiera evitado el error.
  const hayEnCajon = await loQueHayEnElCajon();
  const pedido = Math.round(Number(String(monto).replace(/[^0-9.]/g, '')) * 100);
  if (hayEnCajon !== null && Number.isFinite(pedido) && pedido > hayEnCajon) {
    const seguir = await confirmar({
      titulo: '¿Seguro que es tanto?',
      texto: `En el cajón hay ${pesos(hayEnCajon)} y este vale es de ` +
             `${pesos(pedido)}. El turno va a quedar en números rojos.`,
      ok: 'Sí, es correcto'
    });
    if (!seguir) return null;
  }

  let creado;
  try {
    creado = await api.enviar('/caja/vales', { clase, monto, ejecutorId: quienId });
  } catch (err) { avisar(err.message, 'error'); return null; }

  await imprimirElVale(creado.movimientoId);
  return creado;
}

/** Lo que debería haber en el cajón ahora, o null si no se pudo preguntar. */
async function loQueHayEnElCajon() {
  try {
    return (await api.obtener('/caja')).abierta?.esperado ?? null;
  } catch { return null; }
}

/**
 * EL PAPEL ES EL VALE.
 *
 * Si la impresora no contesta, el vale YA está anotado —el dinero salió— y
 * lo que se avisa es que falta el papel, no que falló el vale. Sin térmica
 * lo saca el navegador, igual que el ticket de una venta: nadie se lleva
 * dinero del cajón sin dejar firma.
 */
async function imprimirElVale(movimientoId) {
  if (!movimientoId) return;
  try {
    const r = await api.enviar(`/impresion/movimiento/${movimientoId}`, {});
    if (r.impreso) {
      return avisar('Vale hecho. Que lo firme.', 'bien');
    }
  } catch {
    return avisar('Vale anotado, pero no se pudo imprimir. Vuelve a sacarlo con 🖨️.', 'aviso');
  }

  try {
    const { renglones, ancho } = await api.obtener(`/impresion/movimiento/${movimientoId}/previa`);
    imprimirTicket(htmlDeEspejo(renglones, ancho));
    avisar('Vale hecho. Sale por la impresora del navegador.', 'bien');
  } catch {
    avisar('Vale anotado. No hay impresora: escríbanlo a mano.', 'aviso');
  }
}
