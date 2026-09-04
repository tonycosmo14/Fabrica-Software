/**
 * EL CONTRATO DE COMODATO  (v5.1)
 *
 * "Necesito que tengas una plantilla bien redactada de un comodato,
 *  busca cómo deben ser y redáctala todo a favor de la fábrica, para que
 *  se hagan de manera automática cuando rellene los datos del cliente y
 *  la nevera."
 *
 * Aquí está la plantilla, con sus huecos, y el código que la rellena y la
 * saca en hoja tamaño carta lista para firmar.
 *
 * ── LO QUE HAY QUE SABER ANTES DE USARLA ──
 *
 * ESTE TEXTO NO ESTÁ REVISADO POR UN ABOGADO. Está redactado siguiendo la
 * figura del comodato del Código Civil —un préstamo gratuito de una cosa
 * que se devuelve la misma— y cubre lo que suele cubrir un contrato de
 * estos. Pero es un documento que se firma con clientes de verdad, y
 * antes de usarlo con el primero conviene que lo lea un abogado de
 * Yucatán. Cuesta poco y evita el problema de descubrir el día del pleito
 * que la cláusula que más importaba no valía.
 *
 * Y una advertencia sobre "todo a favor de la fábrica": un contrato
 * demasiado cargado de un lado se puede caer entero. Las tres cláusulas
 * donde eso pasa más seguido —y que conviene que el abogado mire— son la
 * pena por no devolver, la responsabilidad por robo, y la exclusividad.
 * Están marcadas con un comentario en el texto de abajo.
 *
 * ── POR QUÉ EL TEXTO ES CONFIGURABLE ──
 *
 * Vive en `configuracion` y no en este archivo, para que se pueda cambiar
 * sin una actualización del programa: el día que el abogado corrija una
 * frase, se pega el texto nuevo en Sistema y listo. Este archivo solo
 * trae el que viene de fábrica.
 */
const { bd } = require('../../db/conexion');
const { formato } = require('../../lib/dinero');

const CLAVE = 'nevera_texto_comodato';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ============================================================
// LA PLANTILLA
// ============================================================

