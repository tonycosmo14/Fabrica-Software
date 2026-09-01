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

/**
 * LOS ACENTOS, en la tabla que de verdad usa la impresora.
 *
 * Aquí había un error viejo y silencioso: el texto se mandaba en latin1 y a
 * la impresora se le decía "usa la tabla 2", que es la CP850. No son la
 * misma. En latin1 la í es el byte 0xED; en CP850 ese byte es una Ý. Así
 * que "Cuarto frío" salía impreso "Cuarto frÝo" y nadie sabía por qué.
 *
 * Esta tabla dice, para cada letra que lleva acento en español, qué byte le
 * corresponde en CP850. Lo que no esté aquí y no quepa en un byte se sigue
 * quedando sin acento, que es mejor que un cuadrito negro.
 */
const CP850 = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85,
  'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c,
  'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f, 'É': 0x90, 'ô': 0x93, 'ö': 0x94,
  'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a,
  'ø': 0x9b, '£': 0x9c, 'Ø': 0x9d, '×': 0x9e,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5,
  'ª': 0xa6, 'º': 0xa7, '¿': 0xa8, '¬': 0xaa, '½': 0xab, '¼': 0xac,
  '¡': 0xad, '«': 0xae, '»': 0xaf,
  'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, '©': 0xb8,
  'ã': 0xc6, 'Ã': 0xc7,
  'ð': 0xd0, 'Ð': 0xd1, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, 'Í': 0xd6,
  'Î': 0xd7, 'Ï': 0xd8,
  'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5,
  'µ': 0xe6, 'þ': 0xe7, 'Þ': 0xe8, 'Ú': 0xe9, 'Û': 0xea, 'Ù': 0xeb,
  'ý': 0xec, 'Ý': 0xed, '¯': 0xee, '´': 0xef,
  '±': 0xf1, '¾': 0xf3, '¶': 0xf4, '§': 0xf5, '÷': 0xf6, '°': 0xf8,
  '¨': 0xf9, '·': 0xfa, '¹': 0xfb, '³': 0xfc, '²': 0xfd
};

/**
 * Signos de imprenta que la impresora dibuja mal, y con qué se cambian.
 * Son los que se cuelan al copiar de un documento o los que pone el propio
 * sistema al armar un desglose: "2 × 1/4".
 */
