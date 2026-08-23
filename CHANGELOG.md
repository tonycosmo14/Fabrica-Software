# Historial de versiones

Este archivo es el espejo de `src/version.js`, que es lo que ve el usuario
dentro del sistema en la pantalla **Qué hay de nuevo**.

Tipos: `nuevo` (funcionalidad nueva) · `mejora` · `arreglo` · `clave` (regla de negocio importante)

---

## v0.7 — La Existencia · 23 de agosto de 2026

El control que hoy se lleva en libreta. Migración `006_existencia.sql`.

    existencia anterior + producido − contado = SALIDAS

- **clave** — Tablas `almacenes` y `conteos`. El conteo guarda **congelados** `existencia_anterior`, `producido` y `salidas` (regla 3.2): corregir o anular una sacada vieja no cambia un corte que ya se hizo. Hay una prueba que anula producción anterior y verifica que el conteo no se mueve.
- **clave** — Las cantidades se guardan en **dieciseisavos** aunque se cuenten en marquetas (regla 3.1), así el día que haya media marqueta el modelo ya la admite.
- **nuevo** — Pantalla de Existencia con el cuadre línea por línea y las salidas en grande. Verde si cuadra exacto, ámbar si hay diferencia, azul si sobran.
- **nuevo** — Ticket imprimible de cada conteo, con espacio para la firma.
- **nuevo** — Horarios de conteo configurables (15:00 y 20:00 por omisión) y aviso de "toca contar" cuando pasó la hora y no se ha hecho.
- **nuevo** — Cuartos fríos configurables, con la marca de cuál recibe la producción de los tanques. No se puede dejar la fábrica sin ninguno que la reciba.
- **nuevo** — Historial de conteos y anulación con motivo; al anular, vuelve a valer el conteo anterior.
- **nuevo** — Permisos `existencia.ver`, `existencia.contar` y `existencia.corregir`. El cajero cuenta; anular y configurar son del gerente y del administrador.

---

## v0.6 — Respaldos automáticos · 23 de agosto de 2026

El usuario planteó su miedo real: perder los datos si muere la PC. La
respuesta no es mover todo a un hosting (sin internet la fábrica se para y
la impresora térmica es local), sino copiar fuera de la máquina.

- **clave** — `src/db/respaldos.js`: copia automática cada N horas (4 por omisión) y una al arrancar. El reloj revisa cada 10 minutos si toca, así un apagón nocturno no se salta el respaldo: al encender lo hace.
- **clave** — Segunda copia en una carpeta fuera de la PC (USB, Drive, OneDrive). Es la única que sobrevive a un disco muerto.
- **clave** — Antes de copiar se fuerza `PRAGMA wal_checkpoint(TRUNCATE)`. Sin eso el respaldo podría no traer los últimos movimientos, porque SQLite en modo WAL los guarda en un archivo aparte. Hay una prueba que lo verifica escribiendo un dato y buscándolo dentro de la copia.
- **nuevo** — Pantalla de estado en Sistema: si está sano, cuándo fue el último, cuántas copias, y si la copia de fuera está fallando.
- **nuevo** — La carpeta externa se prueba escribiendo un archivo antes de aceptarla.
- **nuevo** — Si la carpeta externa falla, la copia local se hace igual y el error queda anotado y visible. Un fallo de la USB no puede tumbar el respaldo.
- **nuevo** — Poda automática: se conservan las últimas 30 copias.
- **nuevo** — Instrucciones de restauración en la propia pantalla.

Pruebas: 75. Incluyen abrir un respaldo como base de datos y comprobar que
tiene los datos, y simular una USB desconectada.

---

## v0.5.1 — Autoriza primero, decide después · 23 de agosto de 2026