const PLANTILLA = `CONTRATO DE COMODATO

Contrato de comodato que celebran, por una parte {negocio}, representada
en este acto por {representante}, a quien en lo sucesivo se le denominará
EL COMODANTE; y por la otra parte {cliente}, por conducto de
{responsable}, a quien en lo sucesivo se le denominará EL COMODATARIO; al
tenor de las siguientes declaraciones y cláusulas.

DECLARACIONES

PRIMERA. Declara EL COMODANTE ser legítimo propietario del bien mueble
que se describe en la cláusula primera de este contrato, y que el mismo se
encuentra libre de todo gravamen y en buen estado de funcionamiento.

SEGUNDA. Declara EL COMODATARIO que es su voluntad recibir en comodato el
bien descrito, que lo recibe a su entera satisfacción y en el estado que
guarda, y que cuenta con el domicilio y las condiciones necesarias para su
debida conservación.

TERCERA. Declaran ambas partes que se reconocen mutuamente la personalidad
con que se ostentan, y que en la celebración de este contrato no existe
error, dolo, violencia ni mala fe.

CLAUSULAS

PRIMERA. DEL BIEN. EL COMODANTE entrega en comodato a EL COMODATARIO, y
este lo recibe de conformidad, el siguiente bien mueble:

    Equipo:        Congelador para conservacion de hielo
    Numero:        {nevera_numero}
    Marca:         {nevera_marca}
    Modelo:        {nevera_modelo}
    Numero serie:  {nevera_serie}
    Capacidad:     {nevera_bolsas}
    Valor:         {nevera_valor}

El valor señalado es el que las partes reconocen para todos los efectos de
este contrato, incluida la reparación del daño en los supuestos previstos
en las cláusulas SEXTA y SEPTIMA.

SEGUNDA. GRATUIDAD. El presente comodato se otorga a título gratuito, por
lo que EL COMODATARIO no pagará renta ni contraprestación alguna por el uso
del bien. La entrega no transmite la propiedad ni derecho real alguno: EL
COMODANTE conserva en todo momento la propiedad del bien.

TERCERA. DESTINO DEL BIEN. EL COMODATARIO se obliga a destinar el bien
exclusivamente a la conservación y exhibición de los productos de hielo
suministrados por EL COMODANTE. Queda expresamente prohibido almacenar en
él productos de terceros, productos distintos al hielo, o cualquier
sustancia que pueda dañarlo o contaminarlo.

    /* Ésta es la cláusula de exclusividad. Es la costumbre en este tipo
       de contratos y es defendible porque el equipo se presta gratis
       precisamente por eso; conviene que el abogado confirme cómo
       redactarla para que no se lea como una restricción al comercio. */

CUARTA. DOMICILIO Y TRASLADO. El bien permanecerá en el domicilio ubicado
en {direccion}. EL COMODATARIO no podrá cambiarlo de domicilio, prestarlo,
subarrendarlo, darlo en garantía ni transferir su uso a un tercero, sin
autorización previa y por escrito de EL COMODANTE. Cualquier traslado
autorizado será por cuenta y riesgo de EL COMODATARIO.

QUINTA. CONSERVACION. Son a cargo de EL COMODATARIO los gastos ordinarios
que exija el uso del bien, incluyendo la energía eléctrica, la limpieza y
el mantenimiento menor. EL COMODATARIO se obliga a conservarlo con la
diligencia de un buen padre de familia, a colocarlo en un lugar ventilado,
seco y protegido, y a conectarlo a una instalación eléctrica en buen
estado y con la tensión adecuada.

SEXTA. DAÑOS. EL COMODATARIO responderá de los daños que sufra el bien por
su culpa, negligencia o uso indebido, así como de los que resulten de
haberlo destinado a un uso distinto del pactado o de haberlo conservado en
su poder por más tiempo del convenido. No responderá del deterioro que
resulte del uso normal y ordinario del bien.

SEPTIMA. PERDIDA O ROBO. En caso de pérdida, robo o extravío del bien, EL
COMODATARIO deberá dar aviso a EL COMODANTE dentro de las cuarenta y ocho
horas siguientes al hecho, y presentar copia de la denuncia
correspondiente cuando proceda. De no acreditarse el caso fortuito o la
fuerza mayor, EL COMODATARIO cubrirá a EL COMODANTE el valor señalado en
la cláusula PRIMERA.

    /* Ésta es la cláusula de robo, y es la que un juez mira con más
       cuidado. Tal como está redactada respeta el caso fortuito, que es
       lo que la hace sostenible; una redacción que responsabilice al
       cliente incluso del robo con violencia se puede caer entera. */

OCTAVA. FALLAS Y REPARACIONES. Las reparaciones derivadas del uso normal
del bien serán por cuenta de EL COMODANTE. EL COMODATARIO se obliga a dar
aviso a EL COMODANTE de cualquier falla dentro de los tres días siguientes
a que la advierta, y a no permitir que persona distinta a la designada por
EL COMODANTE intervenga o repare el equipo. La reparación hecha por un
tercero sin autorización libera a EL COMODANTE de toda responsabilidad
posterior sobre el equipo.

NOVENA. INSPECCION. EL COMODANTE, por conducto de la persona que designe,
podrá verificar el estado, la ubicación y el uso del bien en cualquier
momento, dentro del horario ordinario de operación de EL COMODATARIO,
quien se obliga a permitir el acceso para tal efecto.

DECIMA. VIGENCIA Y DEVOLUCION. El presente contrato tendrá una vigencia
{vigencia}. EL COMODANTE podrá dar por terminado el contrato en cualquier
momento y solicitar la devolución del bien, mediante aviso dado a EL
COMODATARIO con {dias_aviso} días naturales de anticipación. EL
COMODATARIO devolverá el bien en el mismo estado en que lo recibió, salvo
el deterioro por el uso normal, en el domicilio de EL COMODANTE o en el
lugar que este indique.

DECIMA PRIMERA. INCUMPLIMIENTO EN LA DEVOLUCION. Si al término del plazo
señalado en el aviso EL COMODATARIO no ha devuelto el bien, EL COMODANTE
podrá recogerlo directamente y EL COMODATARIO se obliga a permitirlo. De
resultar imposible la recuperación por causa imputable a EL COMODATARIO,
este cubrirá el valor del bien señalado en la cláusula PRIMERA.

    /* Ésta es la cláusula de la pena. Está redactada como reparación del
       valor del bien y no como una multa, que es lo que la hace más
       defendible. Si se le quiere agregar una pena adicional por día de
       retraso, que sea el abogado quien fije el monto: una pena
       desproporcionada la anula un juez. */

DECIMA SEGUNDA. AUSENCIA DE RELACION LABORAL. Este contrato no genera
relación laboral, de asociación ni de representación entre las partes. EL
COMODATARIO no podrá ostentarse como distribuidor, franquiciatario ni
representante de EL COMODANTE.

DECIMA TERCERA. DOMICILIOS. Las partes señalan como domicilios para oír y
recibir notificaciones los siguientes:

    EL COMODANTE:    {domicilio_negocio}
    EL COMODATARIO:  {direccion}

DECIMA CUARTA. JURISDICCION. Para la interpretación y cumplimiento de este
contrato, las partes se someten expresamente a las leyes aplicables y a la
jurisdicción de los tribunales competentes de {jurisdiccion}, renunciando a
cualquier otro fuero que pudiera corresponderles por razón de sus
domicilios presentes o futuros.

Leído que fue el presente contrato y enteradas las partes de su contenido y
alcance legal, lo firman por duplicado en {lugar}, el dia {fecha_letra}.


      EL COMODANTE                          EL COMODATARIO


  ______________________            ______________________
  {representante}                   {responsable}
  {negocio}                         {cliente}


                    TESTIGO


                ______________________
`;

// ============================================================
// RELLENARLA
// ============================================================

function ajuste(clave, siNoHay = '') {
  return bd.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)?.valor ?? siNoHay;
}

