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
    titulo: 'Producción de hielo: sacar el hielo de los tanques',
    busca: 'producción tanque paño canasta molde sacar rellenar rotación intercalado merma agua purificada potable congelación quién lo sacó otro eventual nombre calidad sellada normal hueca cáscara aguada salada contaminada salmuera condensadores destino cómo salió el hielo mezcla ojo ficha historia última vez F2 atajo panel canastas pendientes a medias turno canasta por canasta terminar',
    cuerpo: `
      <h4>Cómo está armado un tanque</h4>
      <p>Un <b>tanque</b> tiene varios <b>paños</b>. Cada paño tiene
      <b>canastas</b>, y cada canasta tiene <b>moldes</b>. Cada molde que sale
      bien es <b>una marqueta</b>.</p>
      <p class="ayuda-tip">Los tanques se dan de alta en la <b>tuerca ⚙</b> que
      está arriba a la derecha, junto a las pestañas. Ya no vive en el inicio
      ni en el menú: eso se hace una vez y no se vuelve a tocar en años, y
      estaba ocupando el sitio de lo que sí se usa a diario.</p>

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
      en el mismo momento. Por eso el sistema lo pide junto: dices cómo salió
      el hielo, con qué agua se rellenó, y listo. Un solo registro.</p>

      <h4>Todo se anota tocando el paño</h4>
      <p>Se toca el paño en la lista de su tanque y ahí está <b>todo</b>: quién
      lo sacó, cómo salió el hielo, qué se hizo con lo que salió mal, molde
      por molde si hace falta, y canasta por canasta cuando no sale de un
      jalón.</p>
      <p class="ayuda-tip">Hasta la v3.9 había además un botón de
      <b>«Registrar lo que se sacó»</b> que marcaba varios paños de golpe.
      <b>Se quitó.</b> Hacía lo mismo pero peor —no dejaba escoger canastas,
      ni decir qué le pasó a un molde, ni mandar una cáscara al condensador—
      y tener dos maneras de anotar lo mismo solo servía para que la mitad de
      las veces se anotara por la que menos cuenta.</p>
      <p>Arriba, las <b>pestañas de los tanques</b> van grandes y la del
      tanque en el que estás, más grande todavía y en azul. Y al abrir un
      paño, el nombre del tanque va en el título junto al número: anotar en
      el tanque equivocado cuesta un paño entero y no se descubre hasta el
      día siguiente.</p>

      <h4>Cómo salió el hielo</h4>
      <p>Antes el sistema solo sabía tres cosas —salió, se rompió, salió
      hueca— y la fábrica distingue cinco. Ahora al sacar un paño se dice
      <b>cómo salió</b>, con un toque:</p>
      <p>Los seis primeros hablan del <b>frío de esa noche</b>, de mejor a peor:</p>
      <ul>
        <li><b>100% selladas.</b> Bien congeladas, el centro cerrado a tope.
        Salen cuando llueve mucho, cuando no hay venta, o cuando las máquinas
        están congelando muy bien.</li>
        <li><b>Normales.</b> Casi selladas, o les falta poquito. Es lo de
        siempre: con estas no hay quejas. <b>Es lo que el sistema pone solo</b>,
        así que el día normal no cuesta ni un toque de más.</li>
        <li><b>Un poco huecas.</b> Del 70% al 60% selladas. Con una noche más
        hubieran quedado mejor. Alguna gente se queja.</li>
        <li><b>Huecas.</b> El centro casi atraviesa la marqueta, y algunas sí
        lo hacen. La gente se queja pero por necesidad se la lleva.</li>
        <li><b>Cáscaras.</b> 30% de congelación o menos: el centro atraviesa y
        los laterales están delgados. Por lo general no se venden.</li>
        <li><b>Aguadas.</b> No congeló nada: sale agua del molde. No es "muy
        hueca", es que <b>no hay marqueta</b>. Por eso una aguada no cuenta
        ni siquiera para el costo: no se puede repartir el gasto entre
        marquetas que no existen.</li>
      </ul>

      <p>Y dos que <b>no son de frío</b>:</p>
      <ul>
        <li><b>Salada o contaminada.</b> Se rompió el molde y le entró
        salmuera, se oxidó el fondo, o le cayó algo. <b>Puede estar
        perfectamente congelada</b>: el problema no es el frío, es el molde.
        No se toma; a veces se vende a quien solo quiere enfriar y no la va
        a consumir.</li>
        <li><b>Otra cosa.</b> Para lo que no está en la lista. Pide
        <b>escribir qué pasó</b>, y sin eso no se guarda: un "otro" en blanco
        no dice nada dentro de un año. Si resulta que ese "otro" se repite
        treinta veces, ahí está la razón para volverlo un estado propio.</li>
      </ul>

      <p>Eso vale para <b>todo el paño</b>, que es lo que pasa de verdad: la
      fábrica congela bien o mal esa noche y el paño sale parejo. Si UN molde
      salió distinto del resto, se toca ese molde y se elige lo suyo. Los que
      no se tocan van como el paño.</p>

      <h4>Qué se hace con ese hielo</h4>
      <p>Cuando el hielo sale en <b>cáscaras</b>, <b>contaminado</b> o marcado
      como <b>otra cosa</b>, el sistema pregunta qué se hizo con él, porque no
      todo acaba igual:</p>
      <ul>
        <li><b>A los condensadores</b> — lo normal. No se tiran del todo:
        trabajan enfriando.</li>
        <li><b>Al cuarto frío</b> — cuando hay demanda y se van a vender más
        baratas. Entran a la existencia como una marqueta más.</li>
        <li><b>Se botó</b> — no se aprovechó de ninguna manera.</li>
      </ul>
      <p class="ayuda-tip">Una cáscara <b>costó lo mismo</b> que una sellada:
      la misma agua, la misma luz, el mismo molde. Por eso cuenta para el
      costo por marqueta aunque se haya ido al condensador. Lo que <b>no</b>
      hace es contar como hielo del cuarto frío: si contara, el conteo no
      cuadraría nunca y andarías buscando marquetas que no existen. La
      <b>aguada</b> es el único caso que no pregunta destino: de ahí no salió
      nada que mandar a ningún lado.</p>

      <h4>Por qué importa anotarlo</h4>
      <p>Una marqueta hueca <b>se cobra igual</b> que una sellada, así que en
      el dinero no se nota. Se nota en el mostrador, en las quejas — y esa
      información se perdía el mismo día. Ahora queda escrita, y cuando la
      mezcla se corre hacia lo hueco varios días seguidos, algo está pasando
      (el amoniaco, un compresor, el calor de mayo) y se ve <b>antes</b> de
      que una máquina se pare.</p>

      <p>La mezcla del día sale en <b>Lo de hoy</b>, en la hoja de
      <b>Los números</b> y en el <b>corte de turno</b> impreso. Nunca sale el
      total solo: dos días con las mismas marquetas pueden ser un buen día y
      uno malo, y lo que los separa es el reparto.</p>

      <h4>El molde que falla</h4>
      <p>Los moldes que fallan quedan <b>marcados en rojo</b>, con las veces
      seguidas que han fallado. Falla el molde que salió <b>peor que el resto
      de su propio paño</b>: si el paño entero salió hueco, eso es la fábrica
      esa noche y no marca a nadie; pero si un molde sale cáscara mientras sus
      vecinos salen normales, ese molde tiene algo —está chueco, gotea, le
      falta salmuera alrededor— y hay que ir a verlo.</p>
      <p>La <b>contaminada</b> es la excepción: esa marca siempre, aunque el
      paño entero esté salado. Salmuera dentro del molde es un molde roto, y
      si están rotos varios hay que verlos todos.</p>

      <h4>La temperatura de la salmuera</h4>
      <p>De vez en cuando se mide la salmuera de un tanque. Se toman
      <b>tres</b> —cerca de los serpentines, en la salida más cercana y en la
      más lejana— y el sistema saca el promedio. No hace falta ningún
      horario: se anota cuando se mide.</p>
      <p>Está en el panel de la derecha de Producción de hielo, con el botón
      <b>🌡 Medir</b>. Ahí mismo se ve cuándo fue la última vez de ese tanque
      y la lista de las anteriores.</p>
      <p class="ayuda-tip">El promedio <b>no se guarda</b>: se saca de las tres
      tomas cada vez que se mira. Un promedio guardado es un número que puede
      dejar de cuadrar con los suyos el día que alguien corrija una toma.</p>

      <h4>Sacar canasta por canasta</h4>
      <p>Un paño no siempre sale de un jalón. A veces se saca una canasta y
      no se toca la siguiente hasta que esa se gasta, para darle más horas al
      hielo. Para eso, en la pantalla del paño cada canasta trae su
      <b>casilla</b>: desmarca las que hoy no vas a sacar y el botón cambia a
      <b>«Sacar 2 canastas»</b>. Las demás quedan pendientes.</p>

      <p>A partir de ahí el paño queda <b>a medias</b>, y eso significa que
      <b>nadie puede pasar al siguiente paño</b> hasta terminarlo. Aparece
      así en la lista —"faltan 3 de 4 canastas, lo empezó Chema"— y también
      en el papel de <b>Números a sacar</b>, para que el turno que llega
      sepa qué hacer sin preguntarle a nadie.</p>

      <p>Al día siguiente se entra al mismo paño y solo salen <b>las que
      faltan</b>: las de ayer se ven marcadas con un ✓, con quién las sacó y
      a qué hora, y ya no se pueden volver a registrar. <b>Cada canasta
      guarda su propio responsable</b>, así que si Chema sacó una y Juan las
      otras tres, el papel del día lo dice.</p>

      <p class="ayuda-tip">¿Y si el hielo que falta <b>ya no va a salir</b>?
      No se borra: se saca marcándolo por lo que es —<b>aguada</b>,
      <b>se rompió</b>, lo que haya pasado— y con eso el paño se cierra y la
      rotación avanza. Un paño abandonado a medias trabaría el tanque para
      siempre.</p>

      <h4>Mirar un paño sin tocarlo</h4>
      <p>Cada paño tiene un <b>👁 al lado</b>. Ábrelo y verás la historia de
      ese paño: cuándo se sacó la última vez, quién, cuántas horas llevaba
      congelando, <b>cómo salió cada molde</b> y las veces anteriores. Es lo
      que se hace al ver un molde en rojo y preguntarse qué le pasó.</p>
      <p class="ayuda-tip">Eso <b>no pide permiso a nadie</b>, porque mirar no
      cambia nada. El PIN se pide para SACAR el paño, y desde ahí mismo está
      el botón de <b>Desbloquear</b> cuando de verdad se va a mover algo.</p>

      <h4>Lo que se ve sin entrar</h4>
      <p>En la lista, cada paño dice <b>cuándo se sacó la última vez, quién lo
      sacó y cuántas horas llevaba</b>. Y a la derecha hay un panel con cómo
      está el tanque ahora —listos, congelando, a medias, fuera—, cuántos
      moldes vienen saliendo peor que sus vecinos, y cómo salió el hielo de
      hoy en toda la fábrica.</p>
      <p class="ayuda-tip">La tecla <b>F2</b> saca los <b>números a sacar</b>
      sin buscar el botón. Con el obrero enfrente esperando, eso ahorra el
      viaje del ratón.</p>

      <h4>Los números que siguen</h4>
      <p>El gerente y el administrador pueden imprimir <b>la lista de los
      números que tocan</b>, con tanque, fecha y hora. Se les entrega a los
      muchachos en la mañana y a las 3 te dicen qué sacaron.</p>

      <h4>Quién lo sacó</h4>
      <p>En la lista de "¿Quién lo sacó?" salen <b>solo los operarios</b>:
      sacar paños es su trabajo. Cuando saca alguien más —un eventual de un
      día, alguien que vino a ayudar, el patrón— se elige <b>Otro…</b> y se
      escribe su nombre tal cual. Ese nombre queda guardado, y sus paños
      cuentan a su nombre en el día, no al del cajero.</p>
      <p class="ayuda-tip">Quién lo <b>anotó</b> no se pregunta nunca: es el
      usuario que tiene la sesión abierta, y queda guardado siempre. Una cosa
      es quién estuvo en la grúa y otra quién lo capturó.</p>

      <p class="ayuda-tip">Los obreros no capturan nada. Ellos sacan hielo y
      reportan; quien captura es quien recibe la existencia.</p>`
  },

  // ==========================================================
  {
    id: 'existencia',
    titulo: 'El cuarto frío: cuánto hielo hay',
    busca: 'existencia conteo cuarto frío contar marquetas fracción 5/8 cuadre faltante vendido salidas almacén horarios hielo cortado gourmet bolsas turnos nocturno merma derretida rota regalada',
    cuerpo: `
      <p class="ayuda-tip"><b>Contar el cuarto frío ya no se hace aquí.</b>
      Desde la v4.1 se cuenta <b>al terminar el turno</b>, en la caja, junto
      con los paños del día — que es como se canta de verdad. Esta pantalla
      es para <b>mirar</b> lo que hay, anotar lo que se derritió, y revisar
      los conteos que ya se hicieron. Se entra desde
      <b>Producción de hielo › 🧊 El cuarto frío</b>.</p>

      <h4>Los turnos de la fábrica</h4>
      <p>El de la mañana va de <b>7 a 3</b>, el de la tarde de <b>3 a 8</b>, y
      a las 8 se cierra al público. A veces —no siempre— hay un
      <b>trabajador nocturno</b> que saca hielo a media noche o a las 3 de la
      mañana. Ese no vende: solo saca, y lo suyo se anota igual que lo demás,
      a su nombre.</p>

      <h4>Anotar lo que se derritió o se rompió</h4>
      <p>Con <b>💧 Anotar hielo derretido o roto</b>. Se escribe cuánto y qué
      le pasó: se derritió, se rompió, se regaló, se usó en la fábrica, u
      otra cosa.</p>
      <p class="ayuda-tip">Esto importa más de lo que parece. Sin anotarlo,
      el hielo derretido aparece dentro del <b>faltante</b>, revuelto con el
      que se fue sin pagar. Son dos cosas muy distintas: una es física y no
      tiene remedio, la otra es un problema que hay que atender.</p>

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

      <h4>El historial de conteos</h4>
      <p>El botón <b>Historial de conteos</b> abre la lista de todos los
      cuadres, del más nuevo al más viejo. <b>Tocar un renglón no hace
      nada</b>: es una lista para mirar. Lo que se puede hacer está en los
      tres botones de la izquierda de cada renglón:</p>
      <ul>
        <li><b>👁</b> — vuelve a enseñar el cuadre completo de aquel día, con
        los números tal como se guardaron.</li>
        <li><b>🖨</b> — vuelve a sacar el papel por la impresora de tickets,
        las veces que haga falta.</li>
        <li><b>🗑</b> — anula el conteo. Solo le sale al <b>gerente</b> y al
        <b>administrador</b>; los demás ni lo ven.</li>
      </ul>

      <h4>Si te equivocaste al capturar</h4>
      <p>El conteo <b>no se borra</b>: se anula, con motivo. Al anularlo vuelve
      a valer el conteo anterior. Eso lo hace el gerente o el administrador.
      El renglón se queda tachado en el historial, con quién lo anuló y por
      qué.</p>

      <p class="ayuda-tip">Cada conteo guarda sus números <b>congelados</b>. Si
      mañana corriges una sacada vieja, el corte que ya hiciste no se mueve.</p>`
  },

  // ==========================================================
  {
    id: 'venta',
    titulo: 'Punto de venta: cobrar',
    busca: 'venta cobrar ticket precio fracción cambio devolución billete folio cancelar imprimir teclado enter f10 f2 f3 f4 código rápido categorías nueva venta espera pendiente aviso bolita se acabó agotado poco hielo inventario bajo atajos gastos historial reloj cotización cotizar precio papel sujetos a cambio temperatura clima grados afuera termómetro',
    cuerpo: `
      <p>Es la pantalla que se abre al entrar, porque es la que se usa casi
      todo el día. A la izquierda lo que lleva el cliente, a la derecha los
      botones. <b>No se desplaza:</b> todo está siempre en el mismo sitio.</p>

      <h4>La temperatura de afuera</h4>
      <p>Junto al reloj, abajo, sale la <b>temperatura de ahora</b>, tomada
      de internet. En una fábrica de hielo el clima es materia prima: en
      mayo, cuando calientan los tanques, el hielo no se forma por más días
      que pase en el molde. Tenerla a la vista mientras se cobra la deja
      ligada a los días buenos y a los malos sin que nadie apunte nada, y
      además se va guardando la de cada día.</p>
      <p class="ayuda-tip"><b>Si no hay internet no pasa nada.</b> No sale
      ningún error: simplemente no se enseña, o se enseña la última que se
      pudo tomar diciendo que es vieja. La venta nunca depende de esto.</p>

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
      <p><em>F6</em>, o el botón <b>👤 Cliente</b>. Se teclea el <b>número</b>
      del cliente o su nombre, y enter.</p>
      <p>En un ticket de <b>mayoreo</b> no hace falta acordarse: al apretar
      <em>F10</em> la caja lo pide sola antes de cobrar. Está explicado
      completo en <b>Precios de mayoreo</b>.</p>
      <p><b>Fiarle</b> es otra cosa y tiene su propio botón en esa misma
      lista: la mayoría de los mayoristas pagan en el momento.</p>

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

      <h4>El número del ticket</h4>
      <p>Los tickets se numeran por año: <b>2026-412</b> es el ticket 412 de
      2026. El 1 de enero vuelve a empezar en 1, así que el número nunca se
      hace tan grande que no se pueda decir por teléfono.</p>
      <p>Para buscarlo da igual cómo lo escribas: <b>2026-412</b> o solo
      <b>412</b>. Vale aquí (<em>F3</em>), en el <b>Historial</b> y al hacer
      un cambio de ticket.</p>

      <h4>Devolverle el dinero a un cliente</h4>
      <p>Pasa todos los días: se cansó de esperar la fila, llevaba prisa, o
      el hielo no estaba bien congelado. Regresa a la caja con su ticket y
      hay que regresarle su dinero.</p>
      <ol class="instrucciones">
        <li><em>F3</em> para ver los tickets de hoy y encuentra el suyo.</li>
        <li>El botón <b>↩</b> de su renglón.</li>
        <li>Escoge <b>por qué</b> regresa, de la lista.</li>
      </ol>
      <p>Con eso el sistema cancela el ticket, el hielo vuelve al cuarto
      frío, la caja se ajusta sola y <b>el cajón se abre</b> para que saques
      los billetes.</p>
      <p class="ayuda-tip">El motivo es de una lista corta a propósito.
      Veinte <em>"se cansó de esperar"</em> en un mes no son veinte clientes
      raros: son un problema de la fila, y eso solo se ve si todos se
      anotaron igual.</p>
      <p>Si el ticket es de <b>otro turno</b>, el dinero entró otro día pero
      sale del cajón de hoy: queda anotado como salida para que tu corte no
      te salga corto. Y si era <b>fiado</b>, no sale dinero de ningún lado:
      simplemente deja de deberlo.</p>
      <p>Devolver es de <b>gerente</b>: sacar dinero del cajón por algo que
      ya se cobró se revisa.</p>

      <h4>Buscar un ticket de hoy, verlo o sacar una copia</h4>
      <p><em>F3</em>, o el botón 🧾. Se busca por número, por el importe o por
      la hora, entre <b>los de hoy</b>: aquí se busca el ticket que el cliente
      acaba de perder, no el de hace tres semanas.</p>
      <p>Cada renglón dice ya <b>qué se llevó</b> el cliente, así que casi
      nunca hace falta abrir nada. <b>Copia</b> lo vuelve a imprimir marcado
      como <b>COPIA</b>, para que no se confunda con el original.</p>
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
      la hora. Los últimos 30 salen solos.</p>

      <h4>Solo cotización</h4>
      <p>A veces solo piden el precio en papel: "¿a cómo me saldrían
      veinte?". Se arma el ticket normal y en vez de cobrar se toca
      <b>📋 Solo cotización</b>: sale impreso con los precios de hoy, la
      leyenda <b>precios sujetos a cambio sin previo aviso</b> y la fecha.</p>
      <p class="ayuda-tip">Una cotización <b>no es una venta</b>: no tiene
      folio, no abre el cajón, no toca la existencia y no entra al corte.
      El ticket se queda armado por si el cliente dice "sí, dámelo". Si
      lleva mayoreo, primero hay que decir de quién es, para cotizar con su
      lista.</p>`
  },

  // ==========================================================
  {
    id: 'caja',
    titulo: 'Caja: el turno y el corte',
    busca: 'caja turno fondo corte arqueo gasto retiro efectivo cerrar cuadrar sobra falta corregir corte firmado olvidó gasto agregar quitar administrador motivo copia comprobante reimprimir volver a imprimir papel existencia contar hielo paños bolsas gourmet entregar entregado sin contar dos papeles detalle',
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

      <h4>Lo que se derrite también sale del cuarto frío</h4>
      <p>En <b>Existencia</b>, botón <b>💧 Anotar merma</b>: cuánto hielo se
      perdió y por qué (se derritió, se rompió, se regaló, se usó en la
      fábrica). Eso baja lo que debería haber, igual que una venta, pero sin
      dinero de por medio.</p>
      <p class="ayuda-tip">Anotarlo es lo que separa <b>lo que se derritió</b>
      —que no tiene remedio— de <b>lo que se fue sin pagar</b>, que sí es un
      problema. Antes iban revueltos en el mismo "faltante".</p>

      <h4>Terminar el turno: cuatro pasos</h4>
      <p>Hasta la v4.0 esto era dos cosas: el corte de caja por un lado y
      <b>anotar la existencia</b> por otro. Eran <b>la misma cosa hecha dos
      veces</b> —se hacen al mismo tiempo, con la misma persona enfrente y
      con los mismos números en la boca—, así que ahora es un solo momento.
      Con el botón <b>Terminar el turno</b> aparecen, en el orden en que se
      cantan de verdad:</p>
      <ol class="instrucciones">
        <li><b>¿Qué paños se sacaron?</b> Es la pantalla de Producción de
        siempre, entera: se toca cada paño y se anota como todos los días,
        con quién lo sacó, cómo salió el hielo y canasta por canasta.</li>
        <li><b>¿Cuánto hielo queda en el cuarto frío?</b> Tal como te lo
        dictan: 14 marquetas y una fracción.</li>
        <li><b>¿Se cortó hielo para bolsas?</b> Sí o no, y cuántas
        marquetas.</li>
        <li><b>¿Cuántas bolsas salieron?</b> Solo si se cortó.</li>
      </ol>
      <p class="ayuda-tip">Los paños van <b>primero</b> y no es capricho:
      anotando el conteo antes, la producción de esa jornada todavía no está
      capturada y el cuadre sale mal — parece que SOBRA hielo, cuando lo que
      falta es el registro.</p>

      <h4>El dinero NO se cuenta al cerrar</h4>
      <p>Los cortes son rápidos y hay que seguir atendiendo. Así que el
      turno se cierra <b>sin contar</b>: sale el papel con <b>lo que debería
      haber</b> en el cajón, el cajero lo entrega y sigue vendiendo.</p>

      <pre class="ayuda-formula">fondo + cobrado + entradas − gastos = DEBERÍA HABER</pre>

      <p>Cuando el dueño o el gerente reciben el dinero, lo cuentan y lo
      anotan en ese corte: <b>Cortes › el turno › 💵 Anotar lo que me
      entregaron</b>. Recién entonces existe la diferencia.</p>

      <pre class="ayuda-formula">debería haber − lo que entregaron = DIFERENCIA</pre>

      <p>Si <b>falta</b>: casi siempre es un cambio dado de más o un gasto que
      no se anotó. Si <b>sobra</b>: un cambio que no se dio, o una venta
      cobrada sin registrar.</p>
      <p class="ayuda-tip">Mientras nadie haya contado, el corte dice
      <b>«sin contar»</b>, no «cuadró exacto». Decir que cuadró cuando nadie
      ha contado sería inventarse el dato. En la lista de <b>Cortes</b> sale
      arriba cuántos turnos están esperando que se anote su dinero. Anotarlo
      es del <b>gerente</b> o del <b>administrador</b>: que lo hiciera el
      propio cajero sería firmarse a sí mismo la entrega.</p>

      <h4>El corte sale en dos papeles</h4>
      <ul>
        <li>El <b>primero</b> es el del dinero, con espacio para la firma y
        una raya para escribir a mano lo que se entrega. Los gastos van solo
        como <b>total</b>, con cuántos son.</li>
        <li>El <b>segundo</b> es el <b>detalle</b>: los gastos y las entradas
        uno por uno, con sus sumas, en dos columnas para ahorrar papel.</li>
      </ul>
      <p class="ayuda-tip">Son dos porque son de dos personas distintas: el
      primero se entrega con el cajón, el segundo se queda en la carpeta.
      Si el turno no tuvo ningún gasto ni entrada, el segundo no se imprime:
      media hoja en blanco que dice GASTOS es papel tirado todos los días.</p>

      <h4>Mandar el corte por WhatsApp</h4>
      <p>Abajo del corte, <b>📲 Mandar por WhatsApp</b>. El sistema arma la
      <b>imagen del ticket</b> y abre el menú de compartir del celular, donde
      WhatsApp sale arriba.</p>
      <p>En la computadora no existe ese menú: ahí se <b>baja la imagen</b> y
      se abre WhatsApp Web con el resumen ya escrito. La imagen se arrastra al
      chat.</p>
      <p class="ayuda-tip">La imagen se arma <b>en el aparato</b>: no se sube
      a ningún lado ni pasa por internet hasta que tú la mandas.</p>

      <h4>Otra copia del comprobante</h4>
      <p>Cada gasto y cada entrada imprimen su comprobante al anotarse. El
      papel se pierde, se moja, o hace falta <b>uno para quien se llevó el
      dinero y otro para la carpeta</b>: con el <b>🖨</b> del renglón sale
      otra vez.</p>
      <p class="ayuda-tip">La copia sale marcada <b>** COPIA **</b> hasta
      arriba, para que no se cuente dos veces el mismo gasto al cuadrar el
      mes. Y <b>no vuelve a abrir el cajón</b>: el dinero ya se movió cuando
      se anotó. Desde el <b>Historial</b> también, con el botón
      <b>Copia</b>.</p>

      <h4>Corregir un corte ya firmado</h4>
      <p>Pasa: a la cajera <b>se le olvidó anotar un gasto</b>. Cerró su
      turno, el cajón salió $200 corto y ahí quedó escrito un faltante que
      no existió. Al día siguiente llega con el ticket de la gasolina en la
      mano y lo demuestra.</p>
      <p>En <b>Historial de cortes</b>, los <b>⋯</b> de cada renglón abren
      la pantalla de corregir. Ahí se le puede:</p>
      <ul>
        <li><b>Agregar el gasto que se olvidó</b> (o una entrada). Entra al
        turno que ya se cerró, con la fecha de ese turno —no la de hoy—,
        porque ahí fue donde pasó.</li>
        <li><b>Quitarle uno que no era.</b> No se borra: queda tachado con
        su motivo y deja de contar.</li>
      </ul>
      <p>En los dos casos el corte <b>se vuelve a sacar solo</b> y el
      faltante se corrige.</p>
      <p class="ayuda-tip">Esto es <b>solo del administrador</b>, y <b>pide
      motivo</b>. Lo que se contó en el cajón <b>no se toca</b> —eso fue lo
      que había—, pero sí lo que <b>debía</b> haber. Y lo que decía el papel
      firmado se guarda: un corte corregido enseña las dos cifras, con quién
      lo corrigió, cuándo y por qué. Los renglones agregados después quedan
      marcados, para que al reimprimirlo se distingan de los que sí estaban
      en el papel.</p>

      <h4>Cosas que conviene saber</h4>
      <ul class="instrucciones">
        <li>Solo puede haber <b>un turno abierto</b> a la vez.</li>
        <li>Un corte cerrado <b>no cambia solo</b>: si mañana cancelas una
        venta de hoy, el corte firmado se queda como está. Cambiarlo es un
        acto aparte y a propósito, el de arriba.</li>
        <li>Al cerrar el turno, el siguiente se abre solo cuando alguien
        vuelva a entrar con su PIN.</li>
      </ul>

      <h4>Los gastos que se repiten</h4>
      <p>El desayuno de los muchachos es todos los días y nunca es igual: a
      veces $50, a veces $100. Escrito a mano, a fin de mes hay "Desayuno",
      "desayunos" y "DESAYUNO" —tres conceptos y ninguna cuenta—, porque
      nadie escribe igual dos veces.</p>
      <p>Los que se repiten se dan de alta una vez en
      <b>Caja › Gastos que se repiten</b>, y el cajero los <b>toca</b>: pone
      la cantidad y sale el comprobante. A fin de mes se puede ver cuánto se
      fue en cada cosa.</p>
      <ul>
        <li><b>Renombrarlo no parte su historia.</b> Si "Desayuno" pasa a
        llamarse "Comida de los muchachos", los gastos viejos siguen sumando
        ahí, y los comprobantes que ya se firmaron siguen diciendo
        "Desayuno": el papel dice lo que decía ese día.</li>
        <li><b>Darlo de baja no borra nada.</b> Deja de salir en la caja, y
        lo que ya se anotó con él sigue contando: un gasto de marzo no
        desaparece porque en agosto se deje de usar.</li>
        <li><b>Otro</b> sigue ahí para el gasto que no se repite. Obligar a
        dar de alta un concepto para pagarle una vez a un plomero sería peor
        que el problema.</li>
      </ul>

      <h4>Cuando el turno se releva</h4>
      <p>Se va la luz a las diez de la noche y el turno no se puede cortar. A
      la mañana llega otro cajero, pone su PIN y sigue vendiendo sobre el
      mismo turno. Antes el corte salía a nombre del primero y el segundo no
      aparecía por ningún lado.</p>
      <p>Ahora, al cortar, sale <b>un papel por cada quien</b> con lo suyo,
      además del corte del turno. <b>El arqueo no se parte</b>: el dinero del
      cajón es uno solo y los billetes no saben de quién son. Lo que dice
      cada papel es cuánto metió esa persona.</p>

      <h4>Qué se imprime al cerrar</h4>
      <p>Al terminar el turno salen solos, en un tirón:</p>
      <ol>
        <li>El <b>corte del turno</b>, que es el que se firma.</li>
        <li>Un <b>papel por cajero</b>, si hubo relevo.</li>
        <li>El <b>resumen del día</b>: cuánto hielo queda en el cuarto frío y
        qué paños se sacaron, con cuántas marquetas dio cada uno.</li>
      </ol>
      <p class="ayuda-tip">Van juntos porque juntos es como se leen. Si el
      cajón cuadra pero falta hielo, el problema no está en la caja. Y al
      revés. En papeles separados nadie los junta.</p>`
  },

  // ==========================================================
  {
    id: 'productos',
    titulo: 'Productos y precios: qué aparece en la caja',
    busca: 'productos categorías catálogo precios códigos alta baja refrescos garrafones botones color inventario costo ganancia margen foto pedir mínimo contar existencias piezas bolsa hielo gourmet cortado bolsas',
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
      navegador y aparece la ventana de impresión.</p>
      <h4>La bolsa de hielo gourmet</h4>
      <p>Viene dada de alta desde el primer día, pero <b>de baja y sin
      precio</b>, y no sale en la caja hasta que hay bolsas de verdad: un
      producto con existencia en cero aparecería como <b>agotado</b> desde
      siempre.</p>
      <p>En cuanto un corte anota bolsas —al terminar el turno, paso 4— la
      bolsa <b>se da de alta sola</b> y le entran esas piezas al inventario.
      Ahí es cuando toca <b>ponerle su precio</b>: sin él no se puede
      vender.</p>
      <p class="ayuda-tip">Cortar marquetas no es perder hielo: es
      <b>transformarlo</b>. Sale del cuarto frío y entra como bolsas, y desde
      ahí se vende con la misma cuenta que todo lo demás — venderlas se las
      resta solas. Si se anula ese corte, las bolsas se van con él: si el
      hielo vuelve al cuarto frío y las bolsas se quedan, está contado dos
      veces.</p>`
  },

  // ==========================================================
  {
    id: 'clientes',
    titulo: 'Clientes y crédito: a quién se le fía',
    busca: 'clientes crédito fiar fiado deuda debe abono abonar cobranza límite plazo vencido saldo cuenta a favor cartera calle logo foto imagen retrato telefono marcar llamar',
    cuerpo: `
      <p>La regla de la fábrica es que <b>se le fía solo a los clientes que
      damos de alta</b>. Al público en general no. Por eso en la caja el
      botón de fiar abre una lista: no hay forma de escribir un nombre a
      mano con gente esperando.</p>

      <h4>Dar de alta a alguien</h4>
      <p>En <b>Clientes</b>, botón <b>＋ Cliente</b>. Solo se pide el nombre;
      lo demás —negocio, teléfono, límite, plazo— se llena tocándolo en su
      ficha, y casi nunca se sabe todo el primer día.</p>

      <h4>Su logo o su foto</h4>
      <p>Un mayorista es una tienda con rótulo. En su ficha, el botón
      <b>📷</b> de la esquina del retrato le pone <b>su logo o una foto</b>,
      y desde entonces aparece con ella en la lista.</p>
      <p>No es adorno: veinte renglones de texto se leen todos igual y hay
      que ir deletreando nombres para encontrar a alguien; con la cara al
      lado se reconoce sin leer. Es la misma razón por la que los productos
      llevan foto.</p>
      <ul>
        <li>Es <b>opcional</b>. A quien no tenga logo se le pone la
        <b>inicial de su nombre</b> en un círculo de color — y el color sale
        del propio nombre, así que es siempre el mismo para el mismo
        cliente, que es lo que lo hace útil para reconocerlo de reojo.</li>
        <li>PNG, JPG o WEBP, hasta 2 MB. Se guarda en la carpeta de
        <b>datos</b>: actualizar el sistema no se la lleva.</li>
        <li>El <b>×</b> de la esquina de arriba se lo quita, y vuelve a su
        inicial.</li>
      </ul>

      <h4>Su ficha</h4>
      <p>Arriba, juntos, <b>quién es y cuánto debe</b>: son la misma
      pregunta y se miran a la vez. Debajo, su <b>teléfono</b>, que desde la
      tablet o el celular se toca para marcarle — es lo primero que uno
      busca cuando alguien debe.</p>
      <p>Y sus datos en dos bloques, porque son dos cosas distintas y se
      tocan en momentos distintos: <b>quién es y dónde está</b> (nombre,
      negocio, teléfono, dirección) y <b>su crédito y su precio</b> (el
      límite, el plazo y qué lista de mayoreo se le cobra).</p>

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
    busca: 'mayoreo precio especial lista mayorista nevería descuento 1m 12m media marqueta número de cliente F6 cliente precio distinto',
    cuerpo: `
      <p>Hay clientes que compran en cantidad y tienen <b>su propio precio</b>.
      Se cobra tecleando, sin buscar a nadie primero.</p>

      <h4>Los dos botones del mayoreo</h4>
      <p>En el catálogo del hielo hay dos productos aparte:</p>
      <ul>
        <li><b>1m</b> — una marqueta a precio de mayoreo</li>
        <li><b>12m</b> — media marqueta a precio de mayoreo</li>
      </ul>
      <p>No tienen precio propio: se cobran con la <b>lista de mayoreo</b> que
      le toque al cliente. Da igual si tecleas <b>1m</b> o <b>1M</b>.</p>
      <p class="ayuda-tip">No hay un "mínimo de mayoreo" que configurar: el
      mínimo lo dicen los botones que existen. Si solo hay marqueta y media,
      no hay forma de pedir mayoreo por un cuarto.</p>

      <h4>Cobrar de mayoreo, paso a paso</h4>
      <ol class="instrucciones">
        <li>Tecleas <b>1m</b> y <em>Enter</em>, tantas veces como marquetas
        te pidieron. (O tocas el número del renglón y escribes 5.)</li>
        <li><em>F10</em>. En vez de ir al cobro, la caja pregunta
        <b>¿de quién es el ticket?</b></li>
        <li>Tecleas el <b>número del cliente</b> —"7"— o las primeras letras
        de su nombre, y <em>Enter</em>.</li>
        <li>Sigue el cobro de siempre.</li>
      </ol>
      <p>Todo con el teclado, sin soltarlo. Y todo está también en botones,
      para quien prefiera el dedo.</p>

      <h4>Dos reglas que conviene saber</h4>
      <ul>
        <li><b>Un ticket con mayoreo no se cobra sin nombre.</b> El precio
        especial es de alguien; si no queda escrito de quién, al mes nadie
        puede explicar por qué esa marqueta salió a $240.</li>
        <li><b>Si te sales del cobro, el cliente se suelta</b> y hay que
        volver a decir quién es. Un cliente pegado al ticket es la forma de
        cobrarle a uno el precio del anterior.</li>
      </ul>

      <h4>El número del cliente</h4>
      <p>Cada cliente tiene un número que le toca al darlo de alta y que
      <b>no cambia nunca</b>, ni aunque se dé de baja. Sale en su ficha, en
      la lista de <b>Clientes</b> y en la de la caja. Es lo que se teclea.</p>

      <h4>Es una LISTA, no un descuento</h4>
      <p><b>Mayoreo 1</b> es una lista de precios completa, donde la marqueta
      vale $240 en vez de $264. A esa lista se apuntan los clientes que la
      tienen. Subirle el precio a la lista <b>se lo sube a todos de una
      vez</b>, que es como se maneja de verdad.</p>
      <p>Y cada fracción lleva <b>su propio precio</b>, igual que en la de
      público: el cuarto no sale de dividir la marqueta entre cuatro. Cortar
      da trabajo, y ese trabajo no baja por vender más.</p>

      <h4>Crear una lista y ponerle precios</h4>
      <p>En <b>Productos y precios</b>, categoría <b>Hielo</b>, hasta abajo:
      <b>🏷️ Precios de mayoreo</b>.</p>
      <ul>
        <li><b>＋ Nueva lista de mayoreo</b> y le pones nombre. Nace copiando
        los precios de público: le bajas los que toque y <b>Guardar</b>.</li>
        <li>La lista marcada como <b>normal</b> es la que se cobra a quien no
        tiene una propia. Con <b>Hacerla la normal</b> se cambia.</li>
        <li>Cada lista dice <b>cuántos clientes</b> la usan, para que sepas a
        cuántos les estás cambiando el precio.</li>
      </ul>

      <h4>Darle su lista a un cliente</h4>
      <p>En <b>Clientes</b>, en su ficha, el renglón <b>Precio de mayoreo</b>.
      Dejarlo en "el normal" le cobra la lista de siempre. En la lista de la
      izquierda, los que tienen lista propia salen con 🏷️.</p>

      <h4>Un ticket puede llevar los dos precios</h4>
      <p><em>"Dame una a mayoreo y un cuarto para la casa"</em>: tecleas
      <b>1m</b> y <b>14</b>. Cada renglón se cobra con su lista.</p>

      <h4>Lo que no puede pasar</h4>
      <ul>
        <li><b>El precio lo decide el servidor.</b> La pantalla lo calcula
        para que se vea al instante, pero al cobrar se decide otra vez desde
        cero.</li>
        <li><b>El precio queda copiado en el ticket.</b> Subirle mañana a la
        lista no cambia los tickets de hoy.</li>
        <li>Un cliente <b>dado de baja</b> pierde su lista propia. Una lista
        dada de baja cae a la normal.</li>
        <li>El ticket impreso dice <b>de quién fue y con qué lista</b>.</li>
      </ul>`
  },

  // ==========================================================
  {
    id: 'empresa',
    titulo: 'Las cuentas de la empresa: lo grande y la luz',
    busca: 'empresa gastos grandes amoniaco sal aceite barril maquinaria refacciones mantenimiento proveedor proveedores directorio manual teléfono horario factura pdf recibo luz cfe kwh kilowatt medidor marqueta mes corte del 12 al 12 periodo traspaso caja fuerte cada cuánto se compra ritmo medido dar de baja lista mayoreo iva devolucion devoluciones sat hacienda acreditamiento recuperar gdmth franja franjas base intermedia punta demanda factor de potencia lectura multiplicador tarifa horaria',
    cuerpo: `
      <p>Aquí va el <b>dinero grande</b>: el que se paga con cheque, con
      transferencia o sacando efectivo aparte, y que <b>nunca pasa por el
      cajón</b>. El amoniaco, la sal, los barriles de aceite, las
      refacciones, el mantenimiento, la maquinaria y el recibo de la luz.</p>

      <p class="ayuda-tip">Esta pantalla <b>no toca la caja</b>. No le mueve
      el arqueo del turno, no le cambia un peso al corte y no aparece en el
      ticket de nadie. Son dos libros distintos a propósito: el del cajón,
      que se cuadra todos los días, y el de la fábrica, que se mira al mes.</p>

      <h4>El mes del negocio</h4>
      <p>El mes del calendario casi nunca es el mes del negocio. Si su recibo
      de luz va <b>del 12 al 12</b>, con el botón <b>Cambiar dónde empieza el
      mes</b> se pone 12 y de ahí en adelante <b>todo el sistema cuenta los
      meses así</b>: agosto es del 12 de agosto al 11 de septiembre.</p>
      <ul>
        <li>Se puede del <b>1 al 28</b>. Del 29 en adelante no, porque
        febrero no tiene esos días y habría meses sin principio.</li>
        <li>El mes se llama como el mes en que <b>empieza</b>: "Agosto 2026"
        es del 12 de agosto al 11 de septiembre.</li>
      </ul>
      <p class="ayuda-tip"><b>Ojo:</b> el día del corte es <b>uno solo para
      todo el sistema</b>, no uno por mes. Si se cambia, los meses que ya
      pasaron se vuelven a partir con la regla nueva y sus totales cambian.
      No se pierde nada —cada gasto guarda su propia fecha, y cada recibo de
      la CFE las suyas— pero un mes que decía $40,000 puede decir otra cosa.
      Conviene elegirlo una vez y dejarlo.</p>

      <h4>Anotar un gasto grande</h4>
      <p>Además del monto se pide <b>cuánto</b> y <b>de qué</b>: un cilindro
      de amoniaco, tres sacos de sal, medio barril de aceite.</p>
      <p>Eso no es burocracia. Con la cantidad, el sistema saca <b>cuánto
      costó la unidad</b>, y ese número es el que contesta "¿está subiendo el
      barril de aceite?". Sin él, $12,000 puede ser una ganga o un robo y no
      hay forma de saber cuál.</p>
      <ul>
        <li><b>Proveedor</b> y <b>factura</b> para poder buscarlo después.</li>
        <li><b>El papel</b>: se le pega el PDF o la foto de la factura. Se
        guarda en la carpeta de datos, así que actualizar el programa
        <b>no se lo lleva</b>.</li>
      </ul>

      <h4>Cuándo fue la última vez</h4>
      <p>Cada renglón dice cuándo se compró esa cosa por última vez y
      <b>cuántos días hace</b>, aunque haya sido en otro mes: la pregunta
      "¿hace cuánto que no compro sal?" no se contesta mirando solo este mes.</p>
      <p>El sistema <b>aprende solo</b> cada cuánto se compra cada cosa: lo
      saca de repartir el tiempo entre su primera y su última compra. Cuando
      ya pasó más tiempo del que suele pasar, el renglón dice <b>toca
      pronto</b>. No es una alarma —nadie sabe cuándo se acaba un cilindro de
      amoniaco— sino un recordatorio de mirarlo.</p>

      <h4>Los recibos de la luz</h4>
      <p>Se captura el papel tal como viene: <b>de qué día a qué día</b>
      midieron, cuántos <b>kWh</b> y cuánto se pagó. Las cuentas se hacen con
      <b>las fechas del recibo</b>, no con el mes del negocio, porque ese es
      el único periodo en el que esos kilowatts significan algo.</p>
      <p>De ahí salen solos:</p>
      <ul>
        <li><b>Cuánto costó el kilowatt</b>. Sube con las tarifas y también
        con el consumo, porque la CFE cobra por escalones.</li>
        <li><b>Contra el recibo anterior</b>, en pesos y en por ciento. Es la
        comparación que uno hace al abrir el sobre.</li>
        <li><b>Cuánta luz cuesta cada marqueta</b>. Este es <b>el número</b>
        de una fábrica de hielo: se saca de la producción de esos mismos
        días. Cuando empieza a subir sin que suba la tarifa, una máquina se
        está echando a perder — y se sabe mucho antes de que se pare.</li>
      </ul>
      <p class="ayuda-tip">El mismo recibo <b>no se puede capturar dos
      veces</b>: duplicaría el gasto del año y partiría en dos los kWh por
      marqueta. Un dato mal tecleado se arregla con <b>✎ Corregir</b>: se
      abre el formulario con lo capturado, se corrige y listo — por dentro el
      renglón viejo queda anulado con la nota "corregido", para que siempre
      se pueda ver qué decía antes. Y el <b>🗑</b> anula con su motivo, si el
      recibo entero estaba de más.</p>

      <h4>El recibo al detalle: el medidor y las franjas</h4>
      <p>La fábrica está en <b>GDMTH</b> (Gran Demanda en Media Tensión
      Horaria), y en esa tarifa el mismo kilowatt <b>cuesta distinto según
      la hora</b> en que se gastó:</p>
      <ul>
        <li><b>Base</b> — la madrugada y la mañana temprano. La barata.</li>
        <li><b>Intermedia</b> — casi todo el día.</li>
        <li><b>Punta</b> — las horas de la tarde. La cara, y por mucho.</li>
      </ul>
      <p>Al capturar el recibo, abajo hay una sección <b>＋ El medidor y las
      franjas horarias</b>. Todo lo de ahí es <b>opcional</b>: un recibo
      capturado a medias vale más que uno no capturado. Pero llenarlo
      contesta la pregunta que de verdad vale en una fábrica de hielo:
      <b>¿conviene mover producción de horario?</b> Un tanque que congela de
      madrugada usa el mismo amoniaco y cuesta menos luz, y eso solo se ve
      con las franjas separadas.</p>
      <ul>
        <li><b>Los kWh de cada franja.</b> Mientras se escriben, la pantalla
        dice si las tres suman los kilowatts del recibo. Si no suman, casi
        siempre es un dedazo o una franja que se quedó sin capturar — y
        decirlo con el papel todavía en la mano cuesta cero.</li>
        <li><b>Los pesos de cada franja</b>, si el recibo los desglosa. Con
        ellos sale <b>el precio del kilowatt de cada franja</b>, que es donde
        se ve la diferencia de verdad.</li>
        <li><b>La lectura del medidor</b>, la anterior y la de ahora, con su
        <b>multiplicador</b> (los medidores de media tensión no cuentan de
        uno en uno; la constante viene impresa). El sistema multiplica y
        <b>compara con lo que cobraron</b>: si no cuadra, hay algo que
        reclamar.</li>
        <li><b>La demanda facturable</b> en kW y el <b>factor de
        potencia</b>: los otros dos números que mueven el precio de un
        recibo GDMTH.</li>
      </ul>
      <p class="ayuda-tip">En la tabla de recibos, el botón <b>⌄</b> de cada
      renglón abre todo esto debajo, sin salir de la pantalla. No se pusieron
      como columnas nuevas a propósito: la tabla contesta la pregunta de
      todos los días —cuánta luz cuesta cada marqueta— y con ocho columnas
      más dejaría de leerse de un vistazo.</p>

      <h4>El IVA: lo que nos deben</h4>
      <p>El IVA que la fábrica paga en la luz y en las compras grandes
      <b>no es suyo</b>: se recupera. El problema es que se paga cada mes y
      vuelve a destiempo, en cantidades que no coinciden con ningún recibo,
      así que la cuenta se lleva de memoria y se pierde. La pestaña
      <b>🧾 IVA</b> existe para eso.</p>
      <ul>
        <li>El <b>IVA de cada recibo de luz</b> se anota al capturarlo.</li>
        <li>El <b>IVA de cada gasto grande</b>, igual, en su formulario. Se
        escribe <b>tal como lo dice la factura</b>, no calculado: hay
        compras con partidas exentas donde no es el 16 %.</li>
        <li>Cada vez que Hacienda devuelve algo, se anota con
        <b>＋ Anotar una devolución</b>: el día en que entró el dinero,
        cuánto, de qué periodo y su folio. Se le puede pegar el papel.</li>
      </ul>
      <p>Arriba sale la resta: <b>lo pagado − lo devuelto = lo que falta por
      recuperar</b>. Ese número no se guarda en ningún lado — se saca al
      momento de los papeles, así que corregir un recibo lo corrige solo.</p>
      <p class="ayuda-tip">Si hay recibos o gastos <b>sin su IVA anotado</b>,
      la pantalla lo dice y advierte que lo que falta por recuperar es
      <b>cuando menos eso</b>, no exactamente eso. Vale más un número honesto
      con su advertencia que uno redondo que miente.</p>
      <p>Abajo, el <b>año por año</b>. Ahí la diferencia de cada año se lee
      con cuidado: las devoluciones llegan tarde y casi siempre caen en el
      año siguiente al del gasto, así que un año puede verse en rojo y el
      siguiente en verde sin que falte ni sobre nada. <b>El número que vale
      es el acumulado de arriba.</b></p>

      <h4>La luz dentro del mes</h4>
      <p>Arriba, junto a lo gastado, sale la luz que le toca al mes. Como el
      recibo casi nunca empieza el mismo día que el mes del negocio, lo que
      se hace es <b>repartir el recibo entre los días que cubre</b> y quedarse
      con los que caen dentro.</p>
      <p>Por eso ese número es un <b>reparto</b>, no una factura. Si todavía
      hay días del mes que ningún recibo cubre —lo normal, porque el recibo
      llega después— la pantalla dice <b>cuántos faltan</b> y avisa que el
      total <b>va a subir</b>, en vez de presumir una cifra que no está
      completa.</p>

      <h4>El dinero que solo cambia de sitio</h4>
      <p>Un <b>retiro a la caja fuerte</b> sale del cajón, sí, pero la fábrica
      no lo gastó: el dinero cambió de sitio. Si después con ese mismo
      efectivo se paga el amoniaco y el amoniaco se anota aquí, sería el
      <b>mismo peso contado dos veces</b>.</p>
      <p>Por eso en <b>Caja › Gastos que se repiten</b> cada concepto dice si
      es un <b>gasto</b> (el dinero se va) o un <b>traspaso ⇄</b> (solo cambia
      de sitio), y los totales salen partidos en dos. El retiro a la caja
      fuerte viene marcado de fábrica.</p>

      <h4>Los conceptos son suyos</h4>
      <p>Con <b>＋ Nuevo concepto</b> se da de alta lo que haga falta —
      llantas, un motor, lo que sea — con su unidad y su ritmo. Y desde
      <b>Editar</b> un concepto se puede renombrar, dar de baja o
      <b>borrar de la lista</b> (✕): desaparece del catálogo para siempre,
      pero lo que ya se compró con él <b>no se borra</b> — sigue en la lista
      de gastos, y en los meses donde tuvo compras su renglón se queda para
      que la tabla cuadre.</p>

      <h4>Los proveedores: el manual de la fábrica</h4>
      <p>La pestaña <b>📒 Proveedores</b> es el directorio del negocio:
      quién es cada proveedor, <b>qué hace y para qué sirve</b>, su
      teléfono, dónde está, sus horarios y sus mañas ("solo efectivo",
      "preguntar por don Raúl").</p>
      <p class="ayuda-tip">La intención es que sea parte del <b>manual de la
      fábrica</b>: que quien tenga que sacar adelante el negocio un día
      —los hijos, un encargado nuevo— abra esta pantalla y sepa a quién
      hablarle. Escrito aquí, no se lo lleva nadie en la cabeza. Al
      capturar un gasto grande, el nombre del proveedor se sugiere solo.</p>

      <h4>Quién entra</h4>
      <p>El <b>gerente</b> ve todas estas cuentas. Capturarlas —gastos,
      recibos, proveedores y el día del corte— es del <b>administrador</b>:
      son facturas de decenas de miles de pesos, no es trabajo de turno.</p>`
  },

  // ==========================================================
  {
    id: 'historial',
    titulo: 'Historial: revisar lo que se hizo',
    busca: 'historial revisar auditar quién hizo qué cajero fecha hora filtro tickets gastos entradas abonos borrar eliminar dar de baja contraseña ordenar columna cargar más hoy devolución cambio mayoreo atajos últimas 24 horas 7 días 30 días semana mes ordenar por quién',
    cuerpo: `
      <p>Todo lo que ha pasado en la caja, de quien sea y de cuando sea:
      ventas, gastos, entradas de dinero y abonos, mezclados y en orden.</p>

      <h4>Se abre con lo de hoy</h4>
      <p>Dentro de tres años aquí va a haber cientos de miles de renglones,
      así que <b>al entrar solo se enseña el día de hoy</b>. Para ver más
      atrás hay dos caminos:</p>
      <ul>
        <li>El botón <b>Cargar 100 más</b> de abajo, que va anexando hacia
        atrás sin borrar lo que ya estaba.</li>
        <li>Poner <b>fechas</b>, un <b>número de ticket</b> o cualquier otro
        filtro: con eso la ventana de hoy se quita sola.</li>
      </ul>

      <h4>Los atajos de arriba</h4>
      <p>En la fila <b>De cuándo</b> están los cuatro periodos que se piden
      de verdad:</p>
      <ul>
        <li><b>Hoy</b> — el día de calendario, de medianoche para acá.</li>
        <li><b>Últimas 24 horas</b> — que <b>no es lo mismo</b>: a las diez
        de la mañana, "hoy" son diez horas y "las últimas 24" llegan hasta
        ayer a las diez, donde estuvo el turno de la tarde. Cuando algo no
        cuadró, casi siempre es esta.</li>
        <li><b>Últimos 7 días</b> y <b>Últimos 30 días</b> — por días de
        calendario contando hoy, que es como se dicen.</li>
      </ul>
      <p>Al lado está <b>👤 Ordenar por quién</b>, que junta los renglones
      de cada persona <b>sin esconder a nadie</b>. Es distinto de escoger a
      alguien en el selector de <b>Quién</b>, que sí deja fuera a los demás:
      a veces lo que se quiere es comparar los dos turnos.</p>
      <p class="ayuda-tip">Tocar una fecha a mano apaga el atajo, porque a
      partir de ahí la pantalla ya no está enseñando eso.</p>

      <h4>Ordenar</h4>
      <p>Se toca el título de una columna y se ordena por ella; se toca otra
      vez y se da la vuelta. Se puede por número, por qué fue, por fecha,
      por quién o por importe.</p>
      <p class="ayuda-tip">Ordena <b>lo que ya está cargado</b>, no toda la
      base. Es a propósito: si ordenara todo, poner "de lo más viejo a lo
      más nuevo" traería la primera venta de hace diez años en vez de la de
      las siete de la mañana de hoy, que es lo que se estaba buscando.</p>

      <h4>La columna QUÉ</h4>
      <p>Cada renglón dice de un vistazo qué clase de movimiento fue:</p>
      <ul>
        <li><b>Venta</b> — una venta de mostrador.</li>
        <li><b>Mayoreo</b> — salió con precio de una lista de mayoreo.</li>
        <li><b>Fiado</b> — se lo llevó a crédito.</li>
        <li><b>Cambio</b> / <b>Cambiado</b> — el ticket nuevo y el viejo de
        un cambio. Cada uno nombra a su pareja, así que cayendo en
        cualquiera de los dos se ve la historia completa.</li>
        <li><b>Devolución</b> — se le devolvió el dinero al cliente.</li>
        <li><b>Cancelada</b> — el ticket no vale.</li>
        <li><b>Gasto</b>, <b>Entrada</b>, <b>Abono</b> — dinero del cajón
        que no fue una venta.</li>
      </ul>

      <h4>Los botones de cada renglón</h4>
      <ul>
        <li><b>👁</b> — enseña el <b>ticket con forma de ticket</b>: papel
        blanco, la misma letra y los mismos renglones que salen por la
        impresora. No es una imagen, así que abre al instante, y desde ahí
        mismo se saca la copia. Si el renglón no tiene ticket (un abono),
        sale el resumen de texto.</li>
        <li><b>Copia</b> — vuelve a imprimir el ticket con <b>** COPIA **</b>
        hasta arriba. Lo puede cualquiera.</li>
        <li><b>⋯</b> — cancelar o eliminar. Solo el administrador; a los
        demás ni les sale.</li>
      </ul>

      <p class="ayuda-tip">Lo que salga recortado con puntos suspensivos se
      ve completo dejando el ratón encima un momento. Vale en todas las
      listas del programa.</p>

      <h4>Los totales de arriba</h4>
      <p>Son de <b>todo lo que cae en el filtro</b>, no de los renglones que
      se están viendo. Por eso cargar más no los cambia: si cambiaran, no
      se sabría a cuál creerle.</p>`
  },

  // ==========================================================
  {
    id: 'borrar',
    titulo: 'Dar de baja o eliminar',
    busca: 'borrar eliminar dar de baja recuperar producto categoría cliente gasto concepto lista contraseña administrador temporada',
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

      <h4>Los conceptos: borrarlos de la lista</h4>
      <p>Los <b>conceptos</b> —los gastos que se repiten de la caja y los
      gastos grandes de la empresa— tienen un tercer camino: <b>✕ borrarlo de
      la lista</b>. El renglón desaparece del catálogo para siempre, aunque
      ya se haya usado, porque lo que se borra es <b>el botón, no los
      registros</b>: los gastos anotados con él siguen en el historial y
      siguen sumando en las cuentas. Lo puede hacer el gerente o el
      administrador.</p>

      <h4>Pide la contraseña, no el PIN</h4>
      <p>Y solo la del <b>administrador</b>. El PIN se teclea veinte veces al
      día delante de quien sea: sirve para decir "yo estoy aquí". Borrar no se
      deshace, así que va con algo que no ve nadie.</p>

      <h4>Un ticket: cancelar o eliminar</h4>
      <p>Con los tickets la diferencia no es "temporada o no": es <b>el papel
      firmado</b>.</p>
      <ul>
        <li><b>Cancelar</b> deja el ticket tachado con su motivo. El hielo
        vuelve al cuarto frío, la caja se ajusta sola y el corte sigue
        cuadrando. Se puede con tickets de <b>cualquier día</b>, y es lo que
        se hace casi siempre.</li>
        <li><b>Eliminar</b> lo quita como si nunca hubiera existido, y
        <b>solo se puede mientras su turno siga abierto</b>. En cuanto se
        corta el turno hay un papel firmado con ese número: borrarlo dejaría
        al papel diciendo una cosa y al sistema otra, y ese papel es el que
        se usa para reclamarle a alguien.</li>
      </ul>
      <p>Los dos están en el <b>Historial</b>, detrás del botón <b>⋯</b>, y
      solo le salen al administrador. Un ticket que es parte de un
      <b>cambio</b> tampoco se borra suelto: dejaría al otro apuntando a un
      número que ya no existe.</p>

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
    id: 'sonido',
    titulo: 'El sonido de la caja',
    busca: 'sonido ruido pitido audio bocina apagar silencio beep',
    cuerpo: `
      <p>La caja hace un ruidito cuando algo se acepta, otro distinto cuando
      algo falla, y uno especial al cobrar una venta.</p>
      <p>No es un adorno: en el mostrador, con gente hablando, el cajero no
      está mirando la pantalla cuando aprieta enter —está viendo al cliente y
      contando billetes—. El oído le dice si el ticket entró sin tener que
      voltear.</p>

      <h4>Apagarlo o encenderlo</h4>
      <p>En <b>Personalizar</b>, hasta abajo. El botón <b>Oírlo</b> toca el
      de una venta cobrada.</p>

      <p class="ayuda-tip">Se guarda <b>en cada aparato</b>, no en el
      negocio. La computadora de la caja tiene bocinas y el celular del
      reparto no tiene por qué ponerse a pitar en la calle, así que cada uno
      se configura por su lado.</p>

      <h4>El tamaño de los cuadros de Vender</h4>
      <p>En <b>Personalizar</b>, en <em>Los cuadros de Vender</em>, eliges
      <b>cuántas columnas</b> y <b>cuántas filas</b> de productos quieres ver
      de una vez en la caja. No se pone el tamaño en centímetros: se dice
      cuántos cuadros caben y la caja reparte entre ellos el sitio que tenga
      esa pantalla. Así la misma configuración vale para el monitor del
      mostrador y para el de la oficina.</p>
      <ul>
        <li><b>Menos cuadros</b> = cuadros más grandes, que se tocan mejor con
        el dedo y se leen de lejos.</li>
        <li><b>Más cuadros</b> = se entra y se sale menos de las categorías.</li>
        <li>De <b>2 a 10 columnas</b> y de <b>1 a 8 filas</b>. Menos de dos
        columnas no es una rejilla, es una lista; más de diez deja cuadros
        donde no cabe el nombre del producto.</li>
      </ul>
      <p>El dibujito de abajo enseña cómo va a quedar mientras tecleas. Si
      sobran productos, la rejilla se desliza: las filas son cuántas se ven
      sin desplazar, no cuántas caben en total.</p>

      <p class="ayuda-tip">En el celular no se aplica: ahí entran los que
      quepan por el ancho de la pantalla, porque diez columnas en una mano no
      se leen.</p>`
  },

  // ==========================================================
  {
    id: 'tickets',
    titulo: 'Cómo se lee un ticket',
    busca: 'ticket papel comprobante copia cambio gasto firma atendio fecha total pago cambio impreso',
    cuerpo: `
      <p>Todos los papeles del negocio se arman igual, para que se reconozcan
      sin leerlos: <b>arriba a la izquierda qué es</b> este papel, <b>arriba a
      la derecha quién y cuándo</b>, en medio el contenido entre dos rayas, y
      abajo el nombre del negocio.</p>

      <pre class="ayuda-formula">#2026-152125          Atendio: Tony Castilla
                          26/Ago/2026 5:45pm
Cliente: Mario Cauich
------------------------------------------------
2 3/8
(2 + 1/4 + 1/8) ......................... $610.00
2 Coca 600 ............................... $50.00
------------------------------------------------
                                 TOTAL:   $660.00
                                 PAGO:    $700.00
                                 CAMBIO:   $40.00
HIELO LOLHA</pre>

      <h4>Qué es cada cosa</h4>
      <ul>
        <li><b>#2026-152125</b> — el número del ticket. El año y el
        consecutivo, que vuelve a empezar cada 1 de enero.</li>
        <li><b>Atendio</b> — quién tenía el turno de caja. Es de ese cajón de
        donde salió o entró el dinero.</li>
        <li><b>El número grande</b> — cuánto hielo se llevó. Es lo único que
        el cliente comprueba de un vistazo, y por eso va en grande.</li>
        <li><b>El paréntesis de abajo</b> — de qué pedazos salió esa cuenta,
        y cuánto costó el hielo.</li>
        <li><b>Los puntitos</b> — llevan el ojo del concepto a su precio sin
        que se salte de renglón.</li>
      </ul>

      <h4>Los avisos que puede llevar</h4>
      <ul>
        <li><b>** COPIA **</b>, entre asteriscos y hasta arriba de todo — es
        una reimpresión, no el original. Va antes que el número a propósito:
        una marca de copia que hay que buscar no sirve de nada.</li>
        <li><b>CANCELADO</b> — ese ticket ya no vale.</li>
        <li><b>CAMBIO DEL #2026-152124</b>, hasta abajo — este hielo ya se
        había pagado en otro papel; este es el cambio.</li>
        <li><b>FIADO</b>, con la raya para firmar — el cliente se lo llevó a
        crédito y este papel es el vale.</li>
      </ul>

      <h4>El comprobante de un gasto</h4>
      <pre class="ayuda-formula">Gasto                     Atendio: Tony Castilla
                              26/Ago/2026 5:45pm
------------------------------------------------
$6,250
GASOLINA PARA LIMPIAR PIEZAS DE LA MAQUINA NUEVA
EN REPARACION
------------------------------------------------
                  ______________
                       FIRMA</pre>

      <p>Mismo armazón: qué, quién, cuándo. Se firma porque alguien se llevó
      dinero del cajón. <b>Meter</b> dinero también saca su papel, pero sin
      raya para firmar: nadie firma por dejar.</p>

      <p class="ayuda-tip">El papel no dice quién tomó el dinero ni quién lo
      anotó, aunque el sistema lo guarde. Casi siempre es la misma persona y
      llenaba el ticket de nombres. Cuando de verdad haga falta saberlo, está
      en la <b>bitácora</b>, en Sistema.</p>`
  },

  // ==========================================================
  {
    id: 'gente',
    titulo: 'La gente de la fábrica: altas, bajas y PIN',
    busca: 'usuarios gente empleados trabajadores alta baja pin contraseña rol operario cajero repartidor gerente administrador quién entró actividad paños vendió turnos reactivar',
    cuerpo: `
      <p>Cada quien entra con <b>su propio PIN</b>. No es burocracia: es lo
      que hace que cada paño, cada ticket y cada corte lleven el nombre de
      quien lo hizo, y eso es la mitad de para qué sirve este sistema.</p>

      <p class="ayuda-tip"><b>Nadie se borra.</b> Un empleado que se va se
      <b>da de baja</b>: desaparece de las pantallas, pero sus registros se
      quedan enteros — las ventas que hizo siguen siendo suyas y los paños
      que sacó siguen diciendo su nombre. Si vuelve, se reactiva y sigue
      siendo el mismo.</p>

      <h4>Partida por trabajos</h4>
      <p>La pantalla está dividida por rol y no en una lista sola, porque
      los roles de una fábrica no son cinco categorías iguales: son
      <b>cinco trabajos distintos</b>, y quien abre esta pantalla casi
      siempre viene a buscar a alguien de uno de ellos. Cada apartado dice
      cuántos hay y qué hace ese trabajo.</p>

      <h4>Lo que dice cada ficha</h4>
      <p>De los <b>últimos treinta días</b>, y solo lo que le toca a cada
      quien — a un operario no le sirve saber cuánto vendió, porque no
      vende:</p>
      <ul>
        <li><b>Paños</b> que sacó, y cuándo fue el último.</li>
        <li><b>Lo que vendió</b> y en cuántos tickets.</li>
        <li><b>Turnos</b> de caja que abrió.</li>
        <li><b>La última vez que entró al sistema</b>, y desde cuándo está
        en la fábrica.</li>
        <li><b>Cómo entra</b>: con PIN, o también con usuario y contraseña
        desde la PC.</li>
      </ul>
      <p>Son treinta días corridos hacia atrás, no el mes del negocio: la
      pregunta que contestan es "¿está trabajando?", y un día 2 del mes
      todos aparecerían en cero.</p>

      <h4>El PIN y la contraseña</h4>
      <ul>
        <li>El <b>PIN</b> (4 a 6 dígitos) lo lleva todo el mundo. Con él se
        entra desde el celular, la tablet o tocando la cara en la pantalla
        de entrada.</li>
        <li>La <b>contraseña</b> es solo de administradores y gerentes, que
        son los que entran desde la PC. A un operario pedírsela es estorbo
        puro.</li>
        <li>Los dos se cambian desde <b>Editar</b>, sin tener que saber el
        anterior: quien administra la gente puede reponer un PIN olvidado.</li>
      </ul>

      <p class="ayuda-tip">Esta pantalla es <b>solo del administrador</b>.
      Dar de alta a alguien es decidir qué va a poder tocar en la fábrica.</p>`
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
    busca: 'respaldo copia seguridad usb drive restaurar disco perder datos impresora ticket térmica imprimir compartir windows red ip 9100 puerto no imprime papel gasta avance cortar cuchilla ahorro',
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
      destino puesto, el ticket sale <b>al instante</b>; sin él lo imprime el
      navegador y aparece la ventana de impresión.</p>

      <p><b>Se elige de una lista.</b> Al abrir Sistema, el programa le
      pregunta a Windows qué impresoras tiene y las pone en un selector.
      Eliges la de tickets y ya: no hay que averiguar direcciones ni
      compartir nada.</p>
      <p>Funciona con las dos clases:</p>
      <ul>
        <li><b>De red</b> (lo normal en las térmicas de 80 mm) — el sistema
        le habla directo por su dirección, sin driver de por medio.</li>
        <li><b>De USB</b> — va por su nombre de Windows, sin tener que
        compartirla.</li>
      </ul>

      <p>Debajo del selector, un renglón te dice <b>por dónde va a salir el
      ticket</b>. Y el botón <b>Imprimir una prueba</b> lo comprueba sin tener
      que hacer una venta.</p>
      <p class="ayuda-tip">Si tu impresora no sale en la lista, se puede
      escribir a mano: su dirección IP (<code>192.168.1.65</code>), su nombre
      compartido, o la ruta de una carpeta para probar sin papel.</p>

      <h4>El cajón del dinero</h4>
      <p>El cajón se abre solo. No tiene cerebro ni cable propio a la
      computadora: es un resorte con un cable metido en la <b>impresora</b>,
      y ella le manda el pulso que lo dispara. Por eso solo funciona con la
      impresora configurada.</p>
      <p><b>El cajón se abre con el ticket.</b> El pulso viaja pegado a los
      bytes del papel: si sale ticket, se abre; si la impresora está apagada,
      no se abre ni se finge que sí. Y se abre <b>cada vez</b> que se
      imprime, no solo la primera. Tres copias del mismo ticket son un
      cobro, así que ahí se abre una sola vez.</p>
      <p>El comprobante de un gasto también lo abre: de ahí hay que sacar
      los billetes.</p>
      <p>En <b>Sistema</b>, debajo de la impresora, prende
      <b>Abrir el cajón al cobrar en efectivo</b>. Se abre <b>al cobrar</b>,
      no al imprimir: el ticket solo sale si alguien lo pide y el cajón hace
      falta siempre que entre dinero.</p>
      <p class="ayuda-tip">¿No abre? Cambia la <b>salida del conector</b> de
      la 2 a la 5 y dale a <b>Abrirlo ahora</b>. Casi todos los cajones van
      en la 2, pero hay quien usa la otra, y es lo primero que se prueba.</p>
      <p>También se abre solo cuando devuelves dinero, porque de todas formas
      hay que meter la mano.</p>

      <h4>Qué se imprime dónde</h4>
      <p>Cada cosa puede ir a una impresora distinta: los tickets de venta,
      el corte de caja, los comprobantes de gasto, los conteos y los
      <b>números a sacar</b> —que bien pueden salir en el cuarto de tanques
      y no en el mostrador—. Dejarlo en
      <b>La de tickets</b> es lo que casi siempre se quiere.</p>
      <p class="ayuda-tip">Las hojas <b>tamaño carta</b> —como la hoja para
      contar— las sigue imprimiendo el navegador con su ventana de elegir
      impresora. Eso no lo puede quitar el programa: lo decide el navegador.
      Todo lo que tiene forma de ticket sí sale directo.</p>

      <h4>Si hay que restaurar</h4>
      <p>Las instrucciones están en la propia pantalla de Sistema, paso por
      paso. En resumen: se apaga el sistema, se copia el respaldo encima del
      archivo de datos y se vuelve a encender.</p>`
  },

  // ==========================================================
  {
    id: 'numeros',
    titulo: 'Los números: qué significa cada uno',
    busca: 'estadísticas números gráficas costo por marqueta imprimir hoja carta pdf tendencia día por día en qué se fue el dinero raya sueldos reparto amoniaco',
    cuerpo: `
      <p>La pantalla <b>📊 Los números</b> no es un tablero: es una
      <b>hoja</b> que se lee de arriba abajo y se imprime tal cual. Está en
      el orden en que uno se hace las preguntas.</p>

      <h4>Se vendió</h4>
      <p>El precio de todo lo que salió en el mes, <b>esté cobrado o
      fiado</b>. Lo fiado se dice aparte, porque es dinero que se vendió
      pero todavía no está. Los tickets cancelados y las devoluciones
      <b>no cuentan</b> —pero se dice cuántos hubo—, y un <b>cambio</b>
      tampoco cuenta dos veces: por dentro el ticket viejo queda cancelado
      y solo suma el nuevo.</p>

      <h4>Cuánto cuesta una marqueta — y por qué salen dos números</h4>
      <p>Es el número que junta todo: la luz, las compras grandes y los
      gastos del cajón, repartidos entre las marquetas que se produjeron.</p>
      <p>Salen dos porque las cosas que se compran de tanto en tanto
      <b>no se gastan el día que se pagan</b>: un cilindro de amoniaco
      cuesta mucho una vez y enfría durante tres meses. Cargándoselo entero
      al mes que tocó comprarlo, ese mes se vería carísimo y los dos
      siguientes baratísimos, sin que en la fábrica hubiera pasado nada.</p>
      <ul>
        <li><b>El grande</b> reparte cada compra sobre los días que dura
        —los que dice su ficha en las cuentas de la empresa— y es el que
        sirve para <b>comparar un mes contra otro</b>.</li>
        <li><b>El de al lado</b> es el dinero que de verdad salió ese mes,
        y es el que dice <b>si alcanzó</b>.</li>
      </ul>
      <p class="ayuda-tip"><b>Ojo: en ninguno de los dos está la raya.</b>
      Los sueldos no se llevan en el sistema, así que lo que de verdad
      cuesta una marqueta es más. Estos números sirven para comparar y
      vigilar — <b>no para sacar el precio de venta</b>. Y si al mes le
      falta el recibo de la luz, sale marcado como incompleto: en una
      fábrica de hielo la luz es la mitad del costo.</p>

      <h4>Las gráficas</h4>
      <ul>
        <li><b>Día por día</b>: cada barra es un día y su alto es lo que se
        vendió; los domingos van marcados. Un día sin barra es un día sin
        ventas capturadas. Dejando el ratón encima sale el detalle.</li>
        <li><b>En qué se fue el dinero</b>: del más caro al más barato, todo
        junto, y suma exactamente lo que dice arriba <b>«salió de la
        caja»</b>. No incluye los <b>traspasos</b> —un retiro a la caja
        fuerte no es un gasto: el dinero cambió de sitio—. Si un gasto sale
        marcado <b>(con factura)</b> o <b>(del cajón)</b> es porque el mismo
        nombre existe en las dos bolsas, y así se ve de dónde viene cada
        uno.</li>
        <li><b>Los últimos doce meses</b>: la de arriba es lo vendido; la de
        abajo, lo que costó cada marqueta. Esa línea <b>no empieza en
        cero</b> a propósito: lo que hay que leer es la <b>inclinación</b>,
        no la altura, y con el eje desde cero se vería una raya plana.</li>
      </ul>

      <h4>El hielo</h4>
      <p><b>Salieron del molde</b> es todo el hielo que se hizo, cáscaras
      incluidas: es lo que costó agua, luz y amoniaco. <b>Sin una sola
      queja</b> es el porcentaje que salió sellado o normal — de las poco
      huecas para abajo, alguien reclama en el mostrador.</p>
      <p>Debajo va <b>la barra</b>, y es lo primero que hay que
      mirar: una marqueta hueca se cobra igual que una sellada, así que en el
      dinero no se nota. Cuando la barra se corre hacia la derecha varios días
      seguidos, algo está fallando y se ve antes de que una máquina se pare.
      En pantalla va en colores; en papel sale en grises, de claro (bien) a
      oscuro (mal), para que se lea igual en la impresora en blanco y
      negro.</p>
      <p>Lo producido y lo vendido <b>no tienen por qué cuadrar</b>: entre
      los dos está lo que quedó en el cuarto frío, lo que se derritió y las
      cáscaras que se fueron a los condensadores.</p>

      <h4>Imprimirla o guardarla en PDF</h4>
      <p>El botón de arriba la saca en hoja carta como se ve: sin el menú,
      sin los botones y en blanco y negro para no gastar tinta. Ninguna
      gráfica se parte a la mitad entre dos hojas.</p>
      <p class="ayuda-tip">Para guardarla como <b>PDF</b> es el mismo botón:
      en el cuadro de impresión se elige <b>Guardar como PDF</b> en vez de la
      impresora. Sale idéntica.</p>
      <p class="ayuda-tip"><b>Por qué a veces pide abrir el navegador.</b> El
      sistema se abre en una ventana puesta para que los <b>tickets salgan
      solos</b>, sin preguntar qué impresora ni nada — eso es lo que se
      quiere en el mostrador. Pero esa misma ventana no puede enseñar el
      cuadro donde se elige impresora o se guarda un PDF, así que para sacar
      la hoja abre el sistema en tu navegador de siempre, ya en esta misma
      pantalla. Ahí le das al mismo botón y te deja elegir.</p>

      <h4>Quién los ve</h4>
      <p>El <b>administrador</b> y el <b>gerente</b>. El gerente es quien
      puede hacer algo con ellos en su turno.</p>

      <h4>De dónde salen</h4>
      <p>De los renglones capturados, cada vez que se abre la pantalla.
      <b>No hay ningún total guardado</b> que se pueda desincronizar: si
      mañana se anula una venta de la semana pasada, todos los números de
      esta hoja se corrigen solos.</p>`
  },

  // ==========================================================
  {
    id: 'arranque',
    titulo: 'La puesta en marcha y el cuadre',
    busca: 'puesta en marcha arranque empezar producción real borrar pruebas cuadrar realidad rotación paños congelando fondo inicial primer conteo apagón',
    cuerpo: `
      <p>La fábrica ya trabajaba cuando llegó el sistema. La <b>puesta en
      marcha</b> (🚀 en Sistema, solo el administrador) es el día en que se
      le dice cómo está el mundo real, en orden y una sola vez:</p>
      <ul>
        <li><b>Borrar las pruebas</b> — todo lo capturado en el ensayo se
        borra para que los números empiecen limpios. Se quedan usuarios,
        tanques, productos, precios, clientes y toda la bitácora. Antes se
        hace un respaldo solo, y pide escribir BORRAR PRUEBAS más la
        contraseña. El primer ticket real vuelve a ser el <b>#1</b>.</li>
        <li><b>Los paños</b> — cuáles llevan horas congelando (y desde
        cuándo) y cuáles están fuera. "Sin tocar" no escribe nada.</li>
        <li><b>La rotación</b> — cuál fue el último paño que se sacó; el
        sistema contesta "entonces toca el N".</li>
        <li><b>El hielo</b> — el primer conteo del cuarto frío fija cuánto
        hay, sin cuadrar contra nada.</li>
        <li><b>Los productos</b> — su primer conteo cada uno.</li>
        <li><b>El dinero</b> — el cajero entra con su PIN y registra una
        entrada "Fondo inicial" con lo que haya en el cajón.</li>
      </ul>

      <p class="ayuda-tip">Los paños fijados aquí <b>no inventan
      marquetas</b>: la producción y las estadísticas solo cuentan lo que de
      verdad se registró. Por eso las marquetas producidas antes de la hora
      cero no aparecen: las absorbe el primer conteo, que es la verdad.</p>

      <h4>Después: cuadrar con la realidad</h4>
      <p>Al dar por hecha la puesta en marcha, el botón de borrar pruebas
      <b>desaparece para siempre</b> y la pantalla se convierte en el
      <b>cuadre</b>: la misma captura de paños, para el apagón o la semana
      que nadie anotó. Cada cuadre exige su <b>motivo</b>, queda firmado en
      la bitácora con el antes y el después, y la pantalla dice cuántas
      veces se ha usado.</p>
      <p class="ayuda-tip">El hielo, los productos y el dinero no tienen
      botón de cuadre, a propósito: <b>los conteos y movimientos de siempre
      son el cuadre</b>, y son los que destapan un faltante en vez de
      taparlo.</p>`
  },

  // ==========================================================
  {
    id: 'actualizar',
    titulo: 'Actualizar el sistema',
    busca: 'actualizar versión nueva instalar archivos novedades zip subir reiniciar',
    cuerpo: `
      <p>Cuando haya una versión nueva te va a llegar un archivo
      <b>.zip</b>. No hay que descomprimirlo ni copiar nada a mano.</p>

      <ol class="instrucciones">
        <li>Entra a <b>Sistema</b> → <b>Actualizar el sistema</b>.</li>
        <li><b>Escoger el archivo ZIP</b> y busca el que te mandé.</li>
        <li>El sistema te enseña <b>qué versión trae</b> y cuántos archivos
        va a reemplazar. Léelo antes de seguir.</li>
        <li><b>Actualizar</b>, y cuando termine, <b>Reiniciar</b>.</li>
      </ol>

      <p class="ayuda-tip">Hazlo cuando <b>nadie esté cobrando</b>. El sistema
      se apaga unos segundos para volver con el programa nuevo.</p>

      <h4>Tus datos no se tocan</h4>
      <p>Ventas, clientes, cortes, precios y el logo viven en la carpeta
      <code>datos</code>, y la actualización <b>nunca la abre</b>. Aun así,
      antes de cambiar nada:</p>
      <ul>
        <li>se hace un <b>respaldo de la base</b>;</li>
        <li>y la <b>versión anterior</b> se guarda completa, por si hubiera
        que volver a ella.</li>
      </ul>

      <h4>Si el archivo no sirve, te lo dice</h4>
      <p>Antes de tocar nada, el sistema revisa que el ZIP sea de verdad de
      este programa y que traiga código. Si algo no cuadra, no instala nada y
      explica qué pasó.</p>

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
      por el navegador. Para eso hay que decirle una vez a dónde mandarlo, en
      <b>Sistema → Impresora de tickets</b>.</p>
      <ol class="instrucciones">
        <li>En el selector <b>¿Cuál es la impresora de tickets?</b>, elige la
        térmica.</li>
        <li>Mira el renglón verde de abajo: tiene que decir
        <em>"El ticket se manda por red a 192.168.1.65:9100"</em> o
        <em>"a la impresora tal de Windows"</em>.</li>
        <li><b>Guardar</b>, y luego <b>Imprimir una prueba</b>. Si algo falla,
        el aviso dice qué revisar, no un error en inglés.</li>
      </ol>
      <p>Lo que suele pasar:</p>
      <ul>
        <li><em>"no contesta"</em> — está apagada, desconectada del cable de
        red, o en otra red distinta a la de la PC.</li>
        <li><em>"no acepta nada en el puerto"</em> — la dirección es correcta
        pero el puerto no. Prueba <code>9100</code>.</li>
        <li><em>"no se llega a esa dirección"</em> — la PC y la impresora no
        se ven entre ellas. Casi siempre es que una está por WiFi y la otra
        por cable en otra red.</li>
        <li><em>"no se encuentra el nombre de red especificado"</em> — está
        apuntando a un nombre compartido que ya no existe. Elige la impresora
        del selector y se arregla.</li>
      </ul>
      <p>Mientras no esté puesto el destino, imprime el navegador y aparece la
      ventana de siempre. Todo funciona igual, solo que más lento.</p>
      <h4>El papel que gasta cada ticket</h4>
      <p>Los tickets están hechos para gastar lo menos posible: se imprimen
      cientos al día y cada renglón de más son metros de papel al mes. Una
      venta son unos <b>48 mm</b>, un ticket de mostrador <b>39 mm</b> y el
      corte del turno <b>84 mm</b>.</p>
      <p>Hay un truco detrás: en una impresora térmica <b>el alto es lo que
      cuesta y el ancho es gratis</b>. Una letra al doble de alto se come dos
      renglones de papel; al doble de ancho, uno solo. Por eso los números
      grandes del ticket son anchos y no altos: se ven igual de grandes y
      valen la mitad.</p>

      <h4>El avance antes de cortar</h4>
      <p>La cuchilla no está donde la impresora imprime: está uno o dos
      centímetros más arriba. Por eso el ticket manda unos renglones en
      blanco antes de cortar, para que la cuchilla no parta el último
      renglón de texto.</p>
      <p>Pero la orden de cortar <b>ya le dice a la impresora «avanza hasta
      donde cortas y corta»</b>, así que muchas no necesitan ni un renglón —y
      ahí son <b>12 mm menos por ticket</b>—. Hay otras, más baratas, que
      cortan donde están.</p>
      <p>En <b>Sistema</b>, junto a lo del papel, está
      <b>Avance antes de cortar</b>. Viene en 4 renglones, que es lo seguro.
      <b>Bájalo, imprime una prueba y mira el papel:</b> si la cuchilla se
      comió el último renglón, súbelo uno. Si no, déjalo bajo y te ahorras
      papel en cada ticket del año.</p>

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