- **clave** — La puerta de autorización se mueve al primer toque. Nuevo `POST /produccion/autorizar` + `src/modulos/produccion/vales.js`: el responsable teclea su PIN una vez y el servidor devuelve un **vale** de un solo uso, atado a ese paño y con caducidad de 15 minutos. Así la pantalla puede enseñar las opciones sin guardar el PIN de nadie en memoria.
- **nuevo** — En "Registrar lo que se sacó" la rotación avanza conforme se marca: 1, 3, 5 seguidos son correctos y no piden nada; solo lo que rompe de verdad el orden pide autorización, y el vale viaja con el lote.
- **nuevo** — `tanqueConEstado` expone `ordenRotacion` y `ultimoPanoSacado`, para que la pantalla calcule el siguiente sin ir al servidor en cada toque.
- **nuevo** — El detalle del paño lleva selector de quién lo sacó y el botón del agua, que se recuerda.
- **arreglo** — El alta de usuarios pedía contraseña a un operario. El bloque de usuario y contraseña solo aparece para admin y gerente.
- **mejora** — Botones de acción centrados en el detalle del paño.

---

## v0.5 — Los números a sacar · 23 de agosto de 2026

**Bugs corregidos:**

- **arreglo** — Un paño con todas sus canastas fuera del tanque no respondía al tocarlo: la única acción era sacar, y ya no había nada que sacar. Nuevo `POST /produccion/panos/:id/rellenar`.
- **arreglo** — Anular solo funcionaba sobre una sacada en proceso. Nuevo `POST /produccion/panos/:id/anular-ultima`, que anula la última sacada del paño esté terminada o no.
- **arreglo** — El cliente descartaba los campos extra que acompañan a un error del servidor (`requiereAutorizacion`, `tocaPano`), así que la pantalla no sabía qué preguntar.

**Autorización real:**

- **clave** — Saltarse la rotación ya no depende de quién tiene la sesión abierta: exige motivo escrito y el **PIN de un gerente o del administrador**, verificado en el servidor. Queda firmado en `autorizada_por`.

**Reordenado según el uso real:**

- **nuevo** — `GET /produccion/siguientes` y la vista imprimible: el papel con los paños que siguen en cada tanque, fecha, hora, quién entregó y espacio para lo que sacó de verdad. Solo `produccion.autorizar`.
- **nuevo** — "Registrar lo que se sacó" pasa a ser la primera acción de la pantalla.
- **nuevo** — El detalle del paño concentra sacar, rellenar, marcar merma molde por molde y corregir.

**Otros:**

- **nuevo** — Racha de fallos consecutivos por molde: se corta en cuanto sale bien una vez, y así se distingue el molde defectuoso del mal día.
- **nuevo** — El agua potable tiene color propio (morado) frente al azul de la purificada.
- **nuevo** — Diálogos de texto libre y de autorización con PIN.

---

## v0.4 — Producción como trabaja la fábrica · 23 de agosto de 2026

Rehecho tras entender la operación real. Migración `005_produccion_real.sql`.

**El modelo cambió, no solo la pantalla:**

- **clave** — La unidad de trabajo es el **paño**, no la canasta. Nace `sacadas_pano`: un paño empezado y sin terminar queda **en proceso** y cualquiera lo continúa; los dos obreros quedan registrados en las canastas que hizo cada uno.
- **clave** — **Sacar y rellenar son un solo movimiento** en la interfaz, porque los moldes siempre se vuelven a llenar. En la base siguen siendo dos eventos separados: el reloj de congelación depende de eso. Dejar un paño fuera (limpieza, se acabó el agua) es la excepción explícita.
- **clave** — La **rotación intercalada** (1, 3, 5… luego 2, 4, 6…) pasa de sugerencia a regla, en `src/modulos/produccion/rotacion.js`. Sacar otro paño exige permiso `produccion.autorizar` y motivo; queda en `sacadas_pano.autorizada_por` y `motivo_orden`. Una sacada fuera de orden **no** mueve el puntero de la rotación.
- **clave** — Se eliminan los turnos de abrir y cerrar: cada movimiento guarda hora y ejecutor. Los obreros no reportan uno por uno.
- **nuevo** — `POST /produccion/lote`: el flujo real de las 3 de la tarde. El obrero dice los números, el cajero los marca y se registran todos a nombre del obrero, con el capturista aparte.
- **nuevo** — Rol **gerente**, entre cajero y administrador: autoriza y corrige. Requirió recrear la tabla `usuarios` (el rol vive en un CHECK), y con ello una escotilla `-- sin-transaccion` en el runner de migraciones.
- **nuevo** — `POST /produccion/sacadas-pano/:id/anular`: la sacada queda marcada como anulada con su motivo; no se borra el registro del paño.
- **nuevo** — Memoria por molde: el último resultado de cada molde se pinta en la pantalla. Un molde marcado siempre es un problema físico.

