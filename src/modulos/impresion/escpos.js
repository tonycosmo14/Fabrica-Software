/**
 * ESC/POS — el idioma de las impresoras térmicas  (v0.11)
 *
 * POR QUÉ ESTO EXISTE
 *
 * Una página web no puede hablarle a la impresora. Cuando el navegador
 * imprime, arma una hoja, la manda a su motor de impresión y de ahí al
 * driver: por rápido que sea, la vista previa aparece un instante. Los
 * programas de punto de venta de verdad no hacen eso: le mandan a la
 * impresora una tira de BYTES con las órdenes que ella entiende, y sale al
 * instante porque no hay nada en medio.
 *
 * Eso es ESC/POS. Cada orden empieza con un carácter de control:
 *
 *   ESC @      despierta la impresora y la deja como recién encendida
 *   ESC a n    alinea: 0 izquierda, 1 centro, 2 derecha
 *   ESC E n    negritas sí/no
 *   GS  ! n    tamaño de letra (alto y ancho, de 1 a 8 veces)
 *   GS  V m    corta el papel
 *   ESC p      abre el cajón de dinero
 *
 * Este archivo solo construye la tira de bytes. Mandarla a la impresora es
 * trabajo de impresora.js.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** Cuántas letras caben por renglón según el ancho del papel. */
function columnas(anchoMm) {
  return Number(anchoMm) <= 58 ? 32 : 48;
}

/**
 * Constructor de tickets. Se encadena:
 *
 *   new Ticket(80).centro().doble().texto('3/4').cortar().bytes()
 */
class Ticket {
  constructor(anchoMm = 80, codigoPagina = 2) {
    this.ancho = columnas(anchoMm);
    this.partes = [];
    // ESC @ deja la impresora en un estado conocido: si el ticket anterior
    // se cortó a la mitad, el siguiente no hereda letra gigante.
    this.crudo([ESC, 0x40]);
    // ESC t n elige la tabla de acentos. La 2 (CP850) trae la ñ y las
    // vocales acentuadas en casi todas las térmicas.
    this.crudo([ESC, 0x74, codigoPagina]);
  }

  crudo(bytes) {
    this.partes.push(Buffer.from(bytes));
    return this;
  }

  /**
   * El texto va en latin1 porque es lo que entienden estas tablas. Lo que
   * no exista en la tabla se cambia por su letra sin acento: más vale
   * "Panaderia" que un cuadrito negro.
   */
  texto(cadena = '') {
    const limpio = String(cadena)
      .normalize('NFC')
      .replace(/[^\x00-\xFF]/g, (c) =>
        c.normalize('NFD').replace(/[̀-ͯ]/g, '') || '?');
    this.partes.push(Buffer.from(limpio, 'latin1'));
    return this;
  }

  /** Un renglón de texto y su salto. */
  linea(cadena = '') {
    return this.texto(cadena).crudo([0x0a]);
  }

  /** Renglones en blanco. */
  saltos(n = 1) {
    return this.crudo(new Array(n).fill(0x0a));
  }

  izquierda() { return this.crudo([ESC, 0x61, 0]); }
  centro()    { return this.crudo([ESC, 0x61, 1]); }
  derecha()   { return this.crudo([ESC, 0x61, 2]); }

  negrita(si = true) { return this.crudo([ESC, 0x45, si ? 1 : 0]); }

  /**
   * Tamaño de letra. GS ! guarda el ancho en los 4 bits de arriba y el alto
   * en los de abajo, y cuenta desde 0: para el doble se manda 1.
   */
  tamano(ancho = 1, alto = 1) {
    const a = Math.min(Math.max(ancho, 1), 8) - 1;
    const b = Math.min(Math.max(alto, 1), 8) - 1;
    return this.crudo([GS, 0x21, (a << 4) | b]);
  }

  normal() { return this.tamano(1, 1).negrita(false); }

  /** Una raya de guiones de lado a lado. */
  separador(caracter = '-') {
    return this.linea(caracter.repeat(this.ancho));
  }

  /**
   * Un renglón con el concepto a la izquierda y el importe a la derecha,
   * como en una cuenta de papel. Si el concepto no cabe, se recorta: más
   * vale un nombre a medias que un renglón partido que desalinea todo.
   */
  columnas2(izquierda, derecha) {
    const der = String(derecha);
    const hueco = this.ancho - der.length - 1;
    const izq = String(izquierda).slice(0, Math.max(hueco, 0));
    const relleno = ' '.repeat(Math.max(this.ancho - izq.length - der.length, 1));
    return this.linea(izq + relleno + der);
  }

  /** Tres columnas: para el renglón de folio, fecha y cajero. */
  columnas3(izquierda, centro, derecha) {
    const izq = String(izquierda);
    const cen = String(centro);
    const der = String(derecha);
    const sobra = this.ancho - izq.length - cen.length - der.length;
    if (sobra < 2) return this.columnas2(`${izq} ${cen}`, der);
    const a = Math.floor(sobra / 2);
    return this.linea(izq + ' '.repeat(a) + cen + ' '.repeat(sobra - a) + der);
  }

  /** Corta el papel dejando margen para que se pueda arrancar. */
  cortar() {
    return this.saltos(4).crudo([GS, 0x56, 0x42, 0x00]);
  }

  /** Abre el cajón del dinero (el pulso que espera la mayoría). */
  abrirCajon() {
    return this.crudo([ESC, 0x70, 0x00, 0x19, 0xfa]);
  }

  bytes() {
    return Buffer.concat(this.partes);
  }
}

module.exports = { Ticket, columnas };
