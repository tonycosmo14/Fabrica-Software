/**
 * MANUAL DE AYUDA  (v0.9.1)
 *
 * El manual vive dentro del sistema, no en un PDF que nadie abre. Está
 * escrito para quien va a usarlo de verdad: el cajero, el gerente y quien
 * cuenta el cuarto frío. Nada de palabras de programador.
 *
 * Cada tema va plegado para que la lista completa se vea de un vistazo, y
 * hay un buscador arriba: se escribe "fracción" o "corte" y quedan solo los
 * temas que hablan de eso.
 *
 * La tabla de quién puede qué NO está escrita aquí: se la pide al servidor,
 * que la arma de los permisos de verdad. Así no puede quedar mintiendo.
 */
import { api } from '../api.js';
import { esc } from '../util.js';

const TEMAS = [
  // ==========================================================
  {
    id: 'entrar',
    titulo: 'Entrar al sistema',
    busca: 'entrar pin contraseña acceso olvidé administrador sesión salir',
    cuerpo: `
      <p>Al abrir el sistema aparecen los nombres de todos. <b>Tocas tu nombre
      y escribes tu PIN</b> de 4 a 6 números. Nada más.</p>

      <p>El administrador también puede entrar con usuario y contraseña, con
      el botón de abajo. Se usa cuando hay que hacer algo delicado.</p>

      <p>La sesión se queda guardada en ese aparato, así que no te va a pedir
      el PIN cada rato. Para salir, el menú de arriba a la derecha.</p>

      <h4>Si olvidaste el PIN y la contraseña</h4>
      <p>En la PC de la fábrica hay un archivo <b>RECUPERAR-ACCESO.bat</b>.
      Le das doble clic y te deja poner un PIN nuevo al administrador. Solo
      funciona sentado en esa computadora: quien no puede entrar a la fábrica,
      no puede recuperar nada.</p>

      <p class="ayuda-tip">Ten <b>dos administradores</b>. Si solo hay uno y
      se va, el que quede se queda mirando la pantalla.</p>`
  },

  // ==========================================================
  {
    id: 'produccion',
    titulo: 'Producción: sacar el hielo de los tanques',
    busca: 'producción tanque paño canasta molde sacar rellenar rotación intercalado merma agua purificada potable congelación',
    cuerpo: `
      <h4>Cómo está armado un tanque</h4>
      <p>Un <b>tanque</b> tiene varios <b>paños</b>. Cada paño tiene
      <b>canastas</b>, y cada canasta tiene <b>moldes</b>. Cada molde que sale
      bien es <b>una marqueta</b>.</p>

      <h4>La regla de la rotación</h4>
      <p>Los paños <b>siempre se sacan intercalados</b>: si se sacó el 1,
      sigue el 3, luego el 5… y cuando se acaban los nones empiezan los pares.
      Así el hielo alcanza a congelarse.</p>

      <p>El sistema te marca <b>cuál toca</b>. Si tocas otro paño, te avisa
      que ese no sigue y no te deja seguir hasta que un <b>gerente o el
      administrador</b> escriba el motivo y meta su PIN. Queda anotado quién
      lo autorizó y por qué.</p>

      <h4>Sacar es una sola cosa</h4>
      <p>Cuando se saca un paño, <b>se saca completo</b> y se vuelve a llenar
      en el mismo momento. Por eso el sistema lo pide junto: marcas qué moldes
      salieron bien y cuáles fueron merma, dices con qué agua se rellenó, y
      listo. Un solo registro.</p>

      <p>Los moldes que fallan quedan <b>marcados en rojo</b> hasta que ese
      paño dé la vuelta otra vez. Si un molde falla varias veces seguidas, el
      sistema lo señala: probablemente está roto.</p>

      <h4>Los números que siguen</h4>
      <p>El gerente y el administrador pueden imprimir <b>la lista de los
      números que tocan</b>, con tanque, fecha y hora. Se les entrega a los
      muchachos en la mañana y a las 3 te dicen qué sacaron.</p>

      <p class="ayuda-tip">Los obreros no capturan nada. Ellos sacan hielo y
      reportan; quien captura es quien recibe la existencia.</p>`
  },

  // ==========================================================
  {
    id: 'existencia',
    titulo: 'Existencia: contar el cuarto frío',
    busca: 'existencia conteo cuarto frío contar marquetas fracción 5/8 cuadre faltante vendido salidas almacén horarios',
    cuerpo: `
      <h4>Cuándo se cuenta</h4>
      <p>A las horas que estén configuradas (de fábrica, <b>3 de la tarde y 8
      de la noche</b>). Cuando pasa la hora y nadie ha contado, la pantalla lo
      marca en naranja.</p>

      <h4>Cómo se captura</h4>
      <p>Tal como te lo dictan. Si te dicen <b>"quedan 14 marquetas y 5/8"</b>,
      lo escribes así mismo en el cuadrito, o lo tocas con los botones
      <b>1 · 1/2 · 1/4 · 1/8 · 1/16</b>, que se van sumando.</p>

      <p>Los botones suman: tocas 1/2, luego 1/8, y queda 5/8. Cuando los
      pedazos completan una marqueta, sube sola al contador de arriba.</p>

      <h4>Qué te dice el cuadre</h4>
      <pre class="ayuda-formula">había + se produjo − se vendió con ticket = debería quedar
debería quedar − contado = FALTA</pre>

      <p><b>Falta</b> es lo que salió del cuarto frío <b>sin ticket</b>: lo que
      se derritió, lo que se cayó y lo que se fue sin pagar. Ese es el número a
      vigilar. Si sale en verde, todo lo que salió tiene su ticket.</p>

      <p>Si <b>sobra</b>, revisa: puede faltar capturar producción, o el conteo
      anterior se quedó corto.</p>

      <h4>Si te equivocaste al capturar</h4>
      <p>El conteo <b>no se borra</b>: se anula, con motivo. Al anularlo vuelve
      a valer el conteo anterior. Eso lo hace el gerente o el administrador.</p>

      <p class="ayuda-tip">Cada conteo guarda sus números <b>congelados</b>. Si
      mañana corriges una sacada vieja, el corte que ya hiciste no se mueve.</p>`
  },

  // ==========================================================
  {
    id: 'venta',
    titulo: 'Punto de venta: cobrar',
    busca: 'venta cobrar ticket precio fracción cambio devolución billete folio cancelar imprimir teclado enter f10 f2 f3 f4 código rápido categorías nueva venta espera pendiente aviso bolita se acabó agotado poco hielo inventario bajo atajos gastos historial reloj',
    cuerpo: `
      <p>Es la pantalla que se abre al entrar, porque es la que se usa casi
      todo el día. A la izquierda lo que lleva el cliente, a la derecha los
      botones. <b>No se desplaza:</b> todo está siempre en el mismo sitio.</p>

      <h4>Con el ratón</h4>
      <ol class="instrucciones">
        <li>Tocas la categoría (Hielo, Refrescos…) y luego el producto.</li>
        <li>El hielo <b>se va sumando</b>: tocas 1/2 y luego 1/8 y quedan 5/8.</li>
        <li><b>Cobrar</b>, tocas el billete con el que pagan y listo.</li>
      </ol>

      <h4>Atajos que ahorran el día</h4>
      <ul>
        <li><b>F1</b> te trae aquí <b>desde cualquier pantalla</b>. Estabas
        viendo la existencia y llegó un cliente: una tecla y ya.</li>
        <li><b>Enter con el campo vacío repite lo último</b> que agregaste.
        "Dame otro igual" es media venta del mostrador.</li>
        <li><b>Toca el número</b> de un renglón y escribe la cantidad. Si te
        piden 50 marquetas no hay que tocar el botón cincuenta veces.
        Poniendo <b>0</b> se quita del ticket.</li>
        <li><em>Esc</em> pregunta si vaciar; otro <em>Enter</em> acepta.</li>
      </ul>

      <h4>Sin soltar el teclado (así es más rápido)</h4>
      <p>Cada producto tiene un <b>código</b>. El del octavo es <b>18</b>. No
      hay que buscar el botón: se teclea y se da enter.</p>
      <ol class="instrucciones">
        <li>Tecleas <b>18</b> y <em>Enter</em> → el octavo entra al ticket.</li>
        <li><em>F10</em> → pasa a cobrar, con el cursor ya puesto.</li>
        <li>Tecleas lo que te dan y <em>Enter</em> → te dice el cambio.</li>
        <li><em>Enter</em> otra vez → se cobra y se registra.</li>
        <li><em>Enter</em> otra vez → <b>si quieres</b>, imprime el ticket. Cada
        enter más saca otro. Si nadie lo pide, no se imprime nada.</li>
        <li><em>Esc</em> → listo para el siguiente cliente.</li>
      </ol>
      <p>Si pagan justo, en el paso 3 basta dar <em>Enter</em> sin teclear
      nada. Y <em>Esc</em> siempre regresa un paso.</p>
      <p class="ayuda-tip">Abajo a la derecha hay un renglón que dice
      <b>qué hace Enter en ese momento</b>. Mirándolo dos o tres veces ya no
      hace falta acordarse.</p>

      <h4>Decir de quién es el ticket</h4>
      <p><em>F6</em>, o el botón <b>👤 Cliente</b>. Sirve para dos cosas: para
      que al cliente de mayoreo <b>le salga su precio</b>, y para fiarle. Son
      dos botones distintos en la misma lista, porque son dos decisiones
      distintas: la mayoría de los mayoristas pagan en el momento.</p>
      <p>Se puede hacer en cualquier momento, antes o durante el cobro. El
      precio cambia en la pantalla en el acto. Está explicado completo en
      <b>Precios de mayoreo</b>.</p>

      <h4>Dos clientes a la vez</h4>
      <p>Llega uno, pide 1/8 y se queda pensando. Detrás llega otro que ya
      sabe lo que quiere. Con <b>Nueva venta</b> (<em>F2</em>) el ticket a
      medias se guarda, atiendes al de atrás, y <b>al terminar el pendiente
      vuelve solo</b>.</p>
      <p>Arriba se ve cuántas hay esperando. Puedes tener varias y elegir
      cuál seguir.</p>

      <h4>Cambios y devoluciones</h4>
      <p><b>Cambio</b> (<em>F4</em>) para el clásico: <em>"pedí 1/2 pero no
      sabía que era tanto, quería 1/8"</em>.</p>
      <ol class="instrucciones">
        <li>Tecleas el número del ticket que trae el cliente.</li>
        <li>El sistema te enseña qué traía y lo abona <b>a favor</b>.</li>
        <li>Marcas lo que se lleva ahora, como en cualquier venta.</li>
        <li>Abajo dice si hay que <b>cobrar</b> la diferencia o
        <b>devolverla</b>.</li>
      </ol>
      <p>El ticket viejo queda cancelado y amarrado al nuevo, el hielo
      vuelve al cuarto frío solo y la caja cuadra sola. Todo queda anotado.</p>

      <h4>Buscar un ticket de hoy, verlo o sacar una copia</h4>
      <p><em>F3</em>, o el botón 🧾. Se busca por número, por el importe o por
      la hora, entre <b>los de hoy</b>: aquí se busca el ticket que el cliente
      acaba de perder, no el de hace tres semanas.</p>
      <ul>
        <li><b>Ver</b> abre ahí mismo <b>qué traía</b> ese ticket, sin
        imprimir nada. Es lo que se pregunta casi siempre.</li>
        <li><b>Copia</b> lo vuelve a imprimir marcado como <b>COPIA</b>, para
        que no se confunda con el original.</li>
      </ul>
      <p>Sirve cuando el cliente vuelve porque perdió su ticket, o cuando te
      saliste de la pantalla sin querer.</p>

      <h4>Si el turno no tiene dueño</h4>
      <p>Cuando alguien entregó su turno y el que sigue no ha llegado, arriba
      del ticket sale un cartel: <b>lo que se cobra se está apartando</b> para
      quien entre.</p>
      <p>En cuanto llegue, el botón <b>Tomar el turno</b> le pide su PIN ahí
      mismo. El turno y el dinero apartado quedan a su nombre, y de ahí en
      adelante las ventas salen con el suyo.</p>
      <p class="ayuda-tip">Refrescar la pantalla <b>ya no</b> se queda el
      turno. Antes sí pasaba, y el que acababa de entregar se lo volvía a
      quedar sin darse cuenta.</p>

      <h4>Fiar</h4>
      <p>En la pantalla de cobro, <b>🧾 Fiar a un cliente</b>. Solo a los que
      están dados de alta. Está explicado completo en
      <b>Clientes y crédito</b>.</p>

      <h4>Cuando algo se está acabando</h4>
      <p>Arriba a la derecha aparece un <b>⚠ con una bolita</b>. El número de
      la bolita es cuántos productos están bajos o ya se acabaron. Al tocarlo
      sale la lista, con cuántos quedan de cada uno.</p>
      <p>Lo que ya se acabó <b>no se puede vender</b>: su botón se ve apagado
      y dice <em>se acabó</em>, y teclear su código tampoco lo mete al ticket.
      Si pides 5 y solo hay 4, te lo dice antes de armar el ticket. Lo que no
      lleva inventario (el agua, los garrafones) no tiene tope.</p>

      <h4>El aviso del hielo es distinto</h4>
      <p>Cuando queda poco hielo sale un <b>🧊</b> aparte. Ese avisa, pero
      <b>nunca impide vender</b>, y la razón importa:</p>
      <p class="ayuda-tip">El número que ve el sistema es <b>lo que se ha
      capturado</b>, no lo que hay en el cuarto frío. Los obreros sacan hielo
      toda la mañana y reportan lo que sacaron hasta como las 3 de la tarde,
      porque están atendiendo y sacando al mismo tiempo. Así que a media
      mañana el sistema casi siempre va a marcar de menos. <b>Sigue
      vendiendo normal.</b></p>
      <p>Con cuántas marquetas avisa lo pones tú, en
      <b>Productos y precios → Hielo</b>.</p>

      <h4>Los atajos de arriba a la derecha</h4>
      <p>Botoncitos discretos, para no ir al menú veinte veces al día:</p>
      <ul>
        <li><b>📋</b> la existencia del cuarto frío.</li>
        <li><b>№</b> los números que siguen en los tanques (gerente o
        administrador).</li>
        <li><b>💵</b> los gastos y el dinero del cajón.</li>
        <li><b>🔒</b> terminar el turno y contar.</li>
      </ul>
      <p>Si tenías un ticket a medias, <b>se aparta solo</b> antes de salir y
      vuelve cuando regreses.</p>

      <h4>Los gastos del cajón, desde aquí</h4>
      <p>El botón <b>💵</b> abre los últimos movimientos <b>cruzando
      turnos</b>: la gasolina de la mañana se ve aunque ese turno ya se haya
      cerrado. Una raya parte la lista diciendo <em>"de aquí para abajo es
      del turno de Fulano"</em>.</p>
      <p>Los gastos van en rojo, con su botón para volver a sacar el
      comprobante. Meter dinero se ve más discreto: nadie pide cuentas de lo
      que se dejó.</p>

      <h4>Cantidades que no tienen botón</h4>
      <p>El botón de la calculadora 🧮, arriba a la derecha, abre el teclado
      de fracciones para cualquier cantidad. Se suma a lo que ya lleva.</p>

      <h4>Los precios</h4>
      <p>Cada pedazo tiene <b>su propio precio</b>; no se saca dividiendo el de
      la marqueta, porque cortar da trabajo. Para cobrar una cantidad, el
      sistema la parte en los pedazos más grandes y suma:</p>

      <pre class="ayuda-formula">3/8  →  1/4 + 1/8  →  $70 + $36  =  $106.00</pre>

      <p>Como siempre parte igual, <b>tocar seis veces 1/16 cuesta lo mismo</b>
      que tocar 1/4 y 1/8. Da igual quién atienda y cómo teclee: el precio es
      el mismo.</p>

      <p>Los precios se cambian en <b>Productos y precios</b>, y solo el
      administrador. <b>Los tickets ya cobrados no cambian</b> cuando subes un
      precio.</p>

      <h4>Si un ticket salió mal</h4>
      <p>Un ticket cobrado <b>no se corrige</b>: se <b>cancela</b>. Queda
      marcado como cancelado, con tu nombre y el motivo, y el original sigue
      existiendo para siempre. El hielo vuelve a contar como que no salió.</p>

      <p>Cancelar lo hace el gerente o el administrador, no el cajero.</p>

      <h4>Buscar un ticket viejo</h4>
      <p>Con el botón <b>Buscar tickets</b>: por número, por el importe o por
      la hora. Los últimos 30 salen solos.</p>`
  },

  // ==========================================================
  {
    id: 'caja',
    titulo: 'Caja: el turno y el corte',
    busca: 'caja turno fondo corte arqueo gasto retiro efectivo cerrar cuadrar sobra falta',
    cuerpo: `
      <h4>El turno se abre solo</h4>
      <p>No hay que ir a ninguna pantalla a abrir la caja: <b>lo hace tu
      PIN</b>. Quien entra es quien se hace responsable del dinero de ese
      turno, y las ventas se le pegan solas.</p>

      <p>El turno arranca en <b>cero</b>. Si el cajón trae fondo para dar
      cambio, se agrega con el botón verde <b>＋ Meter dinero</b> de la
      pantalla de venta, y queda anotado de dónde salió.</p>

      <p>Si alguien dejó el turno abierto y entras tú, <b>sigues en ese
      turno</b>. Nunca hay dos abiertos a la vez: si los hubiera, ninguna
      venta sabría a cuál pertenece.</p>

      <h4>Terminar el turno: hay dos formas</h4>
      <p>El botón <b>Terminar turno y contar</b> pregunta una sola cosa:
      <em>¿ya llegó quien sigue?</em></p>

      <ul class="instrucciones">
        <li><b>Sí, ya llegó</b> — se cuenta el dinero, sale el corte y
        <b>se cierra la sesión</b>. El que entra pone su PIN, y ese PIN abre
        su turno a su nombre.</li>
        <li><b>Todavía no llega</b> — es el relevo de las 2:30, cuando ya se
        entregó la existencia pero el otro cajero no ha llegado. Se cuenta tu
        dinero y sale tu corte, pero <b>la venta no se para</b>: queda abierto
        un turno <em>esperando dueño</em>. Todo lo que entre a partir de ahí
        se está apartando para el que llegue, y en cuanto ponga su PIN el
        turno queda a su nombre.</li>
      </ul>

      <p class="ayuda-tip">Eso último es lo que arregla el problema de
      siempre: antes se seguía cobrando con el usuario del que se iba y las
      ventas de la noche salían a nombre equivocado. Ahora cada venta guarda
      <b>quién la tecleó</b> y el turno guarda <b>de quién es el dinero</b>.
      Las dos cosas quedan escritas.</p>

      <h4>Gastos y retiros</h4>
      <p>Con el botón rojo <b>− Gasto</b> de la pantalla de venta. Todo el
      dinero que sale del cajón sin ser cambio: la gasolina, los refrescos, el
      retiro a la caja fuerte. Verde entra, rojo sale.</p>

      <h4>Lo fiado no está en el cajón</h4>
      <p>Si en el turno salió mercancía <b>fiada</b>, el corte lo dice aparte:
      ese dinero está en la calle, no en los billetes, y no se cuenta en el
      arqueo. Lo mismo lo cobrado por transferencia, que ya se cobró pero
      entró por otro lado.</p>
      <p>Lo que sí entra al cajón son los <b>abonos en efectivo</b>: ese
      billete sí llegó ahí.</p>

      <h4>Cerrar y contar</h4>
      <p>Cuentas <b>todo</b> el dinero del cajón, incluido el fondo, y lo
      escribes. El sistema hace la cuenta:</p>

      <pre class="ayuda-formula">fondo + cobrado + entradas − gastos = debería haber
debería haber − contado = DIFERENCIA</pre>

      <p>Si <b>falta</b>: casi siempre es un cambio dado de más o un gasto que
      no se anotó. Si <b>sobra</b>: un cambio que no se dio, o una venta
      cobrada sin registrar.</p>

      <p>El corte se imprime con espacio para la firma. Los gastos y las
      entradas salen <b>en dos columnas</b>, cada una con su suma: un día de
      gastos son quince renglones, y así cabe en la mitad de papel.</p>

      <h4>Mandar el corte por WhatsApp</h4>
      <p>Abajo del corte, <b>📲 Mandar por WhatsApp</b>. El sistema arma la
      <b>imagen del ticket</b> y abre el menú de compartir del celular, donde
      WhatsApp sale arriba.</p>
      <p>En la computadora no existe ese menú: ahí se <b>baja la imagen</b> y
      se abre WhatsApp Web con el resumen ya escrito. La imagen se arrastra al
      chat.</p>
      <p class="ayuda-tip">La imagen se arma <b>en el aparato</b>: no se sube
      a ningún lado ni pasa por internet hasta que tú la mandas.</p>

      <h4>Cosas que conviene saber</h4>
      <ul class="instrucciones">
        <li>Solo puede haber <b>un turno abierto</b> a la vez.</li>
        <li>Un corte cerrado <b>ya no cambia</b>. Si mañana cancelas una venta
        de hoy, el corte firmado se queda como está.</li>
        <li>Al cerrar el turno, el siguiente se abre solo cuando alguien
        vuelva a entrar con su PIN.</li>
      </ul>`
  },

  // ==========================================================
  {
    id: 'productos',
    titulo: 'Productos y precios: qué aparece en la caja',
    busca: 'productos categorías catálogo precios códigos alta baja refrescos garrafones botones color inventario costo ganancia margen foto pedir mínimo contar existencias piezas',
    cuerpo: `
      <p>Los botones de la caja se dan de alta en <b>Productos y precios</b>,
      sin tocar el programa. Solo el administrador.</p>

      <h4>Categorías</h4>
      <p>Son carpetas: Hielo, Refrescos, Agua… El cajero toca la categoría y
      ve lo que hay dentro. Cada una puede tener su color, y ese color es el
      del botón: con práctica la mano va sola sin leer.</p>

      <h4>Dos clases de producto</h4>
      <ul class="instrucciones">
        <li><b>Hielo</b> — el botón entrega una fracción de marqueta. No tiene
        precio propio: lo toma de la lista de precios. Así nunca hay dos
        precios distintos para lo mismo.</li>
        <li><b>Normal</b> — un refresco, un garrafón, una bolsa. Tiene su
        precio y no descuenta hielo del cuarto frío.</li>
      </ul>

      <h4>El código</h4>
      <p>Es lo que el cajero teclea para agregarlo sin buscar el botón. Los
      del hielo vienen puestos: <b>1</b> la marqueta, <b>12</b> la mitad,
      <b>14</b>, <b>18</b> y <b>116</b>. A un refresco le puedes poner
      <b>COCA</b>. Puede quedar vacío si no lo necesitas.</p>

      <h4>La foto</h4>
      <p>Cada producto puede llevar foto. No es adorno: con foto el cajero no
      lee el botón, <b>lo reconoce</b>, y se equivoca menos. Se pone desde el
      producto, en el panel de la derecha.</p>

      <h4>Inventario: ¿qué hay que pedir?</h4>
      <p>Los refrescos, garrafones y botellas pueden llevar cuenta de piezas.
      El hielo <b>no</b>: se mide en marquetas y su control es la
      <b>Existencia</b> del cuarto frío, que se cuenta dos veces al día. Son
      dos preguntas distintas con dos ritmos distintos.</p>

      <pre class="ayuda-formula">había + entró − se vendió − otras salidas = debería haber
debería haber − contado = FALTA</pre>

      <ul class="instrucciones">
        <li><b>Llegó mercancía</b> — cuando surte el proveedor. Se anota
        cuántas y <b>a cómo salió cada una</b>: ese costo queda guardado tal
        cual, así que si mañana sube el proveedor, esta compra no cambia.</li>
        <li><b>Salida</b> — lo que sale sin venderse: se rompió, caducó, se lo
        llevaron.</li>
        <li><b>Contar</b> — cuentas lo que hay y el sistema dice si falta.</li>
      </ul>

      <p>Si pones un <b>mínimo</b>, arriba aparece cuántos productos ya hay que
      pedir, y en la caja sale el ⚠ con la bolita. Y con <b>Hoja para
      contar</b> sacas la lista impresa, con su renglón en blanco para ir
      apuntando.</p>
      <p class="ayuda-tip">Un producto en cero <b>ya no se puede vender</b>.
      Si prefieres que se venda sin tope, quítale el inventario: entonces el
      sistema deja de llevarle la cuenta.</p>

      <h4>Con cuánto hielo avisar</h4>
      <p>En la categoría <b>Hielo</b>, abajo del todo: <b>avisar con esto o
      menos</b>, en marquetas. Cuando lo capturado baje de ahí, en la caja
      aparece un 🧊.</p>
      <p class="ayuda-tip">Ese aviso <b>nunca impide vender hielo</b>, y a
      propósito. El número sale de <b>lo que se ha capturado</b>, y los
      obreros reportan lo que sacaron hasta como las 3 de la tarde: a media
      mañana el cuarto frío puede estar lleno y el sistema marcar cero. Si el
      🧊 sale y tú sabes que sí hay, lo que falta es capturar producción.</p>

      <h4>Costo y ganancia</h4>
      <p>Si le pones el costo a un producto, el sistema te dice cuánto ganas
      por pieza. El costo de cada compra se guarda con esa compra; el del
      producto es el de la última.</p>

      <h4>Editar: se toca y se escribe</h4>
      <p>No hay botón de guardar. Tocas el nombre, el precio o el costo,
      escribes encima y sales del campo: ya quedó. El campo parpadea en
      verde cuando se guardó.</p>

      <h4>Quitar un producto, y recuperarlo</h4>
      <p>Se da de <b>baja</b>: deja de aparecer en la caja, pero
      <b>los tickets viejos no cambian</b>. Nada se borra nunca.</p>
      <p>Y se puede traer de vuelta: el botón <b>Ver dados de baja</b>, arriba,
      los muestra en gris, y desde el producto se vuelve a dar de alta.</p>
      <p class="ayuda-tip">Si el producto todavía tiene mercancía, el sistema
      avisa cuántas piezas quedan y pide el PIN de un gerente o del
      administrador: son piezas de verdad que nadie va a volver a contar.</p>

      <h4>Lo que ve cada quien</h4>
      <ul class="instrucciones">
        <li><b>Cajero</b> — entra a ver cuántas hay e imprimir la hoja para
        contar. No ve los costos ni puede cambiar nada.</li>
        <li><b>Gerente</b> — todo lo anterior, más los costos, los
        movimientos de inventario y dar de alta o de baja productos.</li>
        <li><b>Administrador</b> — además, los precios del hielo y la
        impresora.</li>
      </ul>

      <p class="ayuda-tip">Dar de baja una categoría se lleva sus productos.
      El sistema te dice cuántos son antes de hacerlo.</p>

      <h4>La impresora de tickets</h4>
      <p>Se configura en <b>Sistema</b>, junto a los respaldos: es un aparato
      de esta computadora, no un producto. Con el nombre de la impresora
      puesto, el ticket sale <b>al instante</b>; sin él, lo imprime el
      navegador y aparece la ventana de impresión.</p>`
  },

  // ==========================================================
  {
    id: 'clientes',
    titulo: 'Clientes y crédito: a quién se le fía',
    busca: 'clientes crédito fiar fiado deuda debe abono abonar cobranza límite plazo vencido saldo cuenta a favor cartera calle',
    cuerpo: `
      <p>La regla de la fábrica es que <b>se le fía solo a los clientes que
      damos de alta</b>. Al público en general no. Por eso en la caja el
      botón de fiar abre una lista: no hay forma de escribir un nombre a
      mano con gente esperando.</p>

      <h4>Dar de alta a alguien</h4>
      <p>En <b>Clientes</b>, botón <b>＋ Cliente</b>. Solo se pide el nombre;
      lo demás —negocio, teléfono, límite, plazo— se llena tocándolo en su
      ficha, y casi nunca se sabe todo el primer día.</p>

      <h4>Fiar en la caja</h4>
      <ol class="instrucciones">
        <li>Se marca lo que se lleva, como cualquier venta.</li>
        <li><em>F10</em> para cobrar, y ahí <b>🧾 Fiar a un cliente</b>.</li>
        <li>Se busca por nombre o negocio y se toca <b>Fiarle</b>.</li>
        <li>La pantalla enseña <b>lo que va a deber después de este ticket</b>:
        debía + este ticket = va a deber. <em>Enter</em> lo registra.</li>
      </ol>
      <p>El ticket sale marcado <b>FIADO</b>, con su nombre y la línea para
      firmar. Ese papel es el vale: el cliente se lleva su copia y los dos
      saben lo mismo.</p>

      <h4>El límite avisa, no impide</h4>
      <p>Si el cliente tiene límite y este ticket lo pasa, <b>no se rechaza la
      venta</b>: se pide el <b>PIN de un gerente</b> y el porqué. Queda escrito
      quién lo autorizó y por qué, en el ticket y en la bitácora.</p>
      <p class="ayuda-tip">Al cliente que lleva veinte años comprando no se le
      para la venta por un número que alguien escribió hace meses. Pero
      tampoco se le fía de más sin que nadie se entere.</p>
      <p>El límite <b>vacío quiere decir sin límite</b>. Un límite de cero sí
      es un límite: a ese no se le fía nada.</p>

      <h4>Cuando el cliente pasa a pagar</h4>
      <p>En su ficha, <b>＋ Recibir abono</b>. Se escribe lo que deja y ya.</p>
      <ul>
        <li>El abono va <b>a su cuenta</b>, no a un ticket concreto: es como lo
        dice el cliente, que llega y deja $500.</li>
        <li>Si paga <b>de más</b>, lo que sobra le queda a favor y se le
        descuenta la próxima vez.</li>
        <li>En efectivo, ese dinero <b>entra al cajón</b> y sale en el corte.
        Por transferencia no, porque no pasó por ahí.</li>
      </ul>
      <p>Si se anotó mal, el gerente lo anula con la ✕ de su renglón. No se
      borra: queda marcado, con el motivo, y su renglón del cajón se anula
      también.</p>

      <h4>Su cuenta</h4>
      <p>Arriba, en grande, lo que debe. Abajo la cuenta de siempre:</p>
      <pre class="ayuda-formula">se ha llevado fiado − ha pagado = DEBE</pre>
      <p>Y después, renglón por renglón, lo que se llevó y lo que pagó. Es lo
      que se le enseña al cliente cuando pregunta.</p>
      <p class="ayuda-tip"><b>El saldo no está guardado en ningún lado: se
      suma cada vez.</b> Por eso cancelar un ticket viejo o anular un abono
      corrige la cuenta solo, y el papel del cliente y esta pantalla no
      pueden decir cosas distintas.</p>

      <h4>La cobranza</h4>
      <p>Arriba de la pantalla, <b>cuánto hay en la calle</b> y cuántos deben.
      El botón <b>Solo los que deben</b> deja la lista lista para salir a
      cobrar. Si le pusiste <b>días de plazo</b> a un cliente, los que se
      pasaron salen marcados en rojo como <b>vencidos</b>.</p>
      <p>El plazo <b>solo avisa</b>: nunca impide venderle.</p>

      <h4>En el corte</h4>
      <p>Lo que salió fiado <b>no se cuenta en el cajón</b>: ese dinero está en
      la calle, no en los billetes. El corte lo dice aparte, para que sepas
      cuánto se fió en el turno.</p>

      <h4>Dar de baja a un cliente</h4>
      <p>Solo si <b>no debe nada</b>. Uno que debe no se puede dar de baja:
      desaparecería de la cobranza con dinero afuera. Sus tickets viejos no
      cambian, y se puede recuperar cuando sea.</p>`
  },

  // ==========================================================
  {
    id: 'mayoreo',
    titulo: 'Precios de mayoreo',
    busca: 'mayoreo precio especial lista mayorista nevería descuento medio marqueta mínimo F6 cliente precio distinto',
    cuerpo: `
      <p>Hay clientes que compran en cantidad y tienen <b>su propio precio</b>.
      El sistema lo resuelve en un toque: capturas lo que te pidieron, dices
      quién es, y el precio cambia solo en la pantalla.</p>

      <h4>Es una LISTA, no un descuento</h4>
      <p><b>Mayoreo 1</b> es una lista de precios completa, donde la marqueta
      vale $240 en vez de $264. A esa lista se apuntan los clientes que la
      tienen. Subirle el precio a la lista <b>se lo sube a todos de una
      vez</b>, que es como se maneja de verdad.</p>
      <p>Y cada fracción lleva <b>su propio precio</b>, igual que en la de
      público: el cuarto no sale de dividir la marqueta entre cuatro. Cortar
      da trabajo, y ese trabajo no desaparece por vender mucho.</p>

      <h4>Cobrarle en la caja</h4>
      <ol class="instrucciones">
        <li>Marcas lo que te pidieron, como en cualquier venta.</li>
        <li><em>F6</em>, o el botón <b>👤 Cliente</b>.</li>
        <li>Buscas su nombre y tocas <b>Es él</b>.</li>
        <li>El precio cambia al instante: el total, los botones, todo. Sigues
        tu flujo normal y cobras como siempre.</li>
      </ol>
      <p>Arriba del ticket queda su nombre en verde, diciendo con qué lista se
      le está cobrando. La <b>✕</b> de ese renglón lo quita y devuelve los
      precios de público, por si te confundiste de persona.</p>
      <p class="ayuda-tip"><b>Es él</b> no es <b>Fiarle</b>. Decir quién es
      sirve para el precio; fiarle es otra cosa y tiene su propio botón. Un
      mayorista puede pagar en efectivo y llevarse su precio igual.</p>

      <h4>Desde media marqueta</h4>
      <p>El mayoreo <b>no aplica por cualquier cosa</b>: arranca desde media
      marqueta. Al que lleva un cuarto se le cobra público aunque sea el
      mayorista, y la pantalla te lo dice: <em>"le falta 1/4 de hielo para su
      precio de Mayoreo 1"</em>. Eso es justo lo que se le dice al cliente:
      <em>"con un cuarto más te lo dejo a precio de mayoreo"</em>.</p>
      <p>Se mide sobre <b>todo el hielo del ticket</b>: quien pide un cuarto y
      un cuarto está pidiendo media marqueta.</p>
      <p>Alcanzar el mínimo no convierte dos cuartos en un medio: cada
      fracción se sigue cobrando a su precio, el de mayoreo. Dos cuartos son
      dos cortes.</p>

      <h4>Crear una lista y ponerle precios</h4>
      <p>En <b>Productos y precios</b>, en la categoría <b>Hielo</b>, hasta
      abajo: <b>🏷️ Precios de mayoreo</b>.</p>
      <ul>
        <li><b>＋ Nueva lista de mayoreo</b> y le pones nombre. Nace copiando
        los precios de público, para que nunca quede a medio llenar: le bajas
        los que toque y <b>Guardar</b>.</li>
        <li><b>Desde cuánto hielo aplica</b> se escribe en dieciseisavos: 8 es
        media marqueta, 16 es una entera.</li>
        <li>Cada lista dice <b>cuántos clientes</b> la usan, para que sepas a
        cuántos les estás cambiando el precio.</li>
      </ul>

      <h4>Apuntar a un cliente</h4>
      <p>En <b>Clientes</b>, en su ficha, el renglón <b>Precio de mayoreo</b>.
      Se elige su lista y queda guardado en el acto. En la lista de la
      izquierda, los que tienen mayoreo salen con 🏷️.</p>
      <p>Dejarlo en <b>Precio de público</b> se lo quita.</p>

      <h4>Lo que no puede pasar</h4>
      <ul>
        <li><b>El precio lo decide el servidor.</b> La pantalla lo calcula
        para que se vea al instante, pero al cobrar se vuelve a decidir desde
        cero.</li>
        <li><b>El precio queda copiado en el ticket.</b> Subirle mañana a la
        lista no cambia los tickets de hoy.</li>
        <li>Un cliente <b>dado de baja</b> pierde su precio de mayoreo. Una
        lista dada de baja se cobra a público.</li>
        <li>El ticket impreso dice <b>de quién fue y con qué lista</b>: es lo
        que explica por qué esa marqueta salió a $240.</li>
      </ul>`
  },

  // ==========================================================
  {
    id: 'historial',
    titulo: 'Historial: revisar lo que se hizo',
    busca: 'historial revisar auditar quién hizo qué cajero fecha hora filtro tickets gastos entradas abonos borrar eliminar dar de baja contraseña',
    cuerpo: `
      <p>La pantalla para contestar una pregunta: <em>"¿qué hizo Mari el jueves
      entre las 3 y las 8?"</em>. Es <b>solo del administrador</b>: no porque
      sea un secreto, sino porque es para revisar el trabajo de los demás.</p>

      <h4>Qué se ve</h4>
      <p>Todo lo que un cajero puede hacer con el dinero, que son cuatro cosas:</p>
      <ul>
        <li><b>🧾 Ventas</b> — lo que cobró</li>
        <li><b>📤 Gastos</b> — lo que sacó del cajón</li>
        <li><b>📥 Entradas</b> — lo que metió</li>
        <li><b>💰 Abonos</b> — lo que le pagaron de una cuenta</li>
      </ul>

      <h4>Cómo se filtra</h4>
      <p>Arriba: <b>desde y hasta qué día</b>, <b>desde y hasta qué hora</b>, y
      <b>quién</b>. Los cuatro botones de colores prenden y apagan cada tipo.
      <b>Hoy</b> pone las fechas de hoy de un toque, y <b>Quitar filtros</b>
      deja todo como estaba.</p>

      <h4>Los cuatro números de arriba</h4>
      <p>Cuánto se cobró, cuánto salió, cuánto entró y cuánto abonaron.
      <b>Suman todo lo que cae en el filtro</b>, no solo los renglones que
      alcanzas a ver: si revisas un mes, el total es del mes.</p>

      <p class="ayuda-tip">Cada renglón dice <b>quién lo capturó</b>, no de
      quién era el turno. En el relevo de las 2:30 uno teclea y el turno es de
      otro; aquí la pregunta es qué hizo la persona.</p>

      <h4>Esto no es la bitácora</h4>
      <p>La bitácora (en <b>Sistema</b>) dice cosas como
      <code>venta.registrada</code> y es para el que programa. Esto está
      escrito para leerse.</p>`
  },

  // ==========================================================
  {
    id: 'borrar',
    titulo: 'Dar de baja o eliminar',
    busca: 'borrar eliminar dar de baja recuperar producto categoría cliente gasto contraseña administrador temporada',
    cuerpo: `
      <p>Son <b>dos cosas distintas</b>, y elegir bien evita problemas:</p>

      <h4>Dar de baja</h4>
      <p>Para lo de <b>temporada</b>, lo que va a volver. Deja de salir en la
      caja pero sigue existiendo, y se recupera cuando toca con <b>Ver dados
      de baja</b>. Lo puede hacer un gerente con su PIN.</p>

      <h4>Eliminar</h4>
      <p>Para lo que <b>nunca debió estar</b>: el producto de prueba, el que se
      dio de alta dos veces, el cliente que se escribió mal. Desaparece y
      <b>no se recupera</b>; si algún día hace falta, se vuelve a dar de alta
      en dos segundos.</p>

      <p class="ayuda-tip"><b>Solo se puede eliminar lo que nunca se usó.</b>
      En cuanto un producto se vendió, su nombre está en tickets ya cobrados;
      borrarlo dejaría el histórico mintiendo. El sistema te lo dice y te
      manda a darlo de baja. Lo mismo con un cliente que ya se llevó algo
      fiado, y con una categoría que todavía tiene productos dentro.</p>

      <h4>Pide la contraseña, no el PIN</h4>
      <p>Y solo la del <b>administrador</b>. El PIN se teclea veinte veces al
      día delante de quien sea: sirve para decir "yo estoy aquí". Borrar no se
      deshace, así que va con algo que no ve nadie.</p>

      <h4>Un gasto capturado por error</h4>
      <p>Se puede <b>anular</b> —queda tachado con su motivo, y se ve qué
      pasó— o <b>borrar</b> con la papelera 🗑, que lo quita de la lista. Lo
      segundo es del administrador.</p>
      <p>Si el gasto es de un turno <b>ya cortado</b>, el sistema avisa antes:
      los totales de ese corte están congelados y no cambian, pero si vuelves
      a imprimirlo la lista ya no va a coincidir con el papel firmado.</p>

      <h4>Lo que nunca se borra</h4>
      <p>La <b>constancia de que alguien borró</b>. Cada eliminación deja su
      renglón en la bitácora, con quién la autorizó y qué era.</p>`
  },

  // ==========================================================
  {
    id: 'permisos',
    titulo: 'Quién puede hacer qué',
    busca: 'permisos roles cajero gerente operario repartidor administrador quién puede',
    cuerpo: '<div id="tabla-permisos" class="cargando">Cargando…</div>'
  },

  // ==========================================================
  {
    id: 'respaldos',
    titulo: 'Respaldos y la impresora',
    busca: 'respaldo copia seguridad usb drive restaurar disco perder datos impresora ticket térmica imprimir compartir windows',
    cuerpo: `
      <p>El sistema se respalda <b>solo</b>: cada 4 horas y cada vez que se
      enciende. No hay que acordarse de nada.</p>

      <h4>Lo único importante que sí tienes que hacer</h4>
      <p>Configurar una <b>carpeta fuera de la PC</b>: una USB pegada atrás de
      la computadora, o una carpeta de Drive o de OneDrive. Se pone en
      <b>Sistema → Respaldos</b>.</p>

      <p class="ayuda-tip">Esa copia de fuera es <b>la única que te salva si el
      disco de la PC muere</b>. La copia local se muere con él.</p>

      <p>Si la USB se desconecta, la copia local se sigue haciendo igual y la
      pantalla de Sistema te avisa que la de fuera está fallando.</p>

      <h4>La impresora de tickets</h4>
      <p>Se configura en la misma pantalla de <b>Sistema</b>, más abajo. Con el
      <b>nombre compartido</b> puesto, el ticket sale al instante; sin él lo
      imprime el navegador y aparece la ventana de impresión.</p>
      <p>Ese nombre sale de compartir la impresora una vez en Windows. En la
      pantalla están los pasos, y el botón <b>Imprimir una prueba</b> dice si
      quedó bien sin tener que hacer una venta.</p>

      <h4>Si hay que restaurar</h4>
      <p>Las instrucciones están en la propia pantalla de Sistema, paso por
      paso. En resumen: se apaga el sistema, se copia el respaldo encima del
      archivo de datos y se vuelve a encender.</p>`
  },

  // ==========================================================
  {
    id: 'actualizar',
    titulo: 'Actualizar el sistema',
    busca: 'actualizar versión nueva instalar archivos novedades',
    cuerpo: `
      <p>Doble clic en <b>ACTUALIZAR.bat</b>. Baja la versión nueva y
      reemplaza los archivos del programa.</p>

      <p><b>Tus datos no se tocan.</b> Viven en la carpeta <code>datos</code>,
      que la actualización nunca toca. Y antes de cambiar nada en la base, el
      sistema hace un respaldo.</p>

      <p>Después de actualizar, en el menú aparece un <b>punto rojo</b> en
      «Qué hay de nuevo»: ahí se ve todo lo que cambió.</p>`
  },

  // ==========================================================
  {
    id: 'problemas',
    titulo: 'Si algo no funciona',
    busca: 'problema error no abre no imprime lento se cerró ayuda soporte',
    cuerpo: `
      <h4>No abre el sistema</h4>
      <ul class="instrucciones">
        <li>Revisa que no esté ya abierto en otra ventana.</li>
        <li>Doble clic en <b>DETENER.bat</b> y luego en <b>INICIAR.bat</b>.</li>
        <li>Si sigue sin abrir, reinicia la computadora y vuelve a intentar.</li>
      </ul>

      <h4>Desde el celular no entra</h4>
      <p>El celular tiene que estar en el <b>mismo WiFi</b> que la PC, y la PC
      tiene que estar encendida con el sistema abierto. La dirección para el
      celular sale en la ventana negra al arrancar.</p>

      <h4>No imprime, o se asoma la ventana de impresión</h4>
      <p>El ticket lo manda <b>el sistema</b> directo a la impresora, sin pasar
      por el navegador. Para eso hay que decirle una vez cómo se llama la
      impresora, en <b>Productos y precios → Impresora de tickets</b>. Ahí
      mismo hay un botón para <b>imprimir una prueba</b> y las instrucciones
      para compartir la impresora en Windows.</p>
      <p>Mientras no esté puesto ese nombre, imprime el navegador y aparece la
      ventana de siempre. Todo funciona igual, solo que más lento.</p>
      <p>Si en vez de acentos salen cuadritos, la impresora usa otra tabla de
      caracteres. Es un número que se cambia en un momento: avísame.</p>

      <h4>Alguien capturó algo mal</h4>
      <p>Nada se borra en este sistema, así que <b>nada se pierde por
      equivocarse</b>. Todo se anula con motivo: conteos, ventas, movimientos
      de caja y registros de producción. Lo hace el gerente o el
      administrador, y queda anotado quién y por qué.</p>

      <p class="ayuda-tip">En <b>Sistema → Bitácora</b> se ve todo lo que ha
      pasado, con quién lo hizo y a qué hora.</p>`
  }
];