**Diseño:**

- **mejora** — Encabezado en un solo renglón (reloj, logo centrado, usuario y menú), responsivo para que nada se encime en 390px.
- **mejora** — El menú entra deslizándose, con los enlaces escalonados, y respeta `prefers-reduced-motion`.
- **nuevo** — Esquema visual e instrucciones plegables en Configurar tanques, base del manual de ayuda.
- **nuevo** — Vuelve la ficha ＋ al final de cada paño para agregar canasta de un toque.
- **mejora** — En PC los tanques se acomodan en rejilla de 2 y 3 columnas; ancho útil de 1180px.
- **mejora** — Pestañas de tanque centradas y con desplazamiento lateral.

---

## v0.3 — Producción · 23 de agosto de 2026

El trabajo diario en los tanques. Migración `004_produccion.sql`.

- **clave** — El estado de la canasta (congelando / lista / fuera) **no se guarda**: se deduce del último evento de esa canasta (regla 3.2). No existe ninguna columna `estado` editable, así que cualquier fecha del pasado se reconstruye tal como fue.
- **clave** — Sacar y rellenar son **dos eventos separados** (6.3). Una canasta sacada y no rellenada queda en estado `fuera`, sale en la alerta y bloquea el cierre del turno mientras no se resuelva.
- **nuevo** — Turno de producción como línea de tiempo propia, independiente de la caja y del reparto (sección 4). Al cerrar avisa cuántas canastas quedaron fuera; se puede forzar y queda constancia.
- **nuevo** — Pantalla con pestañas por tanque, un paño por renglón y las canastas como bloques de cuadritos (un cuadrito = un molde). Los 18 paños del tanque N caben en una pantalla de celular.
- **nuevo** — Un tap: canasta lista → sacar todos los moldes bien; canasta fuera → rellenar (6.6). Las excepciones van en el menú del paño.
- **nuevo** — La sacada calcula y guarda las **horas reales** que estuvo congelando, ligándose al rellenado del que viene. Es la base para que el sistema aprenda el tiempo real de cada tanque (6.8).
- **nuevo** — Paño sugerido: el listo que lleva más tiempo congelando. La rotación intercalada emerge del dato, no se configura (6.5).
- **nuevo** — Merma molde por molde con tres estados (bien / merma / hueco) y conteo en vivo de marquetas buenas.
- **nuevo** — Tipo de agua (purificada o potable) en cada rellenado, recordado durante la sesión para no romper el flujo de un tap.
- **nuevo** — Resumen del turno con marquetas, merma y el historial de movimientos con hora y responsable.
- **arreglo** — `.gitignore` no cubría `datos/marca/`, así que el logo subido aparecía como cambio en Git; además se había subido por error un logo de prueba al repositorio. Ahora `/datos/` completo está fuera de Git.

---

## v0.2.2 — Encabezado, reloj y atajos · 23 de agosto de 2026

- **clave** — `RECUPERAR-ACCESO.bat` / `npm run recuperar`: restablece PIN y contraseña de un administrador desde la consola de la PC donde vive el sistema. Cierra sus sesiones abiertas y lo anota en la bitácora. La frontera de seguridad real de un sistema local es el acceso físico a la máquina, no una contraseña irrecuperable.
- **nuevo** — Encabezado rediseñado: logo al centro, reloj y fecha a la izquierda, usuario activo y su rol a la derecha.
- **nuevo** — Tachita (✕) sobre las imágenes para eliminarlas, con confirmación "Imagen eliminada".
- **nuevo** — Acciones rápidas por tanque desde la lista: ver, agregar paños, quitar los últimos, dar de baja.
- **nuevo** — `POST /tanques/:id/panos` acepta `cantidad`, y `POST /tanques/:id/panos/quitar-ultimos` quita varios de golpe (sin dejar el tanque sin paños).
- **nuevo** — La pantalla Sistema muestra la ruta de la base de datos y explica la recuperación de acceso.
- **nuevo** — Firma discreta "Desarrollado por CasTec" en la entrada y en el menú.
- **arreglo** — Con el botón de atrás oculto (`display:none`) la rejilla del encabezado se recorría y el logo dejaba de estar centrado; ahora se oculta con `visibility` para que conserve su hueco.