/** El texto vigente. El de fábrica si nadie lo ha cambiado. */
function texto() {
  const guardado = ajuste(CLAVE, '').trim();
  return guardado || PLANTILLA;
}

/** "cuatro de septiembre de dos mil veintiséis" no; la fecha, legible. */
function fechaLarga(d = new Date()) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * LOS HUECOS QUE SE RELLENAN.
 *
 * Un hueco sin dato se queda como una raya y NO como la palabra vacía: en
 * un contrato, un espacio en blanco se llena a mano antes de firmar, y una
 * frase a la que le falta un pedazo sin que se note es peor que un hueco
 * evidente.
 */
function huecos({ nevera, comodato, negocio }) {
  const raya = '________________';
  const oNada = (v) => (v == null || String(v).trim() === '' ? raya : String(v).trim());

  const vigencia = comodato?.hasta_previsto
    ? `del ${comodato.desde} al ${comodato.hasta_previsto}`
    : 'indefinida, a partir de la fecha de su firma';

  return {
    negocio: oNada(negocio?.nombre),
    representante: oNada(negocio?.representante),
    domicilio_negocio: oNada(negocio?.domicilio),
    jurisdiccion: oNada(negocio?.jurisdiccion),
    lugar: oNada(negocio?.lugar || negocio?.jurisdiccion),

    cliente: oNada(comodato?.quien),
    responsable: oNada(comodato?.responsable || comodato?.quien),
    direccion: oNada(comodato?.direccion),
    telefono: oNada(comodato?.telefono),

    nevera_numero: oNada(nevera?.numero),
    nevera_marca: oNada(nevera?.marca),
    nevera_modelo: oNada(nevera?.modelo),
    nevera_serie: oNada(nevera?.serie),
    nevera_bolsas: nevera?.bolsas ? `${nevera.bolsas} bolsas` : raya,
    nevera_valor: nevera?.costo_centavos ? formato(nevera.costo_centavos) : raya,

    vigencia,
    dias_aviso: String(Number(ajuste('nevera_dias_devolucion', '15')) || 15),
    fecha_letra: fechaLarga(),
    fecha: new Date().toISOString().slice(0, 10)
  };
}

/** Cambia cada {hueco} por lo suyo. Lo que no exista se deja tal cual. */
function rellenar(plantilla, datos) {
  return String(plantilla).replace(/\{(\w+)\}/g,
    (todo, clave) => (clave in datos ? datos[clave] : todo));
}

/** Los datos de la fábrica que entran en el contrato. */
function negocioDelContrato() {
  return {
    nombre: ajuste('nombre_negocio', 'Hielo LOLHA'),
    representante: ajuste('negocio_representante', ''),
    domicilio: ajuste('negocio_domicilio', ''),
    jurisdiccion: ajuste('negocio_jurisdiccion', 'Hunucmá, Yucatán'),
    lugar: ajuste('negocio_lugar', 'Hunucmá, Yucatán')
  };
}

/**
 * EL CONTRATO ARMADO.
 *
 * Devuelve el texto ya rellenado y la lista de huecos que quedaron sin
 * dato, para que la pantalla pueda avisar ANTES de imprimir: descubrir que
 * falta el domicilio con el cliente enfrente y la pluma en la mano es la
 * peor forma de descubrirlo.
 */
function armar({ nevera, comodato }) {
  const negocio = negocioDelContrato();
  const datos = huecos({ nevera, comodato, negocio });

  const faltan = Object.entries(datos)
    .filter(([, v]) => /^_+$/.test(String(v)))
    .map(([k]) => k);

  return { texto: rellenar(texto(), datos), faltan, datos };
}

// ============================================================
// LA HOJA
// ============================================================

/**
 * EL CONTRATO EN HOJA TAMAÑO CARTA, listo para la impresora normal.
 *
 * Va en letra de ancho fijo y respetando los renglones tal como están
 * escritos: un contrato con los renglones movidos se ve hecho en casa, y
 * este papel lo firma un cliente.
 *
 * Los comentarios de la plantilla —los que van entre barra y asterisco—
 * se quitan aquí: son notas para quien edita el texto, no parte del
 * contrato.
 */
function hoja({ nevera, comodato }) {
  const { texto: cuerpo, faltan } = armar({ nevera, comodato });
  const limpio = cuerpo.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n?/gm, '');

  const escapar = (t) => String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return {
    faltan,
    html: `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Comodato · nevera ${escapar(nevera?.numero || '')}</title>
<style>
  @page { size: letter; margin: 20mm 18mm; }
  body { margin: 0; background: #fff; color: #000; }
  pre {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11pt; line-height: 1.45;
    white-space: pre-wrap; word-wrap: break-word; margin: 0;
  }
  /* Que ninguna firma quede sola al principio de una hoja. */
  @media print { pre { orphans: 3; widows: 3; } }
</style></head>
<body><pre>${escapar(limpio)}</pre></body></html>`
  };
}

module.exports = { PLANTILLA, CLAVE, texto, armar, hoja, rellenar, fechaLarga };