export async function vistaAyuda(pantalla) {
  pantalla.innerHTML = `
    <h2>Ayuda</h2>
    <p class="ayuda">
      Cómo se usa cada parte del sistema. Toca un tema para abrirlo, o busca
      lo que necesites.
    </p>

    <input id="busca-ayuda" class="buscador" autocomplete="off"
           placeholder="Buscar: fracción, corte, respaldo…">

    <div id="temas" style="margin-top:14px">
      ${TEMAS.map((t) => `
        <details class="ayuda-bloque" data-tema="${esc(t.id)}"
                 data-busca="${esc((t.titulo + ' ' + t.busca).toLowerCase())}">
          <summary>${esc(t.titulo)}</summary>
          <div class="ayuda-cuerpo">${t.cuerpo}</div>
        </details>`).join('')}
    </div>

    <p class="vacio" id="sin-resultados" hidden>
      Nada coincide con eso. Prueba con otra palabra.
    </p>`;

  // El buscador solo esconde y muestra: no vuelve a dibujar nada, así un
  // tema abierto se queda abierto mientras se escribe.
  const campo = pantalla.querySelector('#busca-ayuda');
  const bloques = [...pantalla.querySelectorAll('[data-busca]')];
  const vacio = pantalla.querySelector('#sin-resultados');

  campo.oninput = () => {
    const q = campo.value.trim().toLowerCase();
    let visibles = 0;

    for (const b of bloques) {
      const coincide = !q || b.dataset.busca.includes(q);
      b.hidden = !coincide;
      if (coincide) visibles++;
      // Buscando, los temas que quedan se abren solos: para eso se busca.
      if (q && coincide) b.open = true;
    }
    vacio.hidden = visibles > 0;
  };

  await pintarPermisos(pantalla);
}