const EQUIVALENTES = {
  '×': 'x', '÷': '/', '‐': '-', '‑': '-', '‒': '-',
  '–': '-', '—': '-', '―': '-', '−': '-',
  '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...'
};

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
    // EL ESPEJO: los mismos renglones que van a la impresora, pero como
    // datos —texto, alineación, negrita, tamaño—. Con él la pantalla puede
    // pintar el ticket TAL CUAL sin gastar papel ni reimplementar nada:
    // si un día cambia el diseño del papel, la pantalla cambia sola.
    this.espejo = [];
    this.estilo = { alin: 'izquierda', negrita: false, anchoLetra: 1, altoLetra: 1 };
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
   *
   * Antes pasan los signos de imprenta que SÍ existen en latin1 pero que en
   * la tabla de la impresora son otra cosa: el "×" de "2 × 1/4" sale como
   * una cruz de rayitas, y las comillas curvas como letras raras. Se
   * cambian por su versión de máquina de escribir.
   */
  texto(cadena = '') {
    const limpio = String(cadena)
      .normalize('NFC')
      .replace(/[×÷‐-―‘’“”…−]/g, (c) => EQUIVALENTES[c] || c);

    const bytes = [];
    for (const letra of limpio) {
      const codigo = letra.codePointAt(0);

      // Lo de siempre —letras, números, signos— es igual en todas las
      // tablas y va tal cual.
      if (codigo < 0x80) { bytes.push(codigo); continue; }

      // Los acentos, por su byte de CP850, que es la tabla que se le pidió
      // a la impresora en el arranque (ESC t 2).
      if (CP850[letra] !== undefined) { bytes.push(CP850[letra]); continue; }

      // Lo que no está en la tabla se queda sin acento: más vale
      // "Panaderia" que un cuadrito negro.
      const pelado = letra.normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const l of pelado) {
        const c = l.codePointAt(0);
        bytes.push(c < 0x80 ? c : (CP850[l] ?? 0x3f));   // 0x3f = '?'
      }
    }

    this.partes.push(Buffer.from(bytes));
    return this;
  }

  /** Un renglón de texto y su salto. */
  linea(cadena = '') {
    this.espejo.push({ t: String(cadena), ...this.estiloActual() });
    return this.texto(cadena).crudo([0x0a]);
  }

  /** Renglones en blanco. */
  saltos(n = 1) {
    for (let i = 0; i < n; i++) this.espejo.push({ t: '', ...this.estiloActual() });
    return this.crudo(new Array(n).fill(0x0a));
  }

  /** El estilo vigente, aplanado para el espejo. */
  estiloActual() {
    const e = this.estilo;
    return { alin: e.alin, negrita: e.negrita, anchoLetra: e.anchoLetra, altoLetra: e.altoLetra };
  }

  izquierda() { this.estilo.alin = 'izquierda'; return this.crudo([ESC, 0x61, 0]); }
  centro()    { this.estilo.alin = 'centro';    return this.crudo([ESC, 0x61, 1]); }
  derecha()   { this.estilo.alin = 'derecha';   return this.crudo([ESC, 0x61, 2]); }

  negrita(si = true) { this.estilo.negrita = Boolean(si); return this.crudo([ESC, 0x45, si ? 1 : 0]); }

  /**
   * Tamaño de letra. GS ! guarda el ancho en los 4 bits de arriba y el alto
   * en los de abajo, y cuenta desde 0: para el doble se manda 1.
   */
  tamano(ancho = 1, alto = 1) {
    const a = Math.min(Math.max(ancho, 1), 8) - 1;
    const b = Math.min(Math.max(alto, 1), 8) - 1;
    this.estilo.anchoLetra = a + 1;
    this.estilo.altoLetra = b + 1;
    return this.crudo([GS, 0x21, (a << 4) | b]);
  }

  normal() { return this.tamano(1, 1).negrita(false); }

  /** Una raya de guiones de lado a lado. */
  separador(caracter = '-') {
    return this.linea(caracter.repeat(this.ancho));
  }

  /**
   * UNA RAYA CON SU TÍTULO DENTRO:
   *
   *     -- GASTOS (3) ---------------------------------
   *
   * La raya ya estaba y el título ya estaba, cada uno en su renglón. Juntos
   * hacen el mismo trabajo —decir dónde empieza un bloque— y cuestan la
   * mitad. En el corte, que tiene tres bloques, son tres renglones.
   */
  separadorConTitulo(titulo, caracter = '-') {
    const texto = String(titulo).trim();
    if (!texto) return this.separador(caracter);
    const cabe = this.ancho - texto.length - 4;
    if (cabe < 2) return this.linea(texto.slice(0, this.ancho));
    return this.linea(`${caracter.repeat(2)} ${texto} ${caracter.repeat(cabe)}`);
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

  /**
   * UN RENGLÓN CON PUNTITOS EN MEDIO.
   *
   *     2 Coca 600 ........................... $50.00
   *
   * Es como se ha hecho una cuenta de papel desde siempre, y no es adorno:
   * los puntos son los que llevan el ojo del nombre a su precio sin que se
   * salte de renglón. En una tira de ocho conceptos eso se nota.
   */
  punteado(izquierda, derecha, caracter = '.') {
    const der = String(derecha);
    // El renglón mide: izquierda + espacio + puntos + espacio + derecha.
    // Así que a la izquierda le tocan las columnas que sobran DESPUÉS de
    // reservar el importe, los dos espacios y al menos un punto. Aquí había
    // un desbordamiento de una columna: se recortaba dejando sitio para
    // cero puntos y luego se forzaba uno, y el renglón salía de 49.
    const tope = Math.max(this.ancho - der.length - 3, 0);
    const izq = String(izquierda).slice(0, tope);
    const puntos = Math.max(this.ancho - izq.length - der.length - 2, 1);
    return this.linea(`${izq} ${caracter.repeat(puntos)} ${der}`);
  }

  /**
   * EL BLOQUE DE TOTALES, PEGADO A LA DERECHA.
   *
   *                                       TOTAL:  $230.00
   *                                       PAGO:   $500.00
   *                                       CAMBIO: $270.00
   *
   * Se pasan todos los pares juntos —no uno por uno— porque el ancho de la
   * etiqueta y el del importe se calculan mirando TODOS: así los dos puntos
   * quedan en la misma columna y los pesos también. Renglón por renglón
   * cada uno se alinearía por su cuenta y el bloque saldría escalonado.
   */
  bloqueDerecha(pares) {
    const filas = pares.filter(Boolean);
    if (!filas.length) return this;
    const importe = Math.max(...filas.map((f) => String(f[1]).length));
    // La etiqueta se queda con lo que sobre del papel una vez apartado el
    // importe. Si no se recorta, con cifras de siete dígitos el renglón se
    // sale y la impresora lo parte en dos por donde le toca.
    const sitio = Math.max(this.ancho - importe - 1, 4);
    const etiqueta = Math.min(Math.max(...filas.map((f) => String(f[0]).length)), sitio);
    const margen = Math.max(this.ancho - etiqueta - importe - 1, 0);
    for (const [a, b] of filas) {
      this.linea(' '.repeat(margen)
        + String(a).slice(0, etiqueta).padEnd(etiqueta) + ' '
        + String(b).padStart(importe));
    }
    return this;
  }

  /**
   * Un texto largo cortado por palabras, que es como se lee.
   * Una palabra más larga que el renglón se parte a la fuerza: más vale
   * partida que empujando todo lo demás fuera del papel.
   */
  parrafo(texto, { sangria = 0 } = {}) {
    const util = Math.max(this.ancho - sangria, 8);
    const hueco = ' '.repeat(sangria);
    let linea = '';

    const soltar = () => { if (linea) { this.linea(hueco + linea); linea = ''; } };

    for (let palabra of String(texto ?? '').split(/\s+/).filter(Boolean)) {
      while (palabra.length > util) {
        soltar();
        this.linea(hueco + palabra.slice(0, util));
        palabra = palabra.slice(util);
      }
      if (!linea) linea = palabra;
      else if (linea.length + 1 + palabra.length <= util) linea += ' ' + palabra;
      else { soltar(); linea = palabra; }
    }
    soltar();
    return this;
  }

  /**
   * LA RAYA PARA FIRMAR, en un solo renglón: el letrero delante y la raya
   * detrás, como en cualquier recibo de papel.
   *
   * Antes eran CUATRO renglones —dos en blanco, la raya centrada y el
   * letrero debajo—, o sea 12 mm en papeles que salen dos y tres veces al
   * día. Se firma SOBRE la raya, así que aquellos dos renglones en blanco
   * eran margen y no sitio para firmar: queda uno, que separa la firma de
   * lo que va arriba, y la raya llega hasta la orilla del papel, o sea que
   * hay MÁS sitio para firmar que antes, no menos.
   */
  firma(etiqueta = 'FIRMA') {
    this.saltos(1).izquierda();
    const letrero = `${etiqueta}: `;
    const hueco = this.ancho - letrero.length;

    // Con un letrero largo no quedaría raya donde firmar —o peor, se
    // saldría del papel—. Ahí sí valen dos renglones: el letrero arriba y
    // la raya debajo, de orilla a orilla.
    if (hueco < 14) {
      this.parrafo(etiqueta);
      return this.linea('_'.repeat(this.ancho));
    }
    return this.linea(letrero + '_'.repeat(hueco));
  }

  /**
   * CORTA EL PAPEL.
   *
   * `avance` son los renglones en blanco que se mandan antes de la cuchilla,
   * y valen dinero: cuatro renglones son 12 mm en cada ticket, o sea metros
   * de papel al mes. Se configura en Sistema porque depende de la impresora
   * (ver `avanceCorte` en impresora.js) y no hay forma de adivinarlo: se
   * prueba, se mira el papel, y si la cuchilla se comió el último renglón se
   * sube uno.
   */
  cortar(avance = 4) {
    const n = Math.min(Math.max(Number(avance) || 0, 0), 8);
    if (n) this.saltos(n);
    return this.crudo([GS, 0x56, 0x42, 0x00]);
  }

  /**
   * ABRE EL CAJÓN DEL DINERO.
   *
   * El cajón no tiene cerebro: es un solenoide con un cable RJ11 metido en
   * la impresora. La impresora le manda un pulso de corriente y el resorte
   * lo dispara. El comando es ESC p m t1 t2:
   *
   *   m   por cuál de las dos salidas: 0 es el pin 2, 1 es el pin 5.
   *       Casi todos los cajones van en el 2, pero hay quien usa el 5, y
   *       por eso se puede elegir: si no abre, es lo primero que se prueba.
   *   t1  cuánto dura el pulso   (×2 ms)
   *   t2  cuánto espera después  (×2 ms)
   *
   * 25 y 250 son los valores de siempre: 50 ms de pulso. Un pulso corto no
   * alcanza a mover el resorte y uno largo calienta la bobina.
   */
  abrirCajon(salida = 0) {
    return this.crudo([ESC, 0x70, salida === 5 || salida === 1 ? 0x01 : 0x00, 0x19, 0xfa]);
  }

  bytes() {
    const b = Buffer.concat(this.partes);
    // El espejo viaja pegado a los bytes: quien imprime lo ignora, y quien
    // quiere enseñar el ticket en pantalla lo lee de aquí mismo.
    b.espejo = this.espejo;
    b.anchoTicket = this.ancho;
    return b;
  }
}

module.exports = { Ticket, columnas };
