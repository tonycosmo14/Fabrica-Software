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

      <h4>Quién lo sacó</h4>
      <p>Si quien está en la computadora es un <b>operario</b>, no se le
      pregunta: <b>fue él</b>, y su nombre sale escrito. Es la misma regla
      que en la caja, donde el cajero no escoge quién cobró — ponerle una
      lista con los nombres de sus compañeros sería darle la opción de
      anotarle el trabajo a otro.</p>
      <p>El <b>gerente</b> y el <b>administrador</b> sí eligen, porque ellos
      capturan lo que les cantan: quien lo hizo y quien lo anotó son dos
      cosas, y las dos quedan guardadas.</p>

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
      más lejana— <b>en grados centígrados (°C)</b>, y el sistema saca el
      promedio. Van con su signo: la salmuera trabaja bajo cero, así que casi
      siempre llevan un menos delante. No hace falta ningún
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
      sin buscar el botón. Con el operario enfrente esperando, eso ahorra el
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

      <p class="ayuda-tip">Los operarios no capturan nada. Ellos sacan hielo y
      reportan; quien captura es quien recibe la existencia.</p>

      <h4>El orden de los tanques</h4>
      <p>En <b>Tanques, paños y moldes</b> cada tanque tiene sus flechas
      <b>↑ ↓</b>: con ellas se cambia el orden en que salen en pantalla, sin
      dar de baja nada. El orden importa porque es el que sigue el ojo de
      quien va a sacar hielo, y conviene que sea el mismo en que están
      puestos en el cuarto de máquinas.</p>

      <h4>Cuando el paño no es el que sigue</h4>
      <p>Al tocar un paño que no toca, el sistema lo dice y ofrece las tres
      salidas: <b>ver su historia</b> —que no cambia nada y no pide permiso
      a nadie—, <b>ir al paño que sí toca</b>, o <b>desbloquearlo</b>, que
      necesita el PIN de un gerente o del administrador.</p>
      <p>Y mientras se mira la historia de un paño que no es el que sigue,
      arriba queda el aviso. Mirar está bien; lo que no puede pasar es
      creer que se está en el paño que toca.</p>

      <h4>Quién anuló una sacada, y por qué</h4>
      <p>Al anular la última sacada de un paño queda escrito <b>quién lo
      hizo, cuándo y con qué motivo</b>, y sale en la <b>historia del
      paño</b> — el botón <b>👁 Historia</b>. Antes solo decía «anulada» y
      quién lo había hecho no se guardaba en ningún lado.</p>
      <p class="ayuda-tip">La <b>nota</b> del paño ya no se pierde al
      anular: si alguien había escrito "la grúa se atoró", eso sigue siendo
      verdad después.</p>

      <h4>El papel del día</h4>
      <p>El botón <b>🧾 El día</b> saca cuánto hielo queda en cada cuarto
      frío y qué paños salieron hoy, con quién los sacó. Se pide cuando se
      quiera: es una foto de cómo va el día, no del cierre de nadie. Antes
      salía pegado al corte de caja y ahí estorbaba.</p>`
  },

  // ==========================================================
  {
    id: 'existencia',
    titulo: 'El cuarto frío: cuánto hielo hay',
    busca: 'existencia conteo cuarto frío contar marquetas fracción 5/8 cuadre faltante vendido salidas almacén horarios hielo cortado gourmet bolsas turnos nocturno merma derretida rota regalada encomendado encomienda apartado guardado cliente papelito sobra',
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

      <h4>El hielo que ya es de un cliente (encomendado)</h4>
      <p>Hielo que se vendió y se pagó, pero que el cliente pidió que se le
      guardara. <b>Sigue en el cuarto frío</b> y se cuenta con todo lo demás,
      así que el cuadre lo <b>suma</b> mientras esté guardado y lo
      <b>resta</b> el día que se lo llevan. Sin eso saldría «SOBRA» en cada
      conteo hasta que el cliente pasara por él.</p>
      <p>Aquí se ve la lista de quién tiene qué. Se guarda y se entrega
      desde <b>Vender</b>, con el botón <b>📦</b>. Y en
      <b>Cuartos fríos y horarios</b> se cambia cómo se le llama, que es la
      palabra que sale impresa en el papelito del cliente.</p>

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
    busca: 'venta cobrar ticket precio fracción cambio devolución billete folio cancelar imprimir teclado enter f10 f2 f3 f4 código rápido categorías nueva venta espera pendiente aviso bolita se acabó agotado poco hielo inventario bajo atajos gastos historial reloj cotización cotizar precio papel sujetos a cambio temperatura clima grados afuera termómetro encomendado encomendar apartado guardado papelito guardar hielo cliente pasa por él vale',
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
      <p><b>Dárselo a crédito</b> es otra cosa y tiene su propio botón en esa misma
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
      te salga corto. Y si iba <b>a crédito</b>, no sale dinero de ningún lado:
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

      <h4>Dejarlo a crédito</h4>
      <p>En la pantalla de cobro, <b>🧾 Dejarlo a crédito</b>. Solo a los que
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
      capturado</b>, no lo que hay en el cuarto frío. Los operarios sacan hielo
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

      <h4>El hielo que se queda guardado (encomendado)</h4>
      <p>A veces el cliente paga su hielo y pide que se le guarde para
      pasar por él más tarde o al otro día. Con el botón <b>📦</b> de arriba
      a la derecha: se elige de quién es —o se escribe el nombre, si no está
      dado de alta— y cuánto, y <b>sale su papelito</b> con la fecha, la
      hora y su nombre en grande. Con ese papel vuelve.</p>
      <p>El mismo botón sirve para entregarlo: se toca el renglón del
      cliente y se confirma. <b>No cobra nada</b> ninguna de las dos veces —
      ese hielo se pagó el día que se vendió.</p>
      <p>El numerito naranja encima del botón dice cuántos papelitos hay
      esperando. Sin él, un encomendado se anota y se olvida hasta que
      alguien reclama.</p>

      <p class="ayuda-tip">Y lo importante que no se ve: <b>ese hielo sigue
      en el cuarto frío</b>. Como la venta ya lo restó, sin esto aparecería
      como <b>«SOBRA»</b> en cada conteo hasta que el cliente pasara por él —
      y «sobra» es justo la palabra que avisa de un paño sin capturar. Ahora
      el cuadre lo suma mientras esté guardado y lo resta el día que se lo
      llevan. Se ve en <b>El cuarto frío</b>, con la lista de quién tiene
      qué.</p>
      <p>Cómo se le llama —encomendado, apartado, guardado— se cambia en
      <b>El cuarto frío › Cuartos fríos y horarios</b>, y esa es la palabra
      que sale impresa en el papelito.</p>

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
    busca: 'caja turno fondo corte arqueo gasto retiro efectivo cerrar cuadrar sobra falta corregir corte firmado olvidó gasto agregar quitar administrador motivo copia comprobante reimprimir volver a imprimir papel existencia contar hielo paños bolsas gourmet 5 kg 20 kg entregar entregado sin contar dos papeles detalle vale vales retiro caja fuerte adelanto sueldo raya semana papá firma duplicado',
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

      <h4>Gastos</h4>
      <p>Con el botón rojo <b>− Gasto</b> de la pantalla de venta. Todo el
      dinero que sale del cajón sin ser cambio: la gasolina, los refrescos,
      el desayuno de los muchachos. Verde entra, rojo sale.</p>

      <h4>Los vales: son dos cosas distintas</h4>
      <p>En la fábrica se le dice <b>vale</b> a dos papelitos que se llaman
      igual y son <b>opuestos</b>. El botón <b>📤 Vale</b> de la caja
      pregunta primero cuál de los dos, con la diferencia escrita en el
      mismo botón — nadie tiene por qué acordarse de memoria.</p>

      <table class="ayuda-tabla">
        <tr><th></th><th>Vale de retiro</th><th>Vale de sueldo</th></tr>
        <tr><td><b>Quién lo toma</b></td>
            <td>Tú, un gerente, tu papá</td><td>Un trabajador</td></tr>
        <tr><td><b>Qué es ese dinero</b></td>
            <td>Tuyo ya: solo cambia de sitio</td>
            <td>Un adelanto de su sueldo</td></tr>
        <tr><td><b>¿Es gasto?</b></td>
            <td>No. No se gastó nada</td>
            <td>Sí: el sueldo es gasto</td></tr>
        <tr><td><b>Cómo se salda</b></td>
            <td>Nunca: no hay nada que saldar</td>
            <td>Con su sueldo de la semana</td></tr>
      </table>

      <p>Los dos se hacen en <b>tres toques</b>: cuál, quién y cuánto, y de
      los dos sale su papel con la raya para firmar.</p>
      <p class="ayuda-tip">Sale <b>uno solo</b>. Si prefieres dos —uno para
      quien se llevó el dinero y otro para el cajón— se enciende en
      <b>Sistema › Impresora</b>, en «Papeles que salen de más».</p>

      <p class="ayuda-tip">El mismo botón <b>📤 Vale</b> está en
      <b>Vender</b>, debajo de Meter dinero y Gasto: quien llega a llevarse
      el efectivo llega al mostrador, no a la pantalla de Caja. Es el mismo
      vale desde los dos sitios.</p>

      <p class="ayuda-tip"><b>Lo anota quien está en la computadora, no
      quien se lleva el dinero.</b> Es el caso de verdad: llega tu papá, se
      lleva el efectivo y no toca la máquina. La cajera lo anota a nombre de
      él, y el papel sale con los dos nombres. Lo que <b>no</b> puede hacer
      nadie es retirarse dinero a sí mismo: un retiro se lo lleva el dueño o
      un gerente, y el sistema no deja otra cosa. Si quien pidió el dinero
      es un trabajador, eso es un vale de sueldo y ahí sí puede ser
      cualquiera.</p>

      <h4>El vale de sueldo se cuenta UNA sola vez</h4>
      <p>El sueldo es gasto de la fábrica, así que el vale de sueldo
      <b>sí es gasto</b>, y se cuenta el día que el dinero sale del cajón.
      Lo que no puede pasar es contarlo dos veces:</p>

      <pre class="ayuda-formula">martes   vale de sueldo    $400   ← gasto (sueldo)
sabado   lo que le falta $1,100   ← gasto (sueldo)
                         ------
                         $1,500   ← su sueldo, contado UNA vez</pre>

      <p>Por eso el día de pago se le da <b>de menos</b>, y por eso
      cada quien tiene su libreta de vales en su ficha de <b>La gente de la
      fábrica</b>. Ahí sale «debe $400 de vales» junto a su nombre, y cuando
      ya se le pagó de menos, el botón <b>«ya se le descontó»</b> apaga el
      recordatorio. Ese botón <b>no mueve un peso</b>: el dinero salió el
      día del vale.</p>

      <h4>Lo que salió a crédito no está en el cajón</h4>
      <p>Si en el turno salió mercancía <b>a crédito</b>, el corte lo dice aparte:
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
        dictan, con el teclado de siempre: los pedazos <b>se suman</b>, así
        que 1/8 y luego 1/16 dan 3/16. O se escribe tal cual: "25 y 3/16".</li>
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

      <h4>El corte se lee en dos columnas</h4>
      <p>A la izquierda <b>el dinero</b>, a la derecha <b>el hielo</b>. Son
      las dos cuentas del mismo turno y casi siempre se miran juntas —
      «cuadró el dinero pero faltó hielo» es una sola pregunta, no dos—.
      Una debajo de otra había que rodar la pantalla para compararlas.
      Debajo caen los dos papeles, lado a lado. En un teléfono se apila
      todo solo.</p>

      <p class="ayuda-tip">Cuando <b>sobra</b> dinero, el número sale en
      <b>ámbar</b>, ni rojo ni verde: rojo diría «falta», que es mentira, y
      verde diría «todo en orden», que tampoco. Que sobre no está bien —casi
      siempre es un cambio que no se dio o una venta cobrada sin
      registrar— pero no es lo mismo que faltar.</p>

      <h4>El corte separa los gastos de los vales</h4>
      <p>Salían sumados en un solo renglón, y así un turno con mucha salida
      no dice nada: no se sabe si la fábrica <b>gastó</b> mucho o si nada
      más <b>movieron</b> el dinero. Ahora son dos renglones —Gastos y
      Vales— en la pantalla y en el papel, y el desglose trae los vales en
      su propia columna <b>con el nombre</b> de quien se llevó cada uno.</p>

      <p>Y el corte suma lo que de verdad te llegó de ese turno:</p>
      <pre class="ayuda-formula">se llevaron en vales   $2,000
+ te entregaron        $3,500
                      -------
= de este turno        $5,500</pre>
      <p>Un retiro a media mañana es dinero del mismo turno que ya está
      guardado: al final entregan menos porque ya se llevaron una parte, no
      porque falte. Los <b>adelantos de sueldo no cuentan ahí</b>: ese
      dinero se gastó, no volvió.</p>

      <h4>El corte sale en tres papeles</h4>
      <ul>
        <li>El <b>primero</b> es el del dinero, con espacio para la firma y
        una raya para escribir a mano lo que se entrega. Los gastos y los
        vales van solo como <b>total</b>, con cuántos son.</li>
        <li>El <b>segundo</b> es el <b>detalle</b>: los gastos uno por uno,
        los <b>vales aparte y con nombre</b>, y las entradas. Un retiro se
        resta igual que un gasto —el dinero salió del cajón— pero no es un
        gasto de la fábrica, y por eso va en su propia columna.</li>
        <li>El <b>tercero</b> es <b>el hielo</b>: qué había en el cuarto
        frío, qué debía haber, qué se contó y qué faltó, más cuánto se
        vendió al público y cuánto a mayoreo.</li>
      </ul>
      <p class="ayuda-tip">Eran cuatro. Los <b>paños del día</b> y el hielo
      que queda salían pegados al corte, y son de otro momento: ahora tienen
      su propio botón <b>🧾 El día</b> en Producción de hielo, y se sacan
      cuando se quiera. Si prefieres que vuelvan a salir con el corte, se
      enciende en <b>Sistema › Impresora</b>.</p>
      <p class="ayuda-tip">Son papeles distintos porque son de personas
      distintas: el primero se entrega con el cajón, el segundo se queda en
      la carpeta. Si el turno no tuvo ningún gasto ni entrada, el segundo no
      se imprime: media hoja en blanco que dice GASTOS es papel tirado todos
      los días.</p>

      <h4>El cuadre del hielo</h4>
      <p>El corte enseñaba el dinero con todo detalle y del hielo no decía
      nada — cuando el hielo es el producto. Ahora, en el corte y en su
      papel, va la cuenta entera <b>desde el conteo anterior hasta este</b>:</p>

      <pre class="ayuda-formula">había + se produjo = TENÍA QUE HABER
menos lo vendido, lo derretido y lo cortado = debería quedar
debería quedar − lo que se contó = FALTA o SOBRA</pre>

      <p><b>Falta</b> es el hielo que salió del cuarto frío <b>sin ticket,
      sin anotarse como derretido y sin cortarse</b>. Ese es el número que
      hay que vigilar. Si <b>sobra</b>, casi siempre falta capturar un paño
      o el conteo anterior se quedó corto.</p>

      <p>Y debajo, con forma de ticket, lo poco que hace falta saber:
      <b>qué paños salieron y quién los sacó</b>, y <b>cuánto se vendió al
      público y cuánto a mayoreo</b>. Nada más.</p>
      <p class="ayuda-tip">Los pedazos uno por uno —15 × 1/8, 3 × 1/4…—,
      las mermas por motivo y lo que se cortó para bolsas ya no salen en
      este papel: <b>siguen contando</b>, están restados arriba en el
      cuadre, pero desglosarlos hacía un papel largo que nadie leía de pie.
      Ese detalle está en las estadísticas, que es donde se va a buscar.</p>

      <p>Y debajo, de dónde salió cada número:</p>
      <ul>
        <li><b>Los paños</b> que se sacaron, de qué tanque, <b>quién los
        sacó</b>, cuánto entró al cuarto frío y cuántas se rompieron.</li>
        <li><b>Qué pedazos se vendieron</b>: 3 octavos, 1 cuarto, 2
        marquetas… agrupados por el <b>tamaño del pedazo</b> y no por el
        nombre, porque el mismo octavo se llama "1/8" si se tocó el botón y
        "Hielo" si se tecleó a mano.</li>
        <li><b>Cuánto salió a mayoreo</b> y cuánto al público, con sus
        tickets.</li>
        <li><b>Lo que se derritió o se rompió</b>, por motivo.</li>
        <li><b>Lo que se cortó para bolsas</b>, y cuántas bolsas salieron.</li>
      </ul>
      <p class="ayuda-tip">Un turno que <b>no contó hielo</b> no tiene cuadre
      y no imprime este papel: sin conteo no se puede decir si faltó o sobró,
      y un cuadre con todo en cero haría creer que se contó y salió cero.
      Todo esto se vuelve a ver cuando quieras desde <b>Cortes</b>.</p>

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
      operarios reportan lo que sacaron hasta como las 3 de la tarde: a media
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
    titulo: 'Clientes y crédito: a quién se le da y cuánto debe',
    busca: 'clientes crédito a credito fiar fiado deuda debe abono abonar abona parte paga una parte deja algo pago parcial cobranza límite de crédito credito disponible plazo vencido saldo cuenta a favor cartera calle logo foto imagen retrato telefono marcar llamar',
    cuerpo: `
      <p>La regla de la fábrica es que <b>solo se le da crédito a los clientes que
      damos de alta</b>. Al público en general no. Por eso en la caja el
      botón de crédito abre una lista: no hay forma de escribir un nombre a
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

      <h4>Las tres pestañas: qué le compra cada quien</h4>
      <p>Arriba de la lista hay cuatro pestañas: <b>Todos</b>,
      <b>🧊 Marquetas</b>, <b>🧊 Bolsas</b> y <b>💧 Agua</b>. Cada una enseña
      solo los suyos, con su cuenta al lado.</p>
      <p>Lo que decide en qué pestaña sale es <b>lo que le has vendido</b>, y
      se marca solo: cada venta y cada pedido lo apuntan. El que se lleva un
      garrafón es cliente del agua desde ese momento. Puede estar en las tres
      —Abarrotes Juan compra bolsas <i>y</i> agua— y entonces sale en las
      tres, que es justo lo que hace falta cuando se prepara cada reparto. En
      su ficha se enseña, nada más, para que se entienda por qué está donde
      está.</p>
      <p class="ayuda-tip"><b>Es un filtro, no tres listas.</b> El cliente
      sigue siendo <b>uno solo</b>: una deuda, un límite de crédito, un
      historial. Si fueran tres fichas, el día que llegue con $500 en la mano
      nadie sabría a cuál de sus tres cuentas van — y para cuando se
      descubriera, serían meses de historias separadas.</p>
      <p>Un cliente nuevo, sin un solo ticket, cae en Marquetas —es a lo que
      se dedica la fábrica— y se mueve solo con su primera compra.</p>

      <h4>El horario de entrega y la ubicación</h4>
      <p>En su ficha, junto a la dirección:</p>
      <ul>
        <li><b>Horario de entrega</b> — como lo dirías: «de 8 a 2 y de 5 a 8»,
        «no antes de las 10». No es un adorno: una ruta corta que llega a las
        dos a una tienda que cierra a la una <b>no es corta</b>, es un viaje
        perdido y hay que volver.</li>
        <li><b>Referencias</b> — «la de la puerta azul, junto a la
        tortillería». La dirección lleva al rumbo; esto es lo que hace que se
        encuentre la puerta.</li>
        <li><b>Ubicación</b> — de dos formas: <b>tocando el mapa</b> donde
        está la puerta, o <b>pegando el enlace</b> que da Google Maps al
        compartir desde el celular. Sirve el corto (maps.app.goo.gl) y el
        largo: el corto no trae las coordenadas adentro, y el sistema lo
        sigue solo hasta el largo. Con la ubicación puesta, la nota de
        entrega de sus pedidos sale con su QR.</li>
      </ul>

      <h4>Paga una parte y debe la otra</h4>
      <p>Es lo más común de todo: se lleva $480 pero solo trae $300. En la
      pantalla de crédito hay un campo <b>«¿Deja algo ahorita?»</b>. Se
      escribe lo que entrega y la cuenta de abajo se rehace sola:</p>
      <pre class="ayuda-formula">Debía  +  este ticket  −  lo que deja  =  va a deber</pre>
      <p>Se guarda como <b>dos cosas</b>, que es lo que de verdad pasó: el
      ticket entero a su cuenta, y su abono. Así en su estado de cuenta se
      ve que se llevó $480 y entregó $300 — no una venta de $180 que nadie
      sabría explicar después.</p>
      <ul>
        <li><b>El dinero entra al cajón</b> por el mismo camino que la
        cobranza, así que el corte cuadra sin tocar nada.</li>
        <li><b>El ticket lo dice</b>: «PAGÓ AHORA $300 · QUEDA A DEBER
        $180», arriba de la línea para firmar. El cliente se lleva su copia
        y los dos saben lo mismo.</li>
        <li><b>El límite se mide contra lo que se le queda</b>, no contra el
        ticket. Si está pegado a su límite pero paga casi todo, no hay por
        qué parar la venta y llamar al gerente.</li>
      </ul>
      <p class="ayuda-tip">No se puede dejar <b>más</b> de lo que se lleva.
      Para abonar a lo que debía de antes está su ficha en Clientes, donde
      además se ve contra qué se está aplicando. Y si lo paga todo, no es
      crédito: cóbraselo normal.</p>

      <h4>Recibir un abono sin salirse de la caja</h4>
      <p>Cuando el cliente pasa a pagar lo que debe, ya no hay que ir a
      Clientes:</p>
      <ol class="instrucciones">
        <li><em>F6</em> y se elige al cliente, <b>sin nada en el ticket</b>.
        Ahí mismo se ve <b>cuánto debe</b>, junto a su nombre.</li>
        <li>El botón grande deja de decir «Cobrar» y dice <b>«Abonar a su
        cuenta»</b>. <em>F10</em> o tocarlo.</li>
        <li>Sale cuánto debe, se escribe lo que está dejando —o
        <b>Todo</b>— y la cuenta de abajo se rehace sola.</li>
        <li><b>Recibir</b>, y <b>sale su recibo impreso</b>.</li>
      </ol>
      <p class="ayuda-tip">Si no debe nada, lo dice y no deja abonarle: un
      abono a quien está al corriente le deja un saldo a favor que nadie
      pidió, y encontrarlo después cuesta más que el minuto que se ahorró.</p>
      <p>Si fue por transferencia, hay su botón: <b>ese dinero no entra al
      cajón</b> —no pasó por ahí— pero la deuda baja igual.</p>

      <h4>El recibo del abono</h4>
      <p>Sale solo al recibir, y a propósito: el cliente acaba de entregar
      dinero y tiene que irse con algo en la mano. Lleva los tres números
      que se discuten cuando una cuenta no cuadra:</p>
      <pre class="ayuda-formula">debía  −  abonó  =  le queda</pre>
      <p class="ayuda-tip">Y dice lo que decía <b>el día que se imprimió</b>,
      no lo que debe hoy. Si vuelve a imprimirse la semana que viene, después
      de otros dos abonos, sigue diciendo lo mismo — si no, el papel que
      tiene el cliente en la mano y el sistema se contradirían.</p>
      <p>Si pagó de más, el recibo lo dice: <b>A SU FAVOR</b>. Ese es dinero
      suyo que se quedó en la fábrica y tiene que estar escrito.</p>

      <h4>Dar crédito en la caja</h4>
      <ol class="instrucciones">
        <li>Se marca lo que se lleva, como cualquier venta.</li>
        <li><em>F10</em> para cobrar, y ahí <b>🧾 Dejarlo a crédito</b>.</li>
        <li>Se busca por nombre o negocio y se toca <b>A crédito</b>.</li>
        <li>La pantalla enseña <b>lo que va a deber después de este ticket</b>:
        debía + este ticket = va a deber. <em>Enter</em> lo registra.</li>
      </ol>
      <p>El ticket sale marcado <b>A CRÉDITO</b>, con su nombre y la línea para
      firmar. Ese papel es el vale: el cliente se lleva su copia y los dos
      saben lo mismo.</p>

      <h4>El límite avisa, no impide</h4>
      <p>Si el cliente tiene límite y este ticket lo pasa, <b>no se rechaza la
      venta</b>: se pide el <b>PIN de un gerente</b> y el porqué. Queda escrito
      quién lo autorizó y por qué, en el ticket y en la bitácora.</p>
      <p class="ayuda-tip">Al cliente que lleva veinte años comprando no se le
      para la venta por un número que alguien escribió hace meses. Pero
      tampoco se le da de más sin que nadie se entere.</p>
      <p>El límite <b>vacío quiere decir sin límite</b>. Un límite de cero sí
      es un límite: a ese no se le da nada a crédito.</p>

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
      <pre class="ayuda-formula">se ha llevado a crédito − ha pagado = DEBE</pre>
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
      <p>Lo que salió a crédito <b>no se cuenta en el cajón</b>: ese dinero está en
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
        <li><b>A crédito</b> — se lo llevó apuntado a su cuenta.</li>
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
      a crédito, y con una categoría que todavía tiene productos dentro.</p>

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
    busca: 'ticket papel comprobante copia cambio gasto vale firma fecha total pago cambio impreso ' +
           'tamaño letra fuente chica grande columnas puntitos subrayado renglon diseño',
    cuerpo: `
      <p>Todos los papeles del negocio se arman igual, para que se reconozcan
      sin leerlos: <b>arriba a la izquierda qué es</b> este papel y <b>a la
      derecha quién lo hizo</b>, la fecha debajo, en medio el contenido entre
      rayas, y abajo el nombre del negocio.</p>

      <pre class="ayuda-formula">#2026-152125                       Tony Castilla
Cliente: Mario Cauich         26/Ago/2026 5:45pm
- - - - - - - - - - - - - - - - - - - - - - - -
2 3/8 ..................................... $627
  (2 + 1/4 + 1/8)
- - - - - - - - - - - - - - - - - - - - - - - -
1    Agua 600ml ........................... $25
10   Garrafon 20L ......................... $60
- - - - - - - - - - - - - - - - - - - - - - - -
TOTAL: $912       PAGO: $1,000       CAMBIO: $88
HIELO LOLHA</pre>

      <h4>Qué es cada cosa</h4>
      <ul>
        <li><b>#2026-152125</b> — el número del ticket. El año y el
        consecutivo, que vuelve a empezar cada 1 de enero.</li>
        <li><b>El nombre de la derecha</b> — quién tenía el turno de caja. Es
        de ese cajón de donde salió o entró el dinero.</li>
        <li><b>El renglón grande</b> — cuánto hielo se llevó y cuánto costó,
        juntos. Es lo único que el cliente comprueba de un vistazo.</li>
        <li><b>El paréntesis de abajo</b> — de qué pedazos salió esa cuenta.
        Solo sale cuando dice algo que el renglón de arriba no diga ya.</li>
        <li><b>Los puntitos</b> — llevan el ojo del concepto a su precio sin
        que se salte de renglón. En una tira de ocho conceptos eso se nota.</li>
      </ul>

      <h4>Los avisos que puede llevar</h4>
      <ul>
        <li><b>** COPIA **</b>, entre asteriscos y hasta arriba de todo — es
        una reimpresión, no el original. Va antes que el número a propósito:
        una marca de copia que hay que buscar no sirve de nada.</li>
        <li><b>CANCELADO</b> — ese ticket ya no vale.</li>
        <li><b>CAMBIO DEL #2026-152124</b>, hasta abajo — este hielo ya se
        había pagado en otro papel; este es el cambio.</li>
        <li><b>A CRÉDITO</b>, con la raya para firmar — el cliente se lo llevó a
        crédito y este papel es el vale.</li>
      </ul>

      <h4>El gasto y el vale: el mismo papel</h4>
      <pre class="ayuda-formula">                     Gasto
Tony Castilla                 26/Ago/2026 5:45pm
- - - - - - - - - - - - - - - - - - - - - - - -
                    $6,250
GASOLINA PARA LIMPIAR PIEZAS DE LA MAQUINA NUEVA
EN REPARACION

FIRMA: _________________________________________</pre>

      <p>El vale es <b>exactamente este papel</b> con otro título: donde dice
      «Gasto» dice <b>«Vale de Jesús»</b>, y debajo del importe va su nombre
      completo. El nombre en el título no es adorno: es el único dato que
      separa un vale de un faltante.</p>

      <p>Se firma porque alguien se llevó dinero del cajón. <b>Meter</b>
      dinero también saca su papel, pero sin raya para firmar: nadie firma
      por dejar.</p>

      <h4>El corte</h4>
      <pre class="ayuda-formula">Corte #11                          Tony Castilla
        31/Ago/2026 9:15am - 2:47pm
- - - - - - - - - - - - - - - - - - - - - - - -
750 tickets           15 gastos           1 vale
- - - - - - - - - - - - - - - - - - - - - - - -
        Fondo ..........................    $500
      Cobrado .......................... +$5,785
   Gastos (2) ..........................   -$385
    Vales (1) ..........................   -$400
                                        ________
DEBERIA HABER ..........................  $5,500
    ENTREGADO ..........................  $5,450
- - - - - - - - - - - - - - - - - - - - - - - -
                   FALTA $55</pre>

      <p>La cuenta se lee como una cuenta de papel: los sumandos arriba, una
      raya, y el resultado debajo. Y el <b>FALTA</b> va subrayado, que es lo
      que hace que se lea como el resultado y no como un renglón más.</p>

      <h4>El tamaño de la letra</h4>
      <p>Está en <b>Sistema › La impresora de tickets</b>, junto al ancho del
      papel. Tres pasos:</p>
      <ul>
        <li><b>Chica</b> — 64 letras por renglón en vez de 48. Cabe más y se
        gasta menos papel, pero la letra queda apretada.</li>
        <li><b>Normal</b> — lo de siempre, 48 columnas.</li>
        <li><b>Grande</b> — las mismas 48 columnas, así que <b>nada se
        desacomoda</b>, pero la letra mide el doble de alto. Gasta el doble
        de papel: ese es el trato.</li>
      </ul>

      <p class="ayuda-tip"><b>Por qué son tres pasos y no un número.</b> Una
      impresora térmica no tiene tamaños libres como un procesador de textos:
      trae <b>dos letras grabadas</b> de fábrica y un multiplicador que
      agranda lo que ya hay. Un «13.5» no existe, y ofrecerlo sería mentir.
      Lo que sí se puede es probar los tres —el botón <b>Imprimir una
      prueba</b> está ahí mismo— y quedarse con el que se lea mejor en tu
      impresora.</p>

      <p class="ayuda-tip"><b>Dos cosas que una térmica no sabe hacer</b>, por
      si el papel no sale exactamente como en un dibujo: <b>no cambia de
      estilo a media línea</b> —en «Hielo a sacar · Tony Castilla» o los dos
      van en negritas o ninguno— y <b>no tiene cursivas</b>. Donde haría
      falta una cursiva va subrayado, que sí existe y hace el mismo trabajo.</p>`
  },

  // ==========================================================
  {
    id: 'gente',
    titulo: 'La gente de la fábrica: altas, bajas y PIN',
    busca: 'usuarios gente empleados trabajadores alta baja pin contraseña rol operario cajero repartidor gerente administrador quién entró actividad paños vendió turnos reactivar vale vales raya sueldo adelanto semana descontar debe',
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

      <h4>Los vales de raya</h4>
      <p>Un <b>vale de raya</b> es parte del sueldo de la semana pedida por
      adelantado. Se da desde la caja —botón <b>📤 Vale</b>— y aquí, en su
      ficha, queda su libreta: cuánto se llevó, cuándo y de qué turno
      salió. En la lista, junto a su nombre, sale <b>«debe $400 de
      vales»</b>, que es lo que se pregunta uno mirando esta pantalla el día
      de la raya.</p>

      <p>Al <b>pagarle su semana</b> desde <b>Sueldos</b> los vales se
      descuentan solos, todos de un jalón — no hay que venir aquí. Este
      botón <b>«ya se le descontó»</b> queda para cuando se le pagó por
      fuera del sistema y solo hay que apagar el recordatorio.</p>

      <p class="ayuda-tip">Ese botón <b>no mueve un peso</b>. El dinero
      salió del cajón el día del vale, y ahí se contó como gasto: el sueldo
      es gasto de la fábrica, y se cuenta una sola vez. Volver a contarlo
      aquí sería pagarle el sueldo dos veces en los números. Esta libreta
      es <b>un recordatorio</b>, no contabilidad.</p>

      <p>Nada se borra: los que ya se descontaron quedan marcados con quién
      y cuándo, y si se marcó por error, un botón lo deja otra vez
      pendiente. El sábado que se pagó tiene que poder mirarse en enero.</p>

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
    id: 'raya',
    titulo: 'Sueldos: cuánto gana cada quien y el pago de la semana',
    busca: 'raya sueldo sueldos pago pagar semana semanal por dia dia horario horas entra sale turno empleados operarios colaboradores vales adelanto descuento extras balance recibo firmar cajon caja fuerte gasto empresa dia de pago sabado nomina',
    cuerpo: `
      <p>Aquí está <b>lo que se le paga a cada quien</b> — lo que en la fábrica
      se le dice «la raya». En una pantalla:
      cuánto gana, qué días viene y de qué hora a qué hora, cuánto se llevó
      adelantado, y el papel que firma cuando se le paga.</p>

      <p class="ayuda-tip">Se llega desde el inicio, en <b>💰 Sueldos</b>.
      Es <b>solo del administrador</b>: lo que gana cada quien no se anda
      enseñando.</p>

      <h4>La lista</h4>
      <p>Todos los que trabajan, con lo que se pregunta uno el día de pago:
      <b>Gana</b>, <b>Viene</b> (días y horas de la semana) y <b>Vales</b>
      (lo que se llevó adelantado y no se le ha descontado). Arriba, en
      amarillo, sale quién trae vales sin descontar, y si a alguien todavía
      no se le ha puesto sueldo, lo dice — sin sueldo no se le puede pagar
      desde aquí, porque el sistema no inventa números.</p>

      <p>El <b>día de pago</b> se cambia con el botón de arriba. Viene en
      <b>sábado</b>, que es lo normal aquí, pero cada quien paga cuando
      paga.</p>

      <h4>Cuánto gana</h4>
      <p>Dos formas, y son distintas de verdad:</p>
      <ul>
        <li><b>A la semana</b> — gana lo mismo venga cinco días o seis.</li>
        <li><b>Por día</b> — se multiplica por los días que se le cuenten.
        Al pagarle se puede cambiar ese número, porque faltó un día o
        porque entró uno extra.</li>
      </ul>

      <p class="ayuda-tip"><b>Un aumento no borra lo anterior.</b> Cada
      sueldo se guarda con la fecha <b>desde</b> cuándo vale, y la lista de
      abajo enseña todos los que ha tenido. Se puede dejar apuntado un
      aumento con fecha de la semana que entra: la raya de esta semana se
      paga todavía con el sueldo viejo, que es lo correcto.</p>

      <h4>Sus días y sus horas</h4>
      <p>La semana se dibuja como una semana: siete casillas de domingo a
      sábado. Los días que viene salen en verde con la hora de entrada, la
      de salida y cuántas horas son; los que no viene, en gris. Un turno
      que cruza la medianoche —entra a las 22:00 y sale a las 6:00— se
      cuenta bien, son ocho horas.</p>

      <p>Esto es <b>su horario de costumbre</b>, no una checadora: sirve
      para saber a quién le toca mañana y para contarle los días a quien
      gana por día. No es un registro de si llegó tarde.</p>

      <h4>El pago de la semana</h4>
      <p>La cuenta se arma sola, y se lee como se dice de viva voz:</p>
      <pre class="ayuda-formula">sueldo + extras − vales − descuentos = SE LE PAGA</pre>
      <ul>
        <li><b>Extras</b> — horas de más, un domingo que entró, una
        gratificación. Se escribe el monto y por qué.</li>
        <li><b>Vales</b> — todo lo que se llevó adelantado y no se le ha
        descontado, entero. Salen listados con su fecha.</li>
        <li><b>Descuentos</b> — lo que se le descuenta por otra cosa, con
        su nota.</li>
      </ul>

      <p>Si la cuenta sale en <b>negativo</b> —debe más vales de lo que
      gana— el sistema no deja pagar. Eso no se arregla con un número rojo
      en un papel, se arregla hablando.</p>

      <h4>¿De dónde sale el dinero?</h4>
      <p>Al pagar se pregunta, y la respuesta cambia las cuentas:</p>
      <ul>
        <li><b>Del cajón</b> — se registra como salida de la caja abierta,
        igual que un gasto. El <b>corte de ese turno lo resta</b>, y tiene
        que restarlo: ese dinero ya no está en el cajón.</li>
        <li><b>De fuera</b> — de la caja fuerte, del banco, de la bolsa.
        Se registra como <b>gasto de la empresa</b> y el cajón <b>ni se
        entera</b>, porque ese dinero ya salió antes, cuando se hizo el
        retiro.</li>
      </ul>

      <p class="ayuda-tip">Las dos formas son correctas y las dos cuentan
      igual como gasto de la fábrica: <b>los sueldos entran en el costo por
      marqueta</b> de cualquiera de las dos maneras. Lo único que cambia es
      de qué bolsa salió, y eso importa para que el corte cuadre.</p>

      <h4>El papel que firma</h4>
      <p>Al pagar sale su recibo por la impresora: su nombre, la semana,
      los días, el sueldo, los extras, cada vale con su fecha, los
      descuentos y lo que se le entregó, con la raya para firmar. Sin
      impresora térmica se puede imprimir desde la computadora.</p>

      <p>Se puede ver antes de pagar, para enseñárselo y que no haya
      sorpresas.</p>

      <h4>Lo que ya se pagó</h4>
      <p>Abajo de su ficha quedan sus rayas pasadas: la semana, cuánto se
      le dio, de dónde salió y quién se la pagó. El papel de cualquiera se
      vuelve a imprimir cuando se necesite.</p>

      <p class="ayuda-tip">Una raya pagada <b>se congela</b>. Si mañana le
      suben el sueldo, la del sábado pasado sigue diciendo lo que decía: es
      un papel que ya se firmó. Y si se pagó mal, <b>se anula con su
      motivo</b> — se deshace el movimiento de la caja o el gasto de la
      empresa, y sus vales vuelven a quedar pendientes. Nada se borra:
      queda quién la anuló y por qué.</p>`
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
    id: 'neveras',
    titulo: 'Las neveras en comodato',
    busca: 'nevera neveras congelador comodato contrato prestamo prestada cliente ' +
           'mapa ubicacion direccion responsable whatsapp mantenimiento falla ' +
           'reparacion cortesia regalar bolsas cubos feria evento perdida baja ' +
           'se pago cuanto ha ganado dias sin pedir',
    cuerpo: `
      <p>Las neveras que se prestan a los clientes para el hielo en cubos.
      Dónde está cada una, cómo va, cuánto ha ganado, y cuáles piden que
      alguien vaya <b>hoy</b>.</p>

      <p class="ayuda-tip">Está en <b>🧊 Las neveras</b>, desde el inicio.
      El cajero y el gerente las <b>ven</b> y pueden <b>reportar una falla</b>
      —el cliente la reporta en el mostrador y hay que anotarla en el
      momento—. Prestarlas, moverlas y darlas de baja es del administrador:
      prestar una nevera es firmar un contrato.</p>

      <h4>La nevera y el préstamo son dos cosas</h4>
      <p>Esto es lo que más importa entender, y es lo que hace que el
      sistema sirva a los diez años:</p>
      <ul>
        <li><b>La nevera</b> es el fierro. Dura diez años y pasa por tres o
        cuatro clientes. Guarda su vida entera: lo que costó, sus
        mantenimientos, por cuántas manos ha pasado y cuánto ha ganado en
        total.</li>
        <li><b>El comodato</b> es el préstamo a <b>uno</b> de ellos. Guarda
        a quién, desde cuándo, en qué dirección, quién responde y el papel
        firmado.</li>
      </ul>
      <p class="ayuda-tip">Por eso, el día que recojas la nevera de Don Chuy
      y se la pongas a la tienda de la esquina, <b>no se pierde nada</b>: la
      nevera sigue siendo la misma y acumula lo de los dos. Guardadas como
      una sola cosa, habría que elegir entre pisar los datos del anterior o
      dar de alta otra nevera — y las dos son perder información.</p>

      <h4>El número que decide todo</h4>
      <pre class="ayuda-formula">lo que ha comprado de bolsas
  − lo que costó la nevera
  − lo que costaron sus reparaciones
  − lo que se le ha regalado
= ¿YA SE PAGÓ?</pre>

      <p>Es el número grande de cada ficha, y es el que dice <b>qué neveras
      valen la pena y cuáles hay que recoger</b>. Si no le has capturado lo
      que costó, el sistema no lo inventa: dice que falta el dato.</p>

      <p class="ayuda-tip"><b>Lo regalado resta, y por eso hay que
      anotarlo.</b> Si a un cliente se le regalan veinte bolsas al mes, esa
      nevera no está ganando lo que parece — y sin restarlo, justo la del
      cliente al que más se le consiente sale como la mejor.</p>

      <p>Solo cuentan <b>los productos marcados como de nevera</b> —las
      bolsas de cubos— y solo dentro de las fechas de ese préstamo. Una
      marqueta que ese mismo cliente compró para otra cosa no la pagó la
      nevera, y lo que compró antes de tenerla tampoco.</p>

      <h4>Los seis estados</h4>
      <ul>
        <li><b>En bodega</b> — aquí, lista para prestarse.</li>
        <li><b>Prestada</b> — con un cliente.</li>
        <li><b>La usa la fábrica</b> — aquí adentro, trabajando.</li>
        <li><b>Por reparar</b> — no sirve. Se pone sola al reportar una falla.</li>
        <li><b>No se sabe dónde está</b> — lo dijiste tú y es un estado de
        verdad, no un error. Que no se sepa dónde está no es lo mismo que
        haberla vendido, y esa diferencia es justo la que importa.</li>
        <li><b>De baja</b> — se vendió, se tiró o se dio por perdida para
        siempre. Con su motivo, y con toda su historia intacta.</li>
      </ul>

      <p class="ayuda-tip"><b>El estado lo manda el préstamo, no la mano.</b>
      Al entregarla pasa a «prestada» sola; al recogerla vuelve a «bodega».
      El sistema no te deja decir que está en bodega mientras siga con un
      cliente: serían dos verdades sobre la misma nevera, y la que se ve en
      la lista sería la equivocada.</p>

      <h4>No solo a clientes</h4>
      <p>Una nevera se puede entregar de tres maneras:</p>
      <ul>
        <li><b>A un cliente</b> — los de siempre, por años.</li>
        <li><b>A un evento o feria</b> — unos días, <b>con fecha de
        devolución</b>. El sistema avisa cuando esa fecha se pasa. No hace
        falta dar de alta un cliente: se escribe el nombre y ya, para no
        ensuciar el catálogo con una feria de tres días.</li>
        <li><b>A la fábrica</b> — se queda aquí adentro.</li>
      </ul>

      <h4>El mapa</h4>
      <p>Todas las neveras con ubicación puesta salen en un mapa de
      <b>OpenStreetMap</b>, con su número. Se arrastra, se acerca, y al tocar
      una chincheta se abre su ficha. El color dice cómo va: verde bien,
      ámbar si lleva días sin pedir, rojo si está descompuesta.</p>

      <p>La ubicación se pone en <b>Cambiar los datos</b>, de dos formas:
      <b>tocando el mapa</b> donde está la tienda, o pegando el enlace que
      Google Maps da al compartir (sirve el corto del celular). El sistema
      saca las coordenadas solo.</p>

      <p class="ayuda-tip"><b>El mapa necesita internet; la dirección
      escrita no.</b> Por eso la dirección es la que manda y el mapa es el
      lujo: si un día no hay señal, el mapa sale en gris y lo dice, pero las
      direcciones y los teléfonos siguen ahí. Y el botón <b>📍 Cómo llegar</b>
      abre Google Maps en el teléfono, que es lo que sirve para <i>ir</i>.</p>

      <h4>Fallas y mantenimientos</h4>
      <p>El botón <b>🔧 Reporta falla</b> anota lo que dijo el cliente y deja
      la nevera marcada como <b>por reparar</b>, para que nadie la dé por
      buena ni la vuelva a prestar. Cuando se atiende se anota qué se le
      hizo, quién y cuánto costó — y ese costo <b>resta</b> de lo que la
      nevera ha ganado.</p>

      <p>Una limpieza o un preventivo no la marcan: la nevera sigue
      trabajando. Y al recogerla se puede decir que volvió descompuesta,
      para que quede marcada de una vez.</p>

      <h4>El contrato</h4>
      <p>El botón <b>📄 Contrato</b> saca el comodato en hoja tamaño carta,
      <b>ya relleno</b> con el cliente, el responsable, la dirección, la
      nevera y su valor, listo para firmar. Y si le faltan datos <b>te lo
      dice antes</b>: descubrir que falta el domicilio con el cliente
      enfrente y la pluma en la mano es la peor forma de descubrirlo.</p>

      <p class="ayuda-tip"><b>El texto lo puedes cambiar sin actualizar el
      programa.</b> El día que tu abogado corrija una frase, se pega el texto
      nuevo y listo. Los huecos que se rellenan solos van entre llaves:
      <code>{cliente}</code>, <code>{nevera_numero}</code>,
      <code>{nevera_valor}</code>…</p>

      <p class="ayuda-tip"><b>Y algo importante:</b> el contrato que trae de
      fábrica está redactado siguiendo la figura del comodato y cubre lo que
      suele cubrirse —el destino del bien, la conservación, los daños, el
      robo, la devolución—, pero <b>no lo ha revisado un abogado</b>. Antes
      de firmarlo con el primer cliente, que lo lea uno de Yucatán. Y ojo
      con querer cargarlo demasiado de un lado: un contrato desequilibrado
      se puede caer entero. Las tres cláusulas que más se miran son la pena
      por no devolver, la responsabilidad por robo y la exclusividad.</p>

      <h4>Los avisos</h4>
      <p>Arriba de la lista sale <b>lo que pide acción hoy</b>: las que
      llevan días sin pedir, las descompuestas, las que se pasaron de la
      fecha de devolución y las que no se sabe dónde están. Si no hay nada,
      no sale nada — un tablero con cuatro ceros deja de mirarse.</p>

      <p><b>Los días para avisar los decides tú por cada cliente</b>, porque
      hay unos más lentos y otros más rápidos: se ponen en su ficha, en
      «Cambiar los datos». El que no tenga los suyos usa el general, que se
      cambia en <b>Ajustes</b>.</p>

      <p>Y hay <b>dos avisos por correo</b> nuevos (Sistema › Avisos por
      correo): <b>«Nevera que no ha pedido»</b>, que sale una vez al día con
      la lista y los teléfonos —es el que más vende de todos, porque dice a
      quién llamarle hoy—, y <b>«Nevera descompuesta»</b>, en cuanto alguien
      reporta una falla.</p>

      <h4>El botón de WhatsApp</h4>
      <p>Abre WhatsApp con el mensaje ya escrito para el responsable de esa
      nevera. El mensaje se cambia en <b>Ajustes</b>, y <code>{responsable}</code>,
      <code>{cliente}</code> y <code>{negocio}</code> se rellenan solos.</p>

      <p class="ayuda-tip">El botón <b>abre</b> WhatsApp; tú le das enviar.
      Mandarlo solo, sin tocar nada, requiere la API de WhatsApp Business,
      que cuesta y hay que pedirle permiso a Meta.</p>`
  },

  // ==========================================================
  {
    id: 'agua',
    titulo: 'La planta de agua: la máquina',
    busca: 'agua planta purificada osmosis membrana membranas filtro carbon zeolita ' +
           'suavizador clorinador tinaco ozono ultravioleta uv tds ppm cloro dureza ' +
           'rechazo de sales recuperacion medidor litros vuelta lectura retrolavado ' +
           'regeneracion sanitizacion pieza vida cambiar membrana cuadre marqueta 150 litros',
    cuerpo: `
      <p>La planta de ósmosis: cómo está saliendo el agua, qué le toca a cada
      equipo y a dónde se fue el agua que entró.</p>

      <p class="ayuda-tip">Está en <b>💧 La planta de agua</b>, desde el inicio.
      <b>Todos</b> —operario, cajero y gerente— pueden dar la vuelta y reportar
      una falla: la avería se ve cuando se ve, y el que trae el aparato en la
      mano es quien está ahí. <b>Cambiar una pieza, capturar lo que costó y
      mover los límites</b> es del administrador: una membrana cuesta lo que
      cuesta, y el límite del TDS decide si el agua se embotella o no.</p>

      <h4>El número que manda: el rechazo de sales</h4>
      <p>Una planta de ósmosis <b>no avisa cuando se está muriendo</b>. Sigue
      sacando agua, sigue llenando garrafones, y el agua se sigue viendo igual
      de transparente. Lo único que cambia es un número:</p>
      <p><code>rechazo = (TDS de entrada − TDS de salida) ÷ TDS de entrada</code></p>
      <ul>
        <li>Con membranas <b>nuevas</b> anda en <b>96–98 %</b>.</li>
        <li>Cuando baja de <b>90 %</b>, las membranas ya no purifican:
        <b>cuelan</b>. Ahí toca cambiarlas.</li>
      </ul>
      <p>Por eso ese número sale grande en la pantalla, y por eso abajo hay
      una línea con cómo viene: un dato suelto no dice nada —el TDS del pozo
      cambia con la lluvia—, lo que importa es <b>si la línea va bajando</b>.</p>

      <h4>Lo primero de todo: el cloro después del carbón</h4>
      <p>Es la medición más barata de tomar y la más cara de saltarse. El
      clorinador echa cloro al principio para desinfectar, y el filtro de
      <b>carbón activado</b> está ahí para quitárselo <b>antes</b> de que llegue
      a las membranas.</p>
      <p>Si el carbón ya se saturó, el cloro pasa — y <b>el cloro se come las
      seis membranas en días</b>. Por eso ese campo está resaltado en la
      pantalla y tiene su propio aviso por correo. Tiene que dar <b>0</b>.</p>

      <h4>La vuelta de revisión</h4>
      <p>Es lo que se hace todos los días, y por eso está en una sola tarjeta
      con un botón: siete ventanitas seguidas cada mañana harían que se dejara
      de anotar en una semana, y <b>una planta sin lecturas es una planta a
      ciegas</b>. Se anotan:</p>
      <ul>
        <li><b>TDS de entrada y de salida</b> — de ahí sale el rechazo.</li>
        <li><b>Cloro después del carbón</b> — tiene que dar 0.</li>
        <li><b>Dureza después del suavizador</b> — si sube, hay que regenerar:
        el sarro tapa las membranas.</li>
        <li><b>Los dos medidores</b> — lo que <i>marcan</i>, no lo del día.</li>
        <li><b>Presión</b> y <b>notas</b>, si hace falta.</li>
      </ul>
      <p class="ayuda-tip"><b>Vacío y cero no son lo mismo, y aquí importa
      más que en ningún otro lado.</b> «Cloro 0» quiere decir que se midió y
      salió limpio, que es la buena noticia del día. «Cloro vacío» quiere decir
      que nadie lo midió. Lo que no se midió, se deja en blanco.</p>
      <p>Mientras se escribe el TDS, la pantalla ya va diciendo cómo va a salir
      el rechazo. Es a propósito: el que captura tiene el aparato en la mano, y
      si el número sale mal <b>puede volver a medir ahí mismo</b> — la mitad de
      las veces lo que estaba mal era la medición.</p>

      <h4>Los medidores se anotan como marcan</h4>
      <p>Un medidor de flujo nunca se pone en cero: solo sube. Así que se anota
      <b>lo que marca</b>, y los litros del día salen restando la vuelta
      anterior — igual que los recibos de la luz.</p>
      <p>Eso tiene una ventaja grande: <b>un día que nadie anotó no se pierde</b>.
      El medidor lo siguió contando, y la siguiente vuelta lo recoge.</p>
      <p>Y si un día el medidor <b>marca menos</b> que la vez pasada —porque se
      cambió o se reinició—, el sistema lo marca y <b>no cuenta</b> ese renglón,
      en vez de inventar un consumo.</p>

      <h4>El equipo y la pieza son dos cosas</h4>
      <p>Es la misma idea que la nevera y su comodato:</p>
      <ul>
        <li><b>El equipo</b> es el puesto: «Membrana 3». Vive lo que viva la
        planta.</li>
        <li><b>La pieza</b> es lo que está puesto ahí hoy, y se cambia cada dos
        o tres años.</li>
      </ul>
      <p>Por eso cambiar la membrana 3 <b>no borra la anterior</b>: se apila. Y
      eso descubre cosas — si el puesto 3 se come una membrana cada año y los
      otros cinco duran tres, <b>lo que está mal no es la membrana, es lo que
      le llega</b>.</p>

      <h4>La vida de cada pieza</h4>
      <p>Cada equipo puede llevar cuánto le dura lo que tiene puesto, en días,
      en litros, o las dos. Manda la que vaya más adelantada: una lámpara de UV
      se acaba por meses aunque no pase agua, y una membrana por litros aunque
      el calendario no avance.</p>
      <p>De referencia, y todo es cambiable: carbón 730 días, zeolita 1460,
      membranas 1095, lámpara de UV 365.</p>
      <p class="ayuda-tip">Avisa a los <b>tres cuartos</b> de su vida, no al
      final. Una membrana no llega el mismo día que se pide, y quedarse sin
      ella es parar la planta.</p>

      <h4>A dónde se fue el agua</h4>
      <p>Es el cuadre del cuarto frío, pero con litros:</p>
      <ul>
        <li><b>Lo que marca el medidor</b> — la verdad.</li>
        <li><b>Marquetas × 150 L</b> — la teoría. Una marqueta entera y sellada
        pesa 150 kg, así que lleva 150 litros.</li>
        <li><b>La diferencia</b> es lo que se derramó por llenar los moldes de
        más — que hoy no lo ve nadie.</li>
      </ul>
      <p>Si sale en <b>negativo</b>, es al revés: el hielo se llevó más agua de
      la que marcó el medidor. O los moldes se están llenando de menos y las
      marquetas salen chicas, o falta anotar alguna vuelta.</p>
      <p class="ayuda-tip"><b>Todavía no cuadra del todo, y es a propósito.</b>
      Los garrafones y las botellas salen de esta misma agua y todavía no se
      registran. Cuando entren, se restan aquí y el cuadre queda completo.</p>

      <h4>Los servicios</h4>
      <ul>
        <li><b>Una falla</b> deja el equipo marcado como «por reparar» hasta que
        alguien anote qué se le hizo.</li>
        <li><b>Un retrolavado, una regeneración o una sanitización</b> se anotan
        ya hechos: son trabajo normal, no averías. Nadie «reporta» un
        retrolavado y espera a que alguien vaya.</li>
      </ul>
      <p>Al atender la última falla que le quedaba, el equipo vuelve a
      «trabajando» solo.</p>

      <h4>Los ajustes</h4>
      <ul>
        <li><b>TDS máximo de salida</b> — arriba de esto avisa que esa agua no
        debería embotellarse. De fábrica, 50 ppm.</li>
        <li><b>Rechazo mínimo</b> — de fábrica, 90 %.</li>
        <li><b>Dureza máxima</b> después del suavizador — de fábrica, 20 ppm.</li>
        <li><b>Días sin lectura</b> antes de avisar.</li>
        <li><b>Litros por marqueta</b> — 150, para el cuadre.</li>
      </ul>

      <h4>Los avisos por correo</h4>
      <p>Son <b>seis</b>, y se prenden en Sistema › Avisos por correo. Están en
      orden de qué tan caro sale no atenderlos: <b>cloro pasando por el
      carbón</b>, <b>el agua se pasó del TDS</b>, <b>las membranas se están
      acabando</b>, <b>pieza que ya cumplió su vida</b>, <b>nadie dio la
      vuelta</b> y <b>falla en la planta</b>.</p>
      <p class="ayuda-tip">Una sola vuelta puede disparar <b>tres correos
      distintos</b>, y salen los tres: son tres problemas con tres arreglos
      diferentes. Juntarlos en uno haría que el del cloro —el urgente— se
      leyera como un renglón más de un informe.</p>

      <h4>Nada se borra</h4>
      <p>Una lectura <b>no se edita: se anula</b> con su motivo y se toma otra.
      Una lectura es lo que marcaba el aparato ese día, y eso no cambia. Si se
      anotó mal, lo que dice la verdad es que alguien se equivocó — y eso
      también se guarda.</p>`
  },

  // ==========================================================
  {
    id: 'pedidos',
    titulo: 'Los pedidos: apartar, preparar y entregar',
    busca: 'pedido pedidos apartar reparto repartidor nota de entrega qr codigo qr ubicacion '
         + 'google maps mapa preparar preparacion garrafones bolsas botellones llamada telefono '
         + 'whatsapp encargo entregar entregado cancelar promesa para manana atrasado horario '
         + 'referencias direccion cobrar credito transferencia folio',
    cuerpo: `
      <p>Un pedido es cuando alguien <b>pide por teléfono, por WhatsApp, manda
      a alguien, o llega y dice «déjame veinte para el sábado»</b>. Se apunta,
      se va acumulando con los demás, y o sale con el reparto o se queda
      esperando a que vengan por él.</p>

      <h4>Un pedido NO es una venta todavía</h4>
      <p>Es lo más importante de entender, y lo que hace que todo lo demás
      funcione. Un pedido es una <b>promesa</b>: alguien pidió, alguien va a
      llevarlo. <b>La venta nace cuando se entrega</b>, no antes.</p>
      <p>Por eso:</p>
      <ul>
        <li>Un pedido que no salió <b>no ensucia las ventas del día</b>.</li>
        <li>El hielo <b>no sale del cuarto frío</b> hasta que sale de verdad.</li>
        <li>Y cancelar un pedido es cancelar una promesa, <b>no un ticket
        cobrado</b> — que es una cosa mucho más fea de explicar.</li>
      </ul>

      <h4>Cómo se toma uno: desde Cobrar</h4>
      <p>Se toma en <b>🛒 Vender</b>, no en otra pantalla. Se arma el ticket
      igual que siempre —los mismos botones, los mismos precios, el mismo
      teclado de fracciones— y se aprieta <b>F10</b>. Ahí, junto a cobrar,
      están las dos opciones:</p>
      <ul>
        <li><b>🚚 Pedido a domicilio</b> — sale en la camioneta con su nota.</li>
        <li><b>🏪 Lo pasan a buscar</b> — se queda aquí hasta que vengan por
        él, y se cobra entonces.</li>
      </ul>
      <p>Después pregunta <b>de quién es</b> —de la lista, o se da de alta ahí
      mismo con su nombre, teléfono y dirección—, <b>para cuándo</b> (hoy,
      mañana u otro día) y, si es a domicilio, <b>cómo va a pagar</b>.</p>
      <p>Sale un papel en los dos casos, pero no el mismo: a domicilio es la
      <b>nota de entrega</b>, para la mano del repartidor, con su QR; el que
      vienen a buscar es el <b>apartado</b>, para la mano del cliente, con
      lo que apartó, para cuándo, y <b>SE PAGA AL RECOGER</b> en grande. Ese
      papel es con el que vuelve.</p>
      <p class="ayuda-tip"><b>Cualquier cosa puede ser un pedido:</b> bolsas,
      garrafones, marquetas, lo que sea que esté en el ticket. Y siempre es
      <b>de alguien</b>: sin nombre no hay a dónde llevarlo ni a quién
      guardárselo.</p>

      <h4>Cobrar el que vienen a buscar</h4>
      <p>Cuando el cliente llega, en Vender se toca <b>🛍️</b> arriba —lleva
      el numerito de cuántos esperan—, se elige su pedido y se <b>carga en el
      ticket con los precios que se le prometieron</b>. De ahí es una venta
      como cualquiera: F10, con cuánto paga, el cambio, o a crédito. Al
      cobrarlo, el pedido queda entregado.</p>
      <p class="ayuda-tip">Lo que pidió <b>no se edita</b> en el ticket: si
      quiere algo más, se le cobra aparte. Cambiar lo apuntado después de
      haberle dicho un precio es la forma de que salga una cosa y se cobre
      otra.</p>

      <h4>Un solo botón, aunque sea agua y hielo</h4>
      <p>Si la tiendita pide <b>diez garrafones y cincuenta bolsas</b>, eso es
      UN pedido, no dos. Partirlo al capturarlo haría que el repartidor
      llegara con <b>dos notas a la misma puerta</b>.</p>
      <p>Lo que sí se parte es la <b>preparación</b>, porque ahí sí son dos
      áreas con dos personas. Y eso lo decide el producto: en la ficha de cada
      producto se marca si <b>se prepara en el agua</b>.</p>

      <h4>Las dos formas de verlos</h4>
      <p>En <b>📦 Los pedidos</b> hay dos pestañas, que son el mismo trabajo
      mirado desde dos sitios:</p>
      <ul>
        <li><b>Para preparar</b> — todo sumado por producto y partido en Agua
        y Hielo: «40 garrafones, 180 bolsas». Es lo que se lee en la planta,
        de pie y con las manos mojadas, y ahí a nadie le importa de quién es
        cada cosa. Con su hoja impresa para llevarla.</li>
        <li><b>Las notas de entrega</b> — una por cliente, con su dirección,
        su horario y su precio. Es lo que va en la mano del repartidor, y ahí
        lo que no importa es el total.</li>
      </ul>

      <h4>La nota de entrega y su QR</h4>
      <p>La nota contesta las tres preguntas en el orden en que se hacen
      bajando de la camioneta: <b>a dónde</b>, <b>qué llevo</b> y <b>qué
      cobro</b>. El horario de la tienda va arriba, porque es lo que decide si
      esta parada se hace ahora o después.</p>
      <p>Y lleva un <b>código QR</b>: se escanea con el teléfono y abre la
      ubicación del cliente en Google Maps. Sin teclear una dirección mientras
      se maneja.</p>
      <p class="ayuda-tip">El QR <b>solo sale si el cliente tiene ubicación
      guardada</b> (se pega en su ficha, en Clientes, el enlace que da Google
      Maps al compartir). Si no la tiene, la nota sale igual pero sin código:
      un QR que lleva a la coordenada cero manda al golfo de Guinea, y un
      repartidor que aprende que el QR miente deja de usarlo para siempre.</p>

      <h4>El precio se congela al tomarlo</h4>
      <p>Si el pedido se tomó el sábado y el lunes suben los precios, se cobra
      <b>lo que dice el papel</b> que el repartidor lleva en la mano. Discutir
      el precio en la puerta del cliente es perder el cliente.</p>
      <p>Lo mismo con la dirección: se copia al pedido. Si el cliente se muda,
      la nota de un pedido de hace tres meses sigue diciendo a dónde se llevó.</p>

      <h4>Lo atrasado y lo de mañana</h4>
      <p>Un pedido de ayer que no salió <b>sigue apareciendo</b>, marcado en
      ámbar. Esconderlo porque cambió el día es la forma más fácil de perder
      un cliente.</p>
      <p>Y lo de <b>mañana no sale en la preparación de hoy</b>: sería hielo
      derritiéndose en la camioneta. Para verlo, se mueve la fecha de arriba.</p>

      <h4>Entregarlo</h4>
      <p>Se toca <b>✅ Entregado</b> y pregunta <b>cómo pagó de verdad</b> —en
      la puerta el cliente cambia de opinión: iba a ser efectivo y pidió que
      se lo cargaran, o al revés—. Ahí nace la venta con los precios del
      pedido, sale su ticket, entra al corte del turno abierto y el hielo sale
      del cuarto frío.</p>

      <h4>Corregir y cancelar</h4>
      <p>De un pedido pendiente se puede cambiar <b>la fecha, las notas y cómo
      va a pagar</b>. Lo que <b>no</b> se cambia son las líneas: cambiar lo que
      pidió después de imprimir su nota es que salga una cosa y llegue otra. Se
      cancela y se toma otro.</p>
      <p>Cancelar pide <b>el motivo</b> y no borra nada: queda guardado para
      poder contestar «¿y el de la tiendita, qué pasó?» tres semanas después.</p>

      <h4>Quién puede qué</h4>
      <ul>
        <li><b>Cajera y gerente</b>: toman, entregan y cancelan.</li>
        <li><b>Repartidor</b>: ve y entrega, pero <b>no toma</b>. Un pedido
        nace de una llamada al mostrador; si pudiera crearlos en la calle,
        saldría hielo del cuarto frío contra un pedido que nadie pidió.</li>
      </ul>`
  },

  // ==========================================================
  {
    id: 'reparto',
    titulo: 'El reparto: la salida, el regreso y la liquidación',
    busca: 'reparto repartidor salida salidas camioneta vehiculo vehiculos moto triciclo '
         + 'carga cargar hoja de carga suelto liquidar liquidacion cuadrar cuadre merma '
         + 'derretido derretida regreso regresar entregar entregado no entregado dinero '
         + 'efectivo falta sobra diferencia recibir capacidad marquetas ruta viaje',
    cuerpo: `
      <p>Un <b>pedido</b> es lo que alguien pidió. Una <b>salida</b> es la
      camioneta cargada con varios de ellos, más lo suelto, dando la vuelta.
      Esto es lo segundo.</p>

      <h4>1 · Armarla</h4>
      <p>En <b>🚚 El reparto</b>, «+ Salida»: se elige <b>quién se la lleva</b> y
      <b>en qué</b>. Después se le cuelgan los pedidos —salen todos los
      pendientes con casillas, se desmarca lo que no sube y se cuelgan de un
      botón— y se le sube <b>lo suelto</b>: hielo y productos de más, para
      vender en la calle a quien se atraviese.</p>
      <p class="ayuda-tip">Lo de <b>mayoreo</b> no sube suelto. El precio de
      mayoreo es de alguien; en la calle no hay a quién cobrárselo. Eso va
      como pedido, con su cliente.</p>

      <h4>2 · Que salga</h4>
      <p>Al tocar <b>«Que salga»</b> se imprime la <b>hoja de carga</b>: lo que
      sube al camión, pedido por pedido y con su nombre, para el que lo sube y
      para el que lo revisa. No lleva precios a propósito — en el patio, con
      el camión abierto, un renglón de dinero estorba.</p>
      <p>Si le pusiste al vehículo <b>cuántas marquetas le caben</b>, avisa
      cuando la carga se pasa. Sobrecargarla es la forma más común de que el
      hielo llegue derretido.</p>
      <p class="ayuda-tip">Ya en la calle <b>no se le agrega ni se le baja
      nada</b>: lo que se le pusiera después no subió al camión, y el cuadre
      saldría con mercancía que nunca existió.</p>

      <h4>3 · El regreso</h4>
      <p>Se toca <b>«Ya regresó»</b> y se captura lo que pasó:</p>
      <ul>
        <li><b>Cada pedido</b>: ✅ entregado —y <b>cómo pagó de verdad</b>, que
        en la puerta el cliente cambia de opinión— o ↩️ volvió, <b>con su
        motivo</b>. El que vuelve queda pendiente otra vez y aparece en el
        reparto de mañana.</li>
        <li><b>Lo suelto</b>: cuánto vendió y cuánto volvió.</li>
      </ul>

      <h4>La merma sale sola</h4>
      <p>No se teclea nunca. Se cuenta lo que se puede contar con las manos y
      la merma es la resta:</p>
      <p class="ayuda-tip"><b>lo que subió − lo vendido − lo que volvió = lo que
      se derritió</b></p>
      <p>Es a propósito: teclear la merma es pedirle a alguien que confiese, y
      lo que se confiesa se redondea. Así el número es el que es, y la
      conversación deja de ser «¿cuánto se te derritió?» para ser «volvieron
      dos, ¿verdad?».</p>
      <p>El hielo derretido se carga solo al cuarto frío como <b>merma
      derretida</b>, igual que cualquier otra, y una sola vez.</p>

      <h4>4 · El dinero, en Vender</h4>
      <p>Cuando el repartidor vuelve, a quien le entrega el dinero es a
      <b>quien esté en la caja</b>. Por eso se recibe en <b>🛒 Vender</b>, con
      el botón <b>🚚</b> de arriba: lleva un numerito con cuántos están
      esperando. Si no hay ninguna camioneta de regreso, el botón lo dice
      y no hace nada más: las salidas <b>se arman en Reparto</b>, no aquí.</p>
      <p>Ahí sale <b>cuánto debía traer</b>, se teclea lo que entregó y se
      apunta. Si hay dos camionetas esperando, se elige de cuál es el dinero.
      Al recibirlo se imprime la <b>liquidación</b>, que es el papel que él
      firma.</p>
      <p class="ayuda-tip">Solo se le pide el <b>efectivo</b>. Lo que se fue a
      crédito o por transferencia no viene en su bolsa, y sale escrito aparte
      en su papel para que nadie se lo cobre.</p>

      <h4>Si no cuadra</h4>
      <p>Se apunta igual —el dinero ya está en la mano de la cajera—, sale un
      <b>correo en el momento</b> y la salida <b>queda abierta</b>.</p>
      <p>Cerrarla, escribiendo qué pasó, es del <b>gerente o el dueño</b>. La
      cajera recibe y ya: eso es contar billetes. Cerrar una salida
      descuadrada es decidir quién se come la diferencia, y esa decisión tiene
      dueño.</p>
      <p class="ayuda-tip">Mientras no se cierre, <b>el corte del turno va a
      salir corto</b>, y así tiene que ser: el hueco es real. Taparlo con un
      movimiento de caja lo escondería justo del papel donde se busca.</p>

      <h4>Por qué el dinero no se cuenta dos veces</h4>
      <p>Cada pedido entregado en efectivo crea <b>su venta</b>, y una venta en
      efectivo ya cuenta en el arqueo del turno. Recibirle el dinero al
      repartidor <b>no mete una entrada al cajón</b>: si lo hiciera, ese mismo
      dinero se contaría dos veces y la caja sobraría todos los días.</p>
      <p>Lo que se guarda al recibir es <b>cuánto entregó</b>, para poder
      restarlo de lo que debía traer.</p>

      <h4>El repartidor no se cuadra a sí mismo</h4>
      <p>Ve su salida —es su hoja de trabajo— y puede marcar lo que entregó.
      Lo que <b>no</b> puede es armar cargas, tomar pedidos ni recibirse su
      propio dinero. La persona a la que se le cuadra no puede ser la que
      cuadra.</p>

      <h4>Los vehículos</h4>
      <p>Se dan de alta una vez y se usan años, como los tanques: nombre
      («La camioneta blanca»), qué es, y cuántas marquetas le caben. Nada se
      borra — uno de baja se queda con todos sus viajes.</p>`
  },

  // ==========================================================
  {
    id: 'correo',
    titulo: 'Avisos por correo: que el sistema te escriba',
    busca: 'correo correos email gmail smtp aviso avisos alerta alertas notificacion notificaciones ' +
           'contraseña de aplicacion puerto 465 587 tls starttls informe del mes resumen del dia ' +
           'inventario bajo corte anulaciones tanque nuevo empleado nuevo llegada salida vale ' +
           'no me llego el correo spam cola pendiente',
    cuerpo: `
      <p>El sistema puede <b>escribirte por correo</b> cuando pase algo que
      quieras saber. Son quince avisos y cada uno se prende y se apaga por
      su cuenta, cuando quieras: hay semanas en las que uno quiere enterarse
      de todo y semanas en las que no.</p>

      <p class="ayuda-tip">Está en <b>✉️ Avisos</b>, desde el inicio. Es
      <b>solo del administrador</b>: ahí vive la contraseña de la cuenta de
      correo de la fábrica.</p>

      <h4>Primero: la cuenta que los manda</h4>
      <p>Hace falta una cuenta de correo desde la cual salgan los avisos. Lo
      normal —y lo que recomiendo— es <b>abrir una de Gmail para la
      fábrica</b>, no usar la personal: así, si algo se complica, se le
      cambia la contraseña sin tocar tu correo de todos los días.</p>

      <p class="ayuda-tip"><b>Gmail NO acepta tu contraseña normal.</b> Esto
      es lo que atora a todo el mundo. Hay que crear una
      <b>contraseña de aplicación</b>: son 16 letras que Google genera para
      un solo programa y que se pueden revocar solas.</p>

      <p>Cómo se saca, desde la computadora:</p>
      <ol>
        <li>Entra a la cuenta de Google de la fábrica.</li>
        <li><b>Tiene que tener prendida la verificación en dos pasos.</b> Sin
        eso, Google ni siquiera enseña la opción. Está en
        <b>Seguridad › Verificación en dos pasos</b>.</li>
        <li>Ya con eso, busca <b>«Contraseñas de aplicaciones»</b> en el
        buscador de la cuenta de Google.</li>
        <li>Ponle un nombre —«Hielo LOLHA»— y te da 16 letras.</li>
        <li>Cópialas en <b>Su contraseña</b> aquí, y guarda.</li>
      </ol>

      <p>Lo demás viene puesto y casi nunca hay que tocarlo:
      <b>smtp.gmail.com</b>, puerto <b>465</b>, cifrado <b>TLS</b>. Si usas un
      correo de dominio propio, tu proveedor te da esos tres datos; muchos
      piden el <b>587 con STARTTLS</b>, que es la otra opción del menú.</p>

      <p>En <b>A quién le llegan</b> puedes poner varios correos separados
      por coma. Y luego el botón <b>✉️ Mandar una prueba</b>: manda uno de
      verdad en el momento. Si algo está mal, te dice <b>qué</b> está mal —
      no un «no se pudo» a secas.</p>

      <p class="ayuda-tip">Abajo del todo está <b>Mandar avisos por correo</b>:
      es el apagador general. Apagado ahí no sale nada, aunque los quince
      avisos estén prendidos. Sirve para callarlo todo un fin de semana sin
      perder lo que tenías configurado.</p>

      <h4>Los quince avisos</h4>
      <p><b>Del dinero:</b></p>
      <ul>
        <li><b>Cada corte de caja</b> — al cerrar un turno, el corte completo:
        lo que debía haber, lo que entregaron y en qué se fue. Los retiros a
        la caja fuerte salen aparte, porque no son un gasto.</li>
        <li><b>Solo los cortes que no cuadran</b> — nada más cuando falta o
        sobra. Si no quieres los cortes de todos los días pero sí quieres
        enterarte cuando algo no cuadra, prende éste y apaga el de arriba.</li>
        <li><b>Vale de sueldo</b> — cada vez que alguien pide dinero a cuenta
        de su sueldo, con su nombre y cuánto.</li>
        <li><b>Raya pagada</b> — cuando se le paga la semana a alguien, con la
        cuenta de cómo salió y de dónde salió el dinero.</li>
        <li><b>Gasto grande de la empresa</b> — los que pasen del monto que
        pongas. Ese monto se cambia ahí mismo.</li>
        <li><b>Cambio de precios</b> — cuando alguien cambia un precio, una
        lista o el mayoreo, con el antes y el después.</li>
      </ul>

      <p><b>De lo que se deshace:</b></p>
      <ul>
        <li><b>Anulaciones que no hiciste tú</b> — tickets cancelados, sacadas
        anuladas, cosas dadas de baja o eliminadas. Con quién fue y el motivo
        que escribió.</li>
      </ul>
      <p class="ayuda-tip"><b>Lo que anula un administrador no avisa.</b> Lo
      hiciste tú y ya lo sabes; un correo por cada cosa que uno mismo acaba
      de hacer es la forma más rápida de que se dejen de leer los correos de
      este sistema.</p>

      <p><b>De lo que se acaba:</b></p>
      <ul>
        <li><b>Producto bajo de inventario</b> — cuando algo baja de su
        mínimo. <b>Avisa una vez</b>, cuando cruza, y no vuelve a avisar de
        eso hasta que se surta y se vuelva a acabar.</li>
        <li><b>Hielo por debajo del mínimo</b> — cuando el cuarto frío baja
        del mínimo de marquetas que tienes puesto.</li>
        <li><b>El cuarto frío no cuadró</b> — cuando lo contado no coincide
        con lo que debía haber, con toda la resta. Es la señal de un paño sin
        capturar o de hielo que salió sin ticket.</li>
      </ul>

      <p><b>De la gente y la fábrica:</b></p>
      <ul>
        <li><b>La planta de agua</b> — seis avisos, en orden de qué tan caro
        sale no atenderlos: <b>«Cloro pasando por el carbón»</b> (el más
        importante de todos: el cloro se come las seis membranas en días),
        <b>«El agua se pasó del TDS»</b>, <b>«Las membranas se están
        acabando»</b>, <b>«Pieza que ya cumplió su vida»</b>, <b>«Nadie dio la
        vuelta»</b> y <b>«Falla en la planta de agua»</b>. Los de pieza vencida
        y sin lectura salen una vez al día; los demás, en cuanto pasa.</li>

        <li><b>Tanque nuevo</b> y <b>Empleado nuevo</b> — cuando se dan de
        alta, con quién lo hizo.</li>
        <li><b>Llegada y salida de un trabajador</b> — cada vez que alguien
        entra al sistema con su PIN y cada vez que sale, con la hora.</li>
      </ul>
      <p class="ayuda-tip">Ese último es <b>cuando toca el sistema</b>, no un
      checador de la puerta. Alguien que llega y no entra a ninguna pantalla
      no aparece. Si quieres una checada de verdad —llegó a tal hora, se fue a
      tal hora, comparada con su horario— dímelo y la hacemos.</p>

      <p><b>Los resúmenes:</b></p>
      <ul>
        <li><b>Resumen del día</b> — una vez al día, a la hora que pongas: lo
        que se vendió, lo que se produjo y en qué se gastó. Es del día
        natural, de las 12 de la noche a las 12 de la noche, no de un turno.
        Un día sin nada no se manda.</li>
        <li><b>Informe del mes</b> — al cerrar el mes del negocio —el tuyo,
        del 12 al 12 si así lo tienes—: ventas, producción, gastos, la luz y
        el costo por marqueta.</li>
      </ul>

      <h4>«No me llegó el correo»</h4>
      <p>Abajo a la izquierda está <b>Lo que ha salido</b>: los últimos
      avisos con su estado. Cada uno dice <b>salió</b>, <b>esperando</b> o
      <b>no salió</b>, y en los dos últimos casos, por qué. Eso convierte
      «no me llegó» en algo que se puede mirar.</p>

      <p class="ayuda-tip"><b>Un aviso no se pierde si se va el internet.</b>
      No se manda en el momento: se apunta y sale en cuanto haya línea. Se
      vuelve a intentar solo, cada vez con más espera, hasta ocho veces. Y si
      el problema no es la red sino la contraseña, no insiste: lo deja
      marcado como «no salió» con el motivo, que es lo que hay que ver.</p>

      <p>Si un aviso te llega a <b>correo no deseado</b>, márcalo como
      «no es spam» la primera vez y agrega la cuenta de la fábrica a tus
      contactos. A partir de ahí llegan a la bandeja normal.</p>

      <p class="ayuda-tip"><b>Gmail deja mandar unos 500 correos al día</b>
      desde una cuenta normal, que para una fábrica sobra de largo — salvo
      que prendas «llegada y salida» con mucha gente y muchos turnos. Si
      alguna vez toparas, el aviso se queda en la cola y sale al día
      siguiente; no se pierde.</p>`
  },

  // ==========================================================
  {
    id: 'numeros',
    titulo: 'Los números: qué significa cada uno',
    busca: 'estadísticas números gráficas costo por marqueta imprimir hoja carta pdf tendencia día por día en qué se fue el dinero raya sueldos reparto amoniaco luz cfe kilowatt kwh consumo recibo precio subir orden acomodar mover flechas dos columnas clientes quién compra más mejores clientes',
    cuerpo: `
      <p>La pantalla <b>📊 Los números</b> no es un tablero: es una
      <b>hoja</b> que se lee de arriba abajo y se imprime tal cual. Está en
      el orden en que uno se hace las preguntas.</p>

      <h4>El orden lo pones tú</h4>
      <p>Cada apartado tiene sus flechas <b>↑ ↓</b> en la esquina: con
      ellas se sube o se baja lo que quieras ver primero. El orden
      <b>se guarda en la fábrica</b>, no en la computadora donde lo
      cambiaste, así que sale igual desde la PC y desde la pantalla táctil.
      En pantalla ancha la hoja va en <b>dos columnas</b>; las gráficas que
      necesitan el ancho entero —el resumen, el día por día y la
      tendencia— lo ocupan solas. En un teléfono se apila todo.</p>

      <h4>La luz: tres preguntas, no una</h4>
      <p>Un recibo más caro puede ser tres cosas distintas, y juntas no se
      contestan. Por eso van separadas:</p>
      <ul>
        <li><b>Se consumió</b> — los kilowatts que marcó el medidor.</li>
        <li><b>A cómo salió el kilowatt</b> — el precio. Eso lo pone la
        CFE, y si sube <b>no hay nada que arreglar en la fábrica</b>.</li>
        <li><b>Luz por marqueta</b> — cuántos kilowatts cuesta hacer una.
        Eso sí lo pone la fábrica: si sube, se está gastando <b>más luz
        para hacer lo mismo</b>, y eso es una máquina que hay que revisar.
        Este número <b>no se puede leer en el papel del recibo</b>.</li>
      </ul>
      <p class="ayuda-tip">Pueden subir los dos a la vez, y por eso van en
      renglones y en gráficas separadas. En <b>los últimos doce meses</b>
      está cada uno con su línea: ahí se ve si algo viene subiendo desde
      hace rato o si fue solo este mes.</p>
      <p>Todo esto sale de los <b>recibos de la CFE</b> capturados en
      <b>La empresa</b>, con sus kilowatts y su importe. Si falta algún
      recibo del mes, la hoja lo dice y esos números van cortos.</p>

      <h4>Quién compra más</h4>
      <p>Los clientes que más se llevaron en el mes, con lo que se llevaron
      en dinero y en marquetas, cuántas veces vinieron, cuántas a crédito y
      cuándo fue la última.</p>
      <p class="ayuda-tip">Solo entra lo que se cobró <b>con nombre</b>. El
      mostrador de a cuarto es la mitad del negocio y no tiene dueño:
      meterlo aquí como «sin cliente» sería un renglón que tapa a todos los
      demás y no dice nada de nadie.</p>

      <h4>Se vendió</h4>
      <p>El precio de todo lo que salió en el mes, <b>esté cobrado o
      a crédito</b>. Lo del crédito se dice aparte, porque es dinero que se vendió
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
    busca: 'puesta en marcha arranque empezar producción real borrar pruebas limpiar cortes cuadrar realidad rotación paños congelando primer conteo cuanto hielo hay cuarto frio apagón se borra se queda',
    cuerpo: `
      <p>La fábrica ya trabajaba cuando llegó el sistema. La <b>puesta en
      marcha</b> (🚀 en Sistema, solo el administrador) es el día en que se
      le dice cómo está el mundo real, en orden y una sola vez:</p>
      <ul>
        <li><b>Los tanques</b> — que estén como son, con sus paños,
        canastas y moldes.</li>
        <li><b>Dejarlo completamente limpio</b> — todo lo capturado en el
        ensayo se borra para que los números empiecen de cero. La pantalla
        <b>enseña antes qué se va a borrar, contado</b> —«48 ventas, 3
        cortes de caja, 7 gastos»— y qué se queda. Antes se hace un
        respaldo solo, y pide escribir BORRAR PRUEBAS más la contraseña. El
        primer ticket real vuelve a ser el <b>#1</b>.</li>
        <li><b>Los paños</b> — cuáles llevan horas congelando (y desde
        cuándo) y cuáles están fuera. "Sin tocar" no escribe nada.</li>
        <li><b>La rotación</b> — cuál fue el último paño que se sacó; el
        sistema contesta "entonces toca el N".</li>
        <li><b>El hielo</b> — cuánto hay <b>ahorita</b> en el cuarto frío,
        con su teclado de fracciones, ahí mismo. Es el primer conteo: fija
        el punto de partida y no cuadra contra nada. Se puede volver a
        anotar todas las veces que haga falta hasta que quede bien.</li>
        <li><b>Los productos</b> — su primer conteo cada uno.</li>
      </ul>

      <h4>Qué se borra y qué se queda</h4>
      <p>La línea es simple: <b>se borra lo que PASÓ</b> —una venta, un
      corte, una sacada, un gasto, una lectura de la planta— porque los de
      las pruebas son hechos que no pasaron. <b>Se queda lo que ES</b>:
      tanques, productos, precios, la gente, los clientes, las neveras y
      los equipos de la planta, que costaron trabajo capturar y siguen
      siendo verdad mañana.</p>
      <p class="ayuda-tip">Dos que parecen movimiento y no lo son, y por eso
      se quedan: <b>dónde está cada nevera</b> y <b>qué pieza trae puesta
      cada equipo</b>. Borrarlas dejaría cincuenta neveras sin dueño y la
      planta entera «sin capturar» al día siguiente.</p>

      <p class="ayuda-tip"><b>El dinero no se pregunta:</b> la caja empieza
      en cero. El primer cajero entra con su PIN —eso abre su turno— y desde
      ahí el arqueo cuadra solo.</p>

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
      <p class="ayuda-tip">El hielo y los productos no tienen botón de
      cuadre, a propósito: <b>los conteos de siempre son el cuadre</b>, y
      son los que destapan un faltante en vez de taparlo.</p>`
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