/**
 * La tabla de quién puede qué se pide al servidor, que la arma de los
 * permisos reales. Si mañana cambian los permisos, esta tabla cambia sola.
 */
async function pintarPermisos(pantalla) {
  const caja = pantalla.querySelector('#tabla-permisos');
  if (!caja) return;

  try {
    const { roles, acciones } = await api.obtener('/ayuda/permisos');
    const grupos = [...new Set(acciones.map((a) => a.grupo))];

    caja.classList.remove('cargando');
    caja.innerHTML = `
      <p>Cada quien ve y hace solo lo suyo. Esta tabla no está escrita a mano:
      la arma el sistema con los permisos de verdad, así que siempre dice la
      verdad.</p>

      <div class="tabla-ancha">
        <table class="tabla tabla-permisos">
          <tr>
            <th>Puede…</th>
            ${roles.map((r) => `<th>${esc(r.etiqueta)}</th>`).join('')}
          </tr>
          ${grupos.map((g) => `
            <tr class="grupo"><td colspan="${roles.length + 1}">${esc(g)}</td></tr>
            ${acciones.filter((a) => a.grupo === g).map((a) => `
              <tr>
                <td>${esc(a.texto)}</td>
                ${roles.map((r) => `
                  <td class="marca">${a.quienes.includes(r.rol) ? '✓' : '·'}</td>`).join('')}
              </tr>`).join('')}
          `).join('')}
        </table>
      </div>

      <p class="ayuda-tip">El <b>administrador</b> puede todo, siempre. Por eso
      conviene que haya dos, y que el resto tenga su propio usuario: así la
      bitácora dice de verdad quién hizo cada cosa.</p>`;
  } catch {
    caja.classList.remove('cargando');
    caja.innerHTML = '<p class="vacio">No se pudo cargar la tabla de permisos.</p>';
  }
}