---

## v0.2.1 — Personalizar y mejor acabado · 23 de agosto de 2026

- **nuevo** — Pantalla **Personalizar**: subida del logo (PNG, SVG, JPG o WEBP, hasta 3 MB) con variante opcional para modo oscuro, y datos del negocio. El archivo se guarda en `datos/marca/`, nunca en `public/`, para que sobreviva a las actualizaciones. Migración `003_marca.sql`.
- **nuevo** — Validación del logo: firma real del archivo (no basta con el nombre), rechazo de SVG con `<script>`, `<foreignObject>`, `javascript:` o manejadores `on*`, y servido con `Content-Security-Policy: default-src 'none'; sandbox` más `nosniff`.
- **arreglo** — **No había forma de quitar un paño desde la interfaz.** La ruta existía en la API desde la v0.2 pero nunca se expuso el botón; había que dar de baja el tanque entero. Ahora hay menú por paño (agregar canasta / quitar paño) y se recupera desde "Ver bajas".
- **nuevo** — Diálogos propios (hoja inferior en celular, tarjeta centrada en PC) que sustituyen a `prompt()` y `confirm()`, con un contador − / ＋ para los moldes.
- **arreglo** — En los diálogos la promesa se resolvía dos veces y ganaba el valor de cancelación, así que confirmar no hacía nada. Lo detectó la prueba de navegador del propio arreglo del paño.
- **mejora** — La pantalla pasa a llamarse **Configurar tanques** en la ruta `#/config-tanques`; `#/tanques` queda libre para Producción.
- **mejora** — Acabado del configurador: tarjetas de tanque con degradado de marca, cabecera de detalle y total en grande.
- **arreglo** — En pantallas grandes el botón de opciones del paño caía a un segundo renglón: la rejilla del media query se había quedado en tres columnas.
- **arreglo** — El aviso flotante tapaba los diálogos.

---

## v0.2 — Tanques · 23 de agosto de 2026

La jerarquía física de la fábrica: `Tanque → Paño → Canasta → Molde`.

- **nuevo** — Migración `002_tanques.sql` con las cuatro tablas. Cada molde es una fila real con su posición; sin eso es imposible detectar que un molde concreto falla siempre.
- **nuevo** — Alta de tanque en un solo paso: nombre, número de paños y plantilla de canastas. Se crean tanque, paños, canastas y moldes dentro de una transacción.
- **nuevo** — Total de moldes calculado en vivo en el asistente, antes de guardar.
- **nuevo** — Detalle del tanque: un paño por renglón con sus canastas como bloques táctiles (la canasta es la unidad de operación, sección 6.2).
- **nuevo** — Agregar paños y canastas, ajustar los moldes de una canasta y dar de baja tanques, paños, canastas o moldes sueltos con su motivo.
- **nuevo** — `horas_congelacion` por tanque como punto de partida; en la v0.3 el sistema empezará a aprender el tiempo real.
- **clave** — Nada hardcodeado (error 11 del plan): la configuración de la fábrica se captura desde la interfaz.
- **arreglo** — Tocar en el menú la ruta en la que ya estabas no re-dibujaba la pantalla.
- **arreglo** — El `pattern` del campo usuario era inválido bajo el modo `v` de expresiones regulares de los navegadores nuevos.

Verificado con los tres tanques reales: 2N = 182, T = 156, N = 234, **572 moldes**.

---

## v0.1.4 — Hielo LOLHA · 23 de agosto de 2026

- **clave** — Asistente de primer arranque: crea tu cuenta de administrador. Se eliminó el usuario `admin` con PIN `1234` que venía de fábrica; un PIN por omisión es una puerta trasera que nadie cierra.
- **nuevo** — Modo oscuro con selector Claro / Oscuro / Auto en el menú, guardado por dispositivo.
- **nuevo** — Paleta de la marca Hielo LOLHA (cian `#29abe2`, azul `#1c75bc`) en un solo bloque de variables CSS, y el logotipo reproducido en texto.
- **arreglo** — En pantallas grandes el teclado del PIN se desbordaba de la tarjeta: la regla de ancho mínimo de la v0.1.1 también afectaba a los botones del teclado.
- **arreglo** — El menú mostraba el rol en crudo (`admin`).
- **arreglo** — Contraste del botón de peligro en modo oscuro.

---

## v0.1.3 — Se instala sin pelear · 22 de agosto de 2026

`npm install` fallaba en Windows con Node 24: `better-sqlite3` viene en C y no
tenía binario precompilado para esa versión, así que intentaba compilarlo y
exigía Visual Studio con el workload de C++.

- **arreglo** — Ya no pide Visual Studio ni herramientas de programador.
- **clave** — La base de datos pasa a ser `node:sqlite`, el SQLite que Node.js trae incluido. Cero dependencias nativas en todo el proyecto.
- **mejora** — De 104 paquetes a 67; la instalación tarda segundos.
- **mejora** — Aviso en español si la versión de Node es anterior a la 22.5.
- **mejora** — Mensaje útil cuando la preparación falla.

Nota técnica: el único archivo que cambió fue `src/db/conexion.js`. El resto del
código no se tocó porque la interfaz (`prepare`/`get`/`all`/`run`/`transaction`)
se mantuvo igual. Las 14 pruebas pasaron sin modificarse.

---

## v0.1.2 — Se abre con doble clic · 22 de agosto de 2026

Ya no hace falta escribir comandos: hay un icono en el escritorio.

- **nuevo** — `INICIAR.bat`: arranca el sistema y abre el navegador cuando ya está listo.
- **nuevo** — `CREAR-ACCESO-DIRECTO.bat`: pone el icono del cubo de hielo en el escritorio.
- **nuevo** — `DETENER.bat` y `ACTUALIZAR.bat`, también de doble clic. `INICIAR-MAC.command` para Mac y Linux.
- **nuevo** — La primera vez instala las dependencias solo; si falta Node.js, abre la página de descarga.
- **nuevo** — Manifiesto web: desde el celular se instala en la pantalla de inicio y se abre sin barra del navegador.
- **mejora** — Se comprueba el puerto antes de tocar la base: un segundo doble clic avisa que ya está abierto en vez de migrar por segunda vez.

---

## v0.1.1 — Se ve bien en la PC · 22 de agosto de 2026

La interfaz ya estaba pensada para el celular. Esta versión la ajusta para que
en la pantalla grande de la caja y de la oficina se vea igual de bien.

- **mejora** — En pantalla grande los accesos se acomodan en cuatro columnas y el contenido queda centrado.
- **mejora** — La pantalla de entrada se ve como una tarjeta centrada, no como una columna suelta.
- **nuevo** — En la PC el PIN se puede escribir con el teclado: números, Retroceso para borrar y Esc para volver.
- **mejora** — Los botones resaltan al pasar el ratón encima y ya no se estiran de lado a lado.
- **arreglo** — La versión aparece en la barra superior, sin repetir la letra "v".
- **arreglo** — Las casillas de verificación ahora son grandes y fáciles de tocar.

---

## v0.1 — Cimientos · 22 de agosto de 2026

Arranca el sistema: base de datos, migraciones automáticas, respaldos,
usuarios con PIN, roles y permisos, y la pantalla de novedades.

- **nuevo** — Servidor local con Express y base de datos SQLite.
- **nuevo** — Migraciones numeradas: la base se actualiza sola al arrancar.
- **nuevo** — Respaldo automático de la base antes de cada actualización.
- **nuevo** — Usuarios y roles: operario, cajero, repartidor y admin.
- **nuevo** — Entrada con PIN de 4 a 6 dígitos y sesión persistente en el dispositivo.
- **nuevo** — Entrada con usuario y contraseña para el admin.
- **nuevo** — Pantalla de usuarios: alta, edición, cambio de PIN y baja (nadie se borra).
- **nuevo** — Bitácora: cada movimiento guarda quién lo ejecutó y quién lo capturó.
- **nuevo** — Pantalla "Qué hay de nuevo" con el historial de versiones.
- **clave** — Motor de fracciones en dieciseisavos, listo para el punto de venta.

**Lo que sigue:** v0.2 — Configurador de tanques, paños, canastas y moldes.
