# Historial de versiones

Este archivo es el espejo de `src/version.js`, que es lo que ve el usuario
dentro del sistema en la pantalla **Qué hay de nuevo**.

Tipos: `nuevo` (funcionalidad nueva) · `mejora` · `arreglo` · `clave` (regla de negocio importante)

**Cómo se numeran:** después de la v0.9 viene la **v1.0**, no la v0.10. El
segundo número va de 0 a 9 y luego sube el primero. El tercero (v1.4.1) es
solo para arreglos de algo que ya estaba, o para cambios de puro aspecto.

---

## v2.0.1 — La impresora de red · 26 de agosto de 2026

Sin migración. Un arreglo, pero de los que desbloquean.

### El problema

La térmica de la fábrica es de red: se llama `ch-e80print en 192.168.1.65`,
o sea que vive en su propia dirección. El sistema solo sabía un camino para
mandarle bytes:

```
copy /b ticket.bin \\localhost\TICKET
```

Eso obliga a **compartir** la impresora en Windows, a que el driver esté
puesto y a que el nombre compartido no lleve espacios. Tres cosas que pueden
fallar, y una impresora de red no necesita ninguna.

### La solución

Ahora el destino se lee y el sistema elige el camino solo:

| Lo que se escribe | Cómo se manda |
|---|---|
| `192.168.1.65` | socket al puerto 9100 |
| `192.168.1.65:9101` | socket a ese puerto |
| `\\localhost\TICKET` | `copy /b` (Windows) |
| `LPT1:` | `copy /b` (Windows) |
| `C:\tickets` | se guarda como archivo, para probar sin impresora |

El **9100 es RAW**: lo que entra por ahí se imprime tal cual. Es como hablan
todas las térmicas de red desde hace treinta años, y no hace falta driver,
ni compartir, ni siquiera que sea Windows.

Un nombre suelto (`tickets`) **no** se lee como una máquina de la red: eso
convertiría una carpeta mal escrita en una espera de ocho segundos por cada
ticket. Para usar un nombre de red hay que ponerle el puerto.

### Y que se pueda arreglar solo

- **Buscar las impresoras de esta PC** le pregunta a Windows
  (`Get-Printer`) y devuelve nombre, puerto y nombre compartido, con la
  sugerencia ya masticada: si el puerto trae una IP, esa IP.
- Debajo del campo, un renglón dice **por dónde va a salir el ticket**
  mientras se escribe. Ver qué entendió el programa es la mitad de poder
  arreglarlo.
- Los errores se traducen: *"no contesta, ¿está encendida?"*, *"está ahí
  pero no acepta nada en ese puerto, prueba el 9100"*, *"no se llega a esa
  dirección desde esta computadora"*.

### Lo que no cambia

Que una impresora apagada **no tumba una venta**. El socket lleva reloj —
ocho segundos— y `imprimirCrudo()` sigue sin lanzar nunca: devuelve
`{ impreso: false, motivo }` y la venta, que ya se cobró, sigue su camino.

---

## v2.0 — La caja de diario · 25 de agosto de 2026

Migración `017_mayoreo_rapido.sql`: `productos.mayoreo`, `clientes.numero`,
la tabla `mermas_hielo` y los dos productos de mayoreo del arranque.

### El mayoreo se teclea

La v1.9 resolvió el mayoreo bien pero por el camino largo: identificar al
cliente y *entonces* capturar. Tony contó cómo lo trabajaba antes:

> *"Creé un producto nuevo que llamé marquetas a mayoreo, solo eran dos:
> media marqueta (12m) y una marqueta (1m). Yo simplemente ponía 1m y se
> ponía el precio de mayoreo y listo."*

Eso es un toque. Buscar a alguien en una lista con el cliente enfrente son
diez. Así que la entrada ahora es el **código**:

- `1m` y `12m` son productos de hielo con la marca `mayoreo`. **No tienen
  precio propio**: su precio sale de una lista de mayoreo, la del cliente si
  tiene una, o la marcada como *normal*.
- Al apretar **F10** en un ticket con mayoreo, la caja pide de quién es
  **antes** de cobrar. Se teclea el **número** del cliente o su nombre y
  enter. Después, el cobro de siempre.
- **Un ticket con mayoreo no se cobra sin nombre**, y la regla vive en el
  servidor, no en la pantalla: es donde no se puede saltar.
- Salirse del cobro **suelta al cliente**. Lo pidió Tony así, y tiene razón:
  un cliente pegado al ticket es la forma de cobrarle a uno el precio del
  anterior.

Cada cliente nace con un **número** correlativo que no se reusa nunca, ni
aunque se dé de baja: el número es del cliente, como el folio es del ticket
(regla 3.3).

Y desapareció el **mínimo de mayoreo** de la v1.9. No hacía falta: el mínimo
lo dicen los botones que existen. Si solo hay marqueta y media marqueta, no
hay forma de pedir mayoreo por un cuarto. Un número configurable de más es
un número que un día se queda mal puesto.

**Un ticket puede llevar los dos precios.** *"Dame una a mayoreo y un cuarto
para la casa"* es un ticket con dos listas, y ahora cada línea se cotiza con
la suya.

### El historial hace lo que se le pide

- **Copia** de cualquier ticket, para quien pueda vender.
- **Cancelar** y **Eliminar** detrás de un `⋯`, y solo para el
  administrador. Un botón rojo en cada renglón es un botón rojo que un día
  se toca sin querer.
- **Eliminar solo si el turno sigue abierto.** En cuanto se corta, hay un
  papel firmado con ese número; borrarlo dejaría al papel diciendo una cosa
  y al sistema otra. Entonces se cancela, que deja el renglón tachado y las
  cuentas cuadrando. Pide la **contraseña** del administrador, no el PIN.
- Un ticket que es parte de un **cambio** no se borra suelto: dejaría al
  otro apuntando a un número que ya no existe.
- **Los cambios se ven de los dos lados**: `⇄ #5→#6` en los dos renglones.
  Cayendo en cualquiera se ve la historia completa sin buscar.
- **Búsqueda por número de ticket.**

### Un renglón es una línea

El historial, la lista de tickets de la caja y los gastos del cajón se
rehicieron con la misma regla: **una línea por renglón, columnas siempre en
el mismo sitio, todo centrado a media altura**. Lo que no cabe se corta con
puntos suspensivos y se ve completo al pasar el ratón.

Una tabla donde cada renglón mide distinto no se puede recorrer con la
vista, y recorrerla con la vista es exactamente para lo que sirve.

De la lista de tickets se quitó el botón **Ver**: cada renglón ya dice qué
se llevó el cliente, así que abrir un panel para leerlo era un paso de más.
El dinero que **entra** al cajón va en verde y el que sale en rojo.

### Lo que se derrite se anota

Hasta hoy el hielo derretido caía dentro del *faltante* a secas, mezclado
con el que se fue sin pagar. Son dos cosas muy distintas: una es física y no
tiene remedio, la otra es un problema que hay que atender.

Ahora hay un botón **Anotar merma** en Existencia —cuánto y por qué:
derretida, rota, regalada, autoconsumo— y el cuadre quedó completo:

```
    Había en el último conteo
  + Salió de los tanques
  = Debería haber
  − Se vendió al público
  − Se vendió a mayoreo
  − Derretidas, rotas o regaladas
  = Debería haber ahora
```

Público y mayoreo son dos negocios distintos dentro de la misma fábrica —el
mostrador de a cuarto y el que se lleva veinte marquetas—, y ver cuánto pesa
cada uno es la mitad de saber cómo va.

### Y dos arreglos

- Los **códigos de producto** ya no distinguen mayúsculas: teclear `1m` o
  `1M` es lo mismo. Nadie va a poner el bloqueo de mayúsculas con un cliente
  enfrente, y un código que a veces funciona es peor que no tenerlo.
- La **insignia del margen** se alinea a la derecha, como el resto de los
  números.
- **Productos y precios** ya no trae el cuadre completo del cuarto frío:
  queda el dato de cuánto debería haber, de cuándo es, y un botón para ir a
  Existencia, que es donde eso se trabaja.

---

## v1.9 — Mayoreo, papel y WhatsApp · 24 de agosto de 2026

Migración `016_mayoreo.sql`: una columna `lista_id` en `clientes` y el
ajuste `mayoreo_minimo_dieciseisavos` en `configuracion`. No toca nada de lo
que ya había.

### El mayoreo es una lista, no un descuento

La distinción la puso Tony: *"el precio de mayoreo 1 es de $240"*. No es
"a Don Carlos le bajas el 10%": es **la lista Mayoreo 1**, donde la marqueta
vale $240, y a ella se apuntan los clientes que la tienen. Subirle el precio
a la lista se lo sube a todos de una vez, que es como se maneja de verdad.

Y no es un porcentaje parejo. En la fábrica el 1/16 cuesta más de lo
proporcional porque cortar da trabajo, y ese trabajo no desaparece por
vender mucho (regla 7.2). Por eso el mayoreo es su propia lista, con su
precio por fracción, y no una regla de tres sobre la de público.

La tabla `listas_precios` ya traía `tipo IN ('publico','mayoreo')` desde la
v0.8. Esta versión no inventó el molde: lo usó.

### El flujo de Tony, tal cual

> *"Me dicen 5 marquetas, yo rápido lo capturo, le doy enter, y en la parte
> donde pongo con cuánto me pagan... el sistema detecta quién es y le da el
> precio que él tiene de mayoreo, enseguida cambia el precio en pantalla y
> yo sigo mi flujo normal."*

- **F6** (o el botón **Cliente**) abre la lista en cualquier momento.
- **"Es él"** le pone nombre al ticket y el precio cambia en el acto:
  el total, los botones de la rejilla, todo.
- **"Fiarle"** sigue siendo aparte: identificar no es fiar, y la mayoría de
  los mayoristas pagan en el momento.
- El renglón del cliente va **hasta arriba del ticket**, porque cambia los
  precios de abajo, y se pinta en verde cuando el mayoreo ya aplica.

### Desde media marqueta, y no antes

El mínimo se configura en **Productos y precios** (viene en 8 dieciseisavos)
y se mide sobre **todo el hielo del ticket**: quien pide un cuarto y un
cuarto está pidiendo media marqueta. Por debajo del mínimo se cobra público
aunque sea el mayorista, y la pantalla lo dice sin que haya que preguntar:
*"le falta 1/4 de hielo para su precio de Mayoreo 1"*.

Alcanzar el mínimo **no** convierte dos cuartos en un medio: cada fracción
se sigue cobrando a su precio, el de mayoreo. Dos cuartos son dos cortes.

### El precio lo decide el servidor

La pantalla calcula lo mismo para que el precio cambie al instante —esperar
medio segundo con el cliente enfrente es el peor momento para esperar—, pero
al cobrar el servidor lo vuelve a decidir desde cero. Mandar el `clienteId`
de un mayorista no alcanza para llevarse su precio, y el que se cobró queda
**copiado** en el ticket (regla 3.5): subirle el precio a la lista mañana no
toca los tickets de hoy.

Un cliente dado de baja pierde su precio de mayoreo junto con la baja. Una
lista dada de baja se cobra a público: cobrar con precios que ya nadie
mantiene sería peor.

### El corte, en dos columnas

> *"Los gastos suelen ser muchos y se va haciendo largo. Para ahorrar papel."*

Los movimientos del corte salen ahora en dos columnas —gastos de un lado,
entradas del otro—, cada una con su suma. Un día de gastos son quince
renglones y las entradas son dos; partido en dos cabe en la mitad. Si solo
hay de un tipo no se parte: media hoja en blanco al lado de tres renglones
no ahorra nada.

### El corte por WhatsApp

Un botón en el corte arma la **imagen del ticket** y abre el menú de
compartir del celular, donde WhatsApp sale arriba. En la computadora, que no
tiene ese menú, baja la imagen y abre WhatsApp Web con el resumen escrito.

La imagen se dibuja renglón por renglón en un canvas, sin ninguna librería:
el programa corre en la fábrica, sin internet y sin que nadie instale nada.
Y sale idéntica en todos los aparatos, con fondo blanco y letra grande, que
es lo que se lee en un WhatsApp.

---

## v1.8 — Historial, y borrar de verdad · 24 de agosto de 2026

Sin migración. Dos cosas que se tocan entre sí.

### Eliminar no es dar de baja

La diferencia la puso Tony y es del negocio, no del programa:

- Se da de **baja** lo de temporada, lo que va a volver. Sigue existiendo, deja de salir en la caja y se recupera cuando toca.
- Se **elimina** lo que nunca debió estar: el producto de prueba, el que se dio de alta dos veces, el que ya no se va a vender jamás.

- **clave** — **Solo se puede eliminar lo que NUNCA SE USÓ.** En cuanto algo se vendió, su nombre vive en tickets ya cobrados y en las cuentas del día; borrarlo dejaría el histórico mintiendo. El servidor lo comprueba (`vecesVendido`) y responde 409 con `sugerencia: 'baja'`, para que la pantalla no solo diga que no, sino qué hacer en su lugar.
- **clave** — **Borrar pide la CONTRASEÑA del administrador**, no un PIN. El PIN se teclea veinte veces al día delante de quien sea: sirve para decir "yo estoy aquí", no para respaldar algo que no se deshace. Vive en `comprobarAdmin()` en `lib/autorizacion.js`, junto al `comprobar()` de siempre.
- **nuevo** — `DELETE` de productos, categorías (solo vacías), clientes (solo sin movimientos) y movimientos del cajón.
- **clave** — Un movimiento de un turno **ya cortado** sí se puede borrar, porque los totales del corte están congelados y no cambian. Pero la lista que se reimprima ya no coincidirá con el papel firmado, y la pantalla lo dice **antes** de preguntar la contraseña.
- **clave** — Lo único que no se borra nunca es **la constancia de que alguien borró**: cada eliminación deja su renglón en la bitácora con quién autorizó y qué era.

### El Historial

`GET /historial`, solo con permiso `historial.ver` (hoy, solo el administrador).

- **nuevo** — Ventas, gastos, entradas y abonos en una sola lista, del más nuevo al más viejo. Es lo único que un cajero puede hacer con el dinero, así que es lo único que hay que poder revisar.
- **clave** — **Sale de las tablas de siempre, no de una copia.** No hay tabla `historial` que llenar: una copia se desincroniza el día que se cancele un ticket, y entonces el historial diría una cosa y la caja otra. Hay una prueba que cancela una venta y comprueba que el resumen baja solo.
- **clave** — Se agrupa por `capturista_id`, no por `cajero_id`: la pregunta es *"¿qué hizo esta persona?"*, y quien tecleó el ticket es quien lo hizo, aunque el turno fuera de otro (regla 3.6, el relevo de las 2:30).
- **nuevo** — Filtros por persona, por días, por horas y por tipo. `date()` y `time()` de SQLite, para poder preguntar "el jueves entre las 3 y las 8".
- **clave** — Una fecha que no se entiende se **rechaza**, no se ignora: ignorarla daría una lista que parece filtrada y no lo está, que es la forma más fácil de sacar una conclusión equivocada.
- **nuevo** — El resumen (cobrado, gastos, entradas, abonos) suma **todo lo que cae en el filtro**, no los 300 renglones que se enseñan. Si no, revisar un mes daría el total de la última página.

### No es la bitácora

La bitácora dice `venta.registrada` con un id y es para quien programa. El Historial dice *"Mari cobró el ticket #412 por $264 a las 3:15"* y es para Tony. Son dos preguntas distintas y por eso son dos pantallas distintas.

---

## v1.7 — La caja obedece · 24 de agosto de 2026

Sin migración. Todo esto sale de la primera prueba a fondo de Tony.

### Dos errores que costaban de verdad

- **arreglo** — **La lista de productos se aplastaba.** `.cfg-lista` era `display: grid`, y una rejilla REPARTE el alto entre sus renglones: con 26 productos cada uno bajaba a 25 px cuando su contenido mide 38, y se veía cada vez más apretada conforme se daban de alta más cosas. Ahora es columna flexible: cada renglón conserva su tamaño y lo que sobra se desplaza.
- **clave** — **El turno sin dueño se adoptaba solo al recargar la pantalla.** `/auth/yo` corre en cada arranque y llamaba a `abrirTurnoSiHaceFalta`, que adoptaba. Así que el cajero que acababa de entregar su turno a las 2:30 se lo volvía a quedar con solo refrescar el navegador, y el relevo entero no servía de nada. Ahora ABRIR un turno y ADOPTAR el que espera dueño son cosas distintas: lo segundo solo lo hace quien teclea su PIN.
- **arreglo** — El ticket fiado se imprimía con la palabra FIADO pero **sin el nombre del cliente**: `ventaCompleta()` en el módulo de impresión no unía la tabla de clientes. El nombre es lo que convierte ese papel en un vale.

### Vender

- **clave** — **La cantidad se toca y se escribe.** "Me das 50 marquetas" no puede ser tocar el botón cincuenta veces. Se toca el número del renglón y se teclea. Poner 0 lo quita del ticket, que es lo que la mano hace sola.
- **clave** — **Enter con el campo vacío repite lo último.** "Dame otro igual" es media venta del mostrador.
- **nuevo** — Al vaciar con Esc, otro **Enter acepta**: el diálogo enfoca su botón, así que quien viene tecleando sigue tecleando.
- **nuevo** — Aviso de **turno sin dueño dentro de la caja**, con botón **Tomar el turno**: el que entra pone su PIN ahí mismo y el turno y el dinero apartado quedan a su nombre.
- **mejora** — Los tickets que se buscan desde la caja son **solo los de hoy** (`?hoy=1`, con `date('now','localtime')` para que a las 6 de la tarde "hoy" no sea ya mañana). El histórico completo será su propio módulo.

### En toda la aplicación

- **nuevo** — **F1 lleva a Vender** desde cualquier pantalla. Se escucha en `app.js`, así que funciona también donde la vista no sabe nada del teclado. Con un diálogo abierto manda el diálogo.
- **mejora** — **El dinero, sin decimales cuando son cero**: `$264` en vez de `$264.00`. En la fábrica todo se cobra en pesos enteros y ese `.00` repetido en cada renglón del ticket son milímetros de papel al día. **Si un número sí trae centavos se enseñan completos**: redondear sería decirle al cliente algo que no es. Vale para la pantalla (`pesos()`), para el papel (`formato()`) y para los campos que se editan (`paraEditar()`).
- **nuevo** — **Clientes** ya aparece en la pantalla de inicio.

### Dónde vive cada cosa

- **mejora** — El **margen de ganancia** pasó de ser un cartel de tres renglones debajo del precio a una etiqueta chica junto a la foto. El porcentaje es lo que se mira de reojo; la lectura completa vive en el `title`.
- **mejora** — La **impresora de tickets** se mudó de Productos a **Sistema**, al lado de los respaldos. Es un aparato de esta computadora, no un producto, y en Productos nadie la buscaba.
- **importante** — Permiso nuevo `produccion.numeros`, que tienen cajero, gerente y administrador: **el cajero ya imprime los números que siguen en los tanques**. El obrero pregunta en el mostrador y ahí no siempre hay un gerente. Autorizar que se saque uno FUERA de orden sigue siendo del gerente.

---

## v1.6.1 — Sin teclas en el celular · 24 de agosto de 2026

Sin migración. Un arreglo de aspecto y una limpieza por dentro.

### En el teléfono no hay F10

La pantalla de venta enseñaba las teclas rápidas también en el celular:
`F2`, `F3`, `F4`, `F10`, `Enter` y el `Esc ·` de cada botón de volver. En un
teléfono ninguna de esas teclas existe, así que eran tres renglones y un
puñado de etiquetas ocupando sitio sin decir nada.

- **arreglo** — Todas se esconden por debajo de 620 px de ancho: el renglón de pistas de abajo, las etiquetas pegadas a los botones y el prefijo `Esc ·`, que ahora va en su propio `<span class="tecla-dice">` para poder ocultarlo. El reloj y el nombre del negocio se quedan.
- En PC y en tableta no cambia nada.

### Las pruebas, sin el copy-paste

Tony preguntó si 279 pruebas no eran demasiadas. Medido: **279 pruebas en 5.4
segundos**, cada archivo en su proceso y todos a la vez. Ni son muchas para
un sistema que maneja dinero, ni son lentas.

Lo que sí sobraba era el **arranque repetido**: dieciséis archivos con los
mismos treinta y cinco renglones para crear una carpeta temporal, migrar,
levantar el servidor y escribir `llamar()`. Ochocientas líneas que no
probaban nada y que había que corregir dieciséis veces.

- **mejora** — Nuevo `pruebas/ayudante.js`: `fabricaDePrueba('ventas')` devuelve `llamar`, `entrarAdmin`, `entrarPorNombre`, `bd` y demás, y se encarga de abrir y cerrar todo. **465 líneas menos en total**, con las mismas 279 pruebas.
- **clave** — Se descubrió en el camino que **los `test.before` de Node no se esperan entre sí**: dos hooks en el mismo archivo arrancan a la vez. Por eso el ayudante tiene UNO solo y lo que cada archivo necesita preparar se registra con `preparar()`. Si alguien lo intenta con un segundo `test.before`, `llamar()` falla con el motivo escrito en claro.
- **mejora** — El `llamar()` compartido ya no revienta con respuestas que no son JSON (un PNG, un ticket en bytes): devuelve `json: null` y las cabeceras.
- **mejora** — Auditadas las 279 una por una: **ninguna está obsoleta**. Se renombró una que mentía (`ventas.test.js` decía "un operario no entra a la caja" y lo que prueba es que no puede vender).

---

## v1.6 — Clientes y crédito · 24 de agosto de 2026

Migración `015_clientes.sql`.

### Lo que Tony no había definido, y cómo se resolvió

De crédito solo había una regla firme: *se le fía a los clientes que
previamente registramos, no al público en general*. Faltaban límite,
autorización, plazo y cobranza.

En vez de inventarle una política a la fábrica, **se construyó la cuenta y
se dejó la política configurable**. La cuenta —quién debe, de qué tickets y
qué ha abonado— es la misma con cualquier política; lo de arriba se ajusta
sin tocar el código. Está anotado en `docs/REGLAS-DEL-NEGOCIO.md`.

| Punto | Cómo quedó |
|---|---|
| Límite | Campo por cliente. Vacío = sin límite |
| Pasarse | No bloquea: pide PIN de gerente y guarda quién y por qué |
| Plazo | Días por cliente, solo para marcar lo vencido |
| Cobranza | Abonos a la cuenta, en efectivo o transferencia |

### El saldo no se guarda (regla 3.2)

```
    lo que se llevó fiado  −  lo que ha abonado  =  DEBE
```

- **clave** — No hay columna de saldo. Hay una prueba que revisa el esquema y falla si alguien la agrega: un número guardado se desincroniza el día que se cancele un ticket viejo o se anule un abono, y ese día el papel del cliente y la pantalla de la fábrica dejan de decir lo mismo.
- **clave** — Los abonos **no se aplican a un ticket concreto**. El cliente llega y deja $500 a cuenta, no dice "esto es del ticket 412"; amarrarlo obligaría al cajero a decidir algo que el cliente no dijo. Lo vencido se resuelve por antigüedad: lo abonado tapa primero lo más viejo.
- **nuevo** — Cancelar un ticket fiado o anular un abono **corrige la cuenta solo**, sin tocar nada más.

### Fiar desde la caja

- **nuevo** — Botón **Fiar a un cliente** en la pantalla de cobro. Abre la lista de los registrados: no hay forma de escribir un nombre a mano.
- **clave** — Antes de confirmar se enseña **lo que va a deber después de este ticket**: `debía + este ticket = va a deber`, con su límite al lado. Ese es el número por el que se decide, y hacerlo de cabeza con gente enfrente es como se cometen los errores caros.
- **clave** — Pasarse del límite responde **403 con `requiereAutorizacion`**, no un rechazo. La pantalla pide el PIN y el motivo; el motivo se guarda en las notas del ticket, porque "lo autorizó Lupe" sin el porqué no explica nada al mes.
- **nuevo** — El ticket sale marcado **FIADO**, con el nombre del cliente y línea para firmar: ese papel es el vale.
- **arreglo** — `formaPago` ahora se valida contra una lista cerrada. Antes se guardaba cualquier cosa que mandara la pantalla, y como el arqueo solo cuenta `'efectivo'`, una forma de pago inventada sacaba una venta del corte sin que nadie lo notara.

### El dinero, en el sitio correcto

- **clave** — Una venta fiada **no entra al arqueo del cajón**: ese dinero nunca pasó por ahí y contarlo haría que la caja faltara todos los días.
- **clave** — Un abono **en efectivo sí entra**, con su renglón en el cajón. Anularlo se lo quita también, o el corte quedaría con un ingreso que ya no existe.
- **mejora** — El corte separa ahora **lo fiado** (dinero en la calle) de **lo cobrado por transferencia** (ya cobrado, solo entró por otro lado). Antes los dos decían "otros medios".

### Un error que ya iba tres veces

- **arreglo** — Limpiar un importe tecleado quitándole todo lo que no fuera dígito convertía `"mucho"` en `0` y `"-500"` en `500`. Un cero que nadie escribió apaga límites y avisos sin que nadie se entere. Ahora hay un solo lector de importes, `leerPesos()` en `lib/dinero.js`, que acepta lo que de verdad se teclea (`1,200.50`, `$45`, ` 80 `) y rechaza lo demás.

---

## v1.5 — La caja avisa y la pantalla rinde · 24 de agosto de 2026

Migración `014_avisos.sql`.

### Dos avisos que se parecen y se comportan al revés

Esta es la parte que hay que entender antes de tocar nada aquí.

De un refresco el sistema sabe exactamente cuántos hay: entraron 24, se
vendieron 20, quedan 4. Si dice cero, es cero, y venderlo solo genera un
problema en el mostrador. **Se bloquea.**

Del hielo no lo sabe. Los obreros sacan hielo toda la mañana y reportan lo
que sacaron **hasta como las 3 de la tarde**, porque están atendiendo y
sacando al mismo tiempo. Así que el número del sistema es *lo que se ha
capturado*, no *lo que hay*: a media mañana el cuarto frío puede estar lleno
y el sistema marcar cero. **Avisa y jamás bloquea.** Parar la venta de hielo
por un dato que todavía no llega sería parar la fábrica.

- **clave** — `alcanza(producto, cantidad)` en `src/modulos/catalogo/avisos.js` es el único punto donde se decide si algo se puede vender. Devuelve `null` si sí, o el motivo si no. Lo que no lleva inventario y el hielo pasan siempre.
- **clave** — `prepararLineas()` lo llama y devuelve **409** con el motivo en claro: *"Ya no hay Sprite 600. Se acabó."* / *"Solo quedan 4 de Coca Cola 600."*
- **nuevo** — `GET /inventario/avisos` trae lo que la caja necesita de un vistazo: los productos bajos, cuántos están agotados, cuántas piezas quedan de cada cosa (para negarse sin ir al servidor) y cómo va el hielo.
- **nuevo** — `PUT /inventario/hielo-minimo` guarda con cuántas marquetas avisa. Lo pone quien administra productos: es la misma decisión que el *"avisar cuando baje de"* de cada refresco.
- **arreglo** — Ese mínimo ya no se limpia a la brava. Antes `"muchas"` se convertía en `0` —o sea, apagaba el aviso sin que nadie lo pidiera— y un `−3` se leía como `3`.

### Lo que ve el cajero

- **nuevo** — Un triángulo con **bolita y número** arriba a la derecha. Tres productos bajos, un `3`. Al tocarlo, la lista completa: cuántos quedan de cada uno, y en rojo lo que ya se acabó.
- **nuevo** — El botón de lo agotado se ve **apagado y no responde**, con la palabra *se acabó*. Es más claro que dejar tocarlo y contestar con un aviso cada vez. Lo que está bajo del mínimo dice *quedan 4* en su esquina.
- **nuevo** — Símbolo 🧊 propio para el hielo, con su explicación de dónde sale el número y cuándo fue la última producción capturada.

### Más pantalla para vender

La franja azul de arriba costaba cien píxeles de alto en la pantalla que más
se usa en la fábrica. Se quita solo en la caja (`sinBarra` en la ruta) y lo
que traía se reparte donde ya había hueco.

- **mejora** — El reloj, la fecha y el nombre del negocio bajaron al renglón de las teclas, que estaba medio vacío.
- **mejora** — El menú y quién está en la caja se metieron en la fila de *Nueva venta*. El botón del menú es el de siempre: se le presta el clic.
- **nuevo** — Atajos discretos: existencia del cuarto frío, los números que siguen en los tanques, los gastos del cajón y terminar el turno. Cada uno aparece solo si el permiso lo permite. Si había un ticket a medias, **se aparta solo** antes de salir.
- **mejora** — En el celular, los tres botones grandes se reparten un renglón y los atajos bajan al siguiente; las teclas de función se esconden, porque en un teléfono no hay F2.

### Historiales

- **nuevo** — En **Tickets**, un botón **Ver** que abre lo que traía el ticket bajo su renglón. Antes había que imprimir una copia para contestar *"¿qué se llevó?"*: gastar papel para leer.
- **nuevo** — `GET /caja/movimientos` cruza turnos. El de la pantalla de Caja solo trae el turno de ahora, y a media tarde el turno de la mañana ya se cerró.
- **clave** — La lista se parte con una raya: *"de aquí para abajo, turno #3 de Mari (cerrado)"*. Sin eso, ver un gasto de otro turno mezclado con los de este es peor que no verlo.
- **mejora** — Los gastos van en rojo y con su copia del comprobante. **Meter dinero se ve más discreto**: nadie pide cuentas de lo que se dejó.

---

## v1.4 — Editar sin formularios · 23 de agosto de 2026

Migración `013_categoria_foto.sql`.

### El bug: lo dado de baja no se podía recuperar

Tony dio de baja unos pedazos de hielo y se quedó sin ellos. La regla del
sistema es que **nada se borra**, pero eso no sirve de nada si el usuario no
puede traerlo de vuelta: para él, estaba borrado.

- **arreglo** — `POST /catalogo/productos/:id/alta` y su equivalente para categorías. En la pantalla, un botón **Ver dados de baja** los muestra en gris y desde ahí se recuperan.
- **clave** — Recuperar un producto **revive su categoría** si se fue con él: si no, volvería a una carpeta que ya no existe.
- **clave** — Si su código lo tomó otro mientras estaba de baja, **vuelve sin código** en vez de fallar. Recuperar el producto importa más que conservarle el código, y el código se vuelve a poner en dos segundos.

### Editar en el sitio

- **clave** — Se toca el nombre, el precio o el costo y se escribe encima; al salir del campo queda guardado. Un formulario por pasos está bien para dar de alta algo nuevo; para corregir un precio es un estorbo, y corregir precios es lo que se hace todos los días.
- **nuevo** — El campo parpadea en verde al guardar: sin eso, editar en el sitio se siente como que no pasó nada.
- **nuevo** — El valor vuelve **normalizado**: quien escribe `30` ve `30.00`, que es lo que de verdad quedó.
- **nuevo** — Al crear un producto **ya no se pregunta si es hielo**: lo dice la categoría en la que estás. Preguntarlo era pedirle al usuario que repitiera algo que el sistema ya sabía.

### Cuánto le ganas

- **nuevo** — Porcentaje sobre el costo, pesos por pieza, y porcentaje sobre lo que cobras, con una lectura corta: *"Buen margen. De estos conviene vender más."* Un producto barato con buen margen es el que conviene empujar, y eso no se ve mirando solo la diferencia en pesos.

### El hielo, como los demás

- **nuevo** — Sus pedazos aparecen como productos, con foto y código, y se editan igual. Su "inventario" es la **Existencia del cuarto frío**, que se muestra ahí mismo con un enlace a la pantalla completa.

### Categorías

- **nuevo** — Menú de **tres puntos** en la propia lista, en vez de tener que abrir la categoría para ver sus opciones.
- **nuevo** — Imagen propia y **selector de color de verdad** (`input type=color`), no un campo donde escribir `#29abe2`.

### Permisos

- **clave** — Dar de baja algo **con mercancía** avisa cuántas piezas quedan y pide el PIN de un responsable. Son piezas físicas que nadie va a volver a contar: eso es dinero que se pierde de vista.
- **clave** — El **cajero** entra al inventario con vista limitada: ve cuántas hay e imprime la hoja para contar. Los costos **no salen del servidor**, no solo se esconden en la pantalla: esconderlos en el navegador no sirve de nada, los datos igual viajan.
- **nuevo** — Permisos nuevos: `inventario.ver` (cajero), `inventario.mover`, `costos.ver` y `productos.administrar` (gerente y admin).
- **mejora** — `src/lib/autorizacion.js`: el comprobador de PIN salió de producción a una librería, para que el catálogo pudiera usarlo sin duplicarlo.

### Numeración

- **clave** — Después de la v0.9 viene la **v1.0**, no la v0.10. Se renumeran las cuatro versiones anteriores (v0.10→v1.0, v0.11→v1.1, v0.12→v1.2, v0.13→v1.3): una lista que fuera 0.9 → 0.10 → 1.4 sería confusa para siempre.

---

## v1.3 — Productos con foto, costo e inventario · 23 de agosto de 2026

Migración `012_inventario.sql`.

### La pantalla

- **clave** — Rehecha para la PC, que es donde se usa: **tres columnas a lo ancho y sin desplazar la página**. Categorías, productos y el detalle de lo que se está editando. Solo se mueven las listas.
- **clave** — **El hielo va aparte**, arriba del todo. No es un producto más: es el 80% del negocio, sus precios se forman de otra manera y su inventario es la Existencia del cuarto frío. En la misma lista que los refrescos quedaría escondido.
- **arreglo** — Las columnas usan flexbox, no rejilla de filas fijas: cada una tiene distinto número de piezas y con filas fijas alguna se estiraba y dejaba un hueco en medio.
- **arreglo** — Los renglones de lista heredaban el `justify-content: center` del botón normal y salían centrados; una lista se lee de izquierda a derecha.

### Fotos

- **nuevo** — Cada producto puede llevar foto. No es adorno: con foto el cajero **reconoce** el botón en vez de leerlo.
- **clave** — Viven en `datos/fotos`, no dentro del programa: al actualizar se reemplazan los archivos del programa y ahí se perderían.
- **clave** — Se acepta PNG, JPG y WEBP, y **se comprueba la firma del archivo**, no lo que diga el navegador. SVG no: es texto que puede traer código dentro, y una foto de producto no tiene por qué serlo.
- **clave** — El nombre del archivo lleva la hora, así que se puede cachear para siempre y aun así cambiar la foto sin que el navegador enseñe la vieja.
- **arreglo** — El lector de datos general acepta 1 MB y una foto no cabe. El módulo del catálogo lleva el suyo, de 4 MB, **montado antes** del general: si el general corriera primero, ya habría rechazado la foto.

### Inventario de lo que no es hielo

    había + entró − se vendió − otras salidas = debería haber
    debería haber − contado = FALTA

- **clave** — La misma cuenta que la existencia del cuarto frío, a propósito, pero **a otro ritmo**: el hielo se cuenta dos veces al día porque se derrite; un refresco se cuenta cuando toca, y lo que se quiere saber de él es qué hay que pedir. Por eso vive en Productos y no en Existencia.
- **clave** — No hay columna con "cuántos hay": se **calcula de los movimientos** (regla 3.2). Un número guardado se desincroniza el día que algo se corte a la mitad.
- **clave** — `venta_lineas` guarda ahora **cuántas piezas**. Hasta hoy no hacía falta —al hielo lo cuentan los dieciseisavos— pero sin eso, "2 × Coca" habría descontado un solo refresco.
- **nuevo** — Entradas con su costo, salidas con su motivo, y conteos que fijan el nuevo punto de partida.
- **clave** — El costo se **copia en el movimiento** (regla 3.5): si mañana sube el proveedor, lo que costó la compra de ayer no cambia.
- **nuevo** — Mínimo por producto y aviso de "ya hay que pedir", con la cuenta arriba.
- **nuevo** — **Hoja para contar** imprimible, con su renglón en blanco.
- **nuevo** — Costo y **ganancia por pieza** a la vista en el producto.
- **arreglo** — `leerPiezas` limpiaba el texto quitando lo que no fueran dígitos, así que `-5` se convertía en una entrada de 5 piezas que nadie pidió. Ahora lo que no sea un entero se rechaza.

---

## v1.2 — Dos clientes a la vez y cambios de ticket · 23 de agosto de 2026

Migración `011_cambios.sql`.

### Ventas en espera

Llega un cliente, pide 1/8 y se queda pensando. Detrás llega uno de siempre
que ya sabe lo que quiere.

- **nuevo** — **F2** aparta el ticket a medias y deja la pantalla lista. Al terminar la venta siguiente, **el pendiente vuelve solo**: eso es lo que pidió Tony, no una lista que haya que ir a buscar.
- **nuevo** — Se pueden tener varias. La etiqueta de arriba dice cuántas, y F2 con alguna apartada abre la lista para elegir.
- **nuevo** — Viven en el navegador (`localStorage`): son minutos, no días, pero un refresco de pantalla no debe borrar lo que un cliente ya pidió.
- **clave** — Retomar una venta con otra en pantalla **aparta la de ahora primero**: no hay forma de perder un ticket por retomar otro.

### Cambios de ticket

- **clave** — Un cambio se registra como **cancelar el viejo + hacer uno nuevo**, amarrados en las dos direcciones. No es pereza: son dos hechos que el sistema ya sabía registrar, y al hacerlo así el hielo vuelve solo al cuarto frío (`vendidoDesde` ignora las canceladas) y la caja cuadra sola. Un tipo de venta aparte habría necesitado su propia aritmética en tres módulos, y esa aritmética se desincroniza.
- **clave** — **La caja del mismo turno cuadra sin hacer nada:** cancelar el viejo le quita su importe a lo cobrado y el nuevo suma el suyo, así que lo esperado se mueve exactamente en la diferencia. Hay prueba.
- **clave** — Si el ticket es de un **turno cerrado**, ese dinero entró otro día. Se anota una salida por el importe del ticket viejo: es lo que el cliente pagó con papel en vez de con billetes. Sin eso, el arqueo de hoy saldría corto por el importe del ticket. Hay prueba.
- **nuevo** — En pantalla, el ticket devuelto aparece como una línea de saldo a favor y abajo dice **A cobrar** o **A devolver**.
- **nuevo** — Guardas: no se cambia dos veces, no se cambia uno cancelado, y si el pago no alcanza la diferencia no se cancela nada a medias.

### Arreglos

- **clave** — `bd.transaction` ahora **se puede anidar**. Un cambio de ticket usa por dentro la creación de venta, que ya traía su propia transacción, y SQLite no admite un `BEGIN` dentro de otro. Se lleva la cuenta de la profundidad: solo la de más afuera abre y cierra. Si algo revienta en el paso 3 se deshace también el paso 1, que es justo lo que se quiere.
- **arreglo** — El campo del código hacía `stopPropagation` del enter siempre, así que durante el cobro el enter que confirma nunca llegaba al manejador. Solo se notaba cuando no había que cobrar nada (un cambio con devolución), porque en los demás casos el foco estaba en el campo del pago.
- **arreglo** — La fila de botones nueva entró como columna de la rejilla y partió la pantalla en dos.

---

## v1.1 — Impresión de verdad y relevo de turno · 23 de agosto de 2026

### La impresora

Tony preguntó por qué el ticket no sale instantáneo como en Aronium. La
respuesta es que **una página web no puede hablarle a la impresora**: cuando
el navegador imprime, arma una hoja y la manda a su motor de impresión. Con
`--kiosk-printing` se quita el diálogo, pero la vista previa se asoma un
instante igual. Aronium no es una página: es un programa que le manda bytes
crudos a la térmica.

- **clave** — `src/modulos/impresion/`: el ticket se arma en **ESC/POS** (el idioma de las impresoras térmicas) y lo manda **el servidor**, no el navegador. Sale al instante porque no hay nada en medio.
- **clave** — El destino es el nombre compartido de la impresora en Windows (`\\localhost\TICKET`) y se le escribe con `copy /b`. Compartir la impresora no es para que la usen otras PC: es para que Windows le dé un nombre al que se puede escribir directo.
- **nuevo** — Pantalla de configuración con ancho de papel (58/80 mm), copias, renglón al pie y **botón de prueba**, con las instrucciones de Windows dentro.
- **clave** — Si no hay impresora configurada **no se rompe nada**: se cae al camino de antes (el navegador). Una impresora apagada no puede tumbar una venta ya cobrada.
- **nuevo** — Las pruebas apuntan el destino a un **archivo** y comprueban los bytes que salieron: es la única forma de verificar esto sin papel. 17 pruebas sobre columnas, acentos, corte, copias y permisos.

### El flujo de cobro

- **clave** — **Ya no se imprime solo al cobrar.** Enter cobra; otro enter imprime si hace falta. No todos los tickets se entregan, y cada uno que sale sin que nadie lo pida es papel tirado.
- **nuevo** — **F3** abre los tickets del día: se busca por número, importe u hora, y se saca una **COPIA** (marcada como tal, para que no se confunda con el original). Queda anotada en la bitácora.

### El relevo de turno

El problema real: la existencia se entrega ~2:30 y el cajero que sigue llega
a las 3. En ese rato el que está sigue cobrando, pero ese dinero ya es del
que viene. En el software viejo se seguía cobrando con el usuario del que se
iba, y las ventas de la noche salían a nombre equivocado.

- **clave** — Al terminar, el sistema pregunta **¿ya llegó quien sigue?**
  - **Sí** → corte y **cierre de sesión**. El que entra pone su PIN y ese PIN abre su turno.
  - **No** → `POST /caja/entregar`: se cuenta el dinero del que se va y queda abierto un turno **sin dueño** (`cajero_id NULL`). La venta no se para.
- **clave** — Cuando el que llega pone su PIN, `abrirTurnoSiHaceFalta` **adopta** ese turno en vez de abrir otro. El dinero apartado ya es suyo.
- **clave** — Cada venta guarda `capturista_id` (quién la tecleó) y el turno guarda `cajero_id` (de quién es el dinero). Eso es exactamente la regla 3.6, y es lo que hace que el histórico deje de mentir. Hay prueba.

### Arreglos

- **arreglo** — Los campos de dinero dejaban escribir letras. Nuevo `pedirImporte()`: solo números y un punto, filtrado al teclear, y **enter acepta**.
- **arreglo** — En los campos cortos, enter metía un salto de línea en vez de aceptar. `pedirTexto` ahora usa un campo de un renglón cuando el texto es corto.
- **arreglo** — Los cajeros veían «Configurar tanques» en el menú. La ruta pide `tanques.configurar` (solo admin). Siguen registrando producción y existencia, con su nombre en la bitácora.
- **nuevo** — Un gasto imprime comprobante con las dos firmas (quién lo tomó, quién lo anotó). Meter dinero no: nadie firma por dejar dinero.

---

## v1.0 — La caja de verdad · 23 de agosto de 2026

Migración `010_productos.sql`. Rediseño del punto de venta a partir de cómo
se trabaja de verdad con gente esperando, tomando como referencia el POS
táctil que ya se usa en la fábrica.

### El flujo

- **clave** — La venta es la **pantalla de arranque** para quien cobra. Es la que se usa el 90% del día; un menú de iconos en medio es un toque de más, cientos de veces al día.
- **clave** — El turno de caja lo **abre el PIN**. Nadie va a una pantalla aparte a "abrir la caja": se llega, se pone el PIN y se cobra. El turno arranca en cero y el fondo se agrega como el movimiento que es. Si ya hay uno abierto, se sigue en ese: dos turnos harían que ninguna venta supiera a cuál pertenece.
- **clave** — **Nada se desplaza.** `body.pantalla-fija` fija el alto exacto; solo la rejilla de productos tiene scroll. Buscar un botón que se fue hacia abajo cuesta segundos que no hay.

### El teclado

- **clave** — Cada producto tiene **código**. Se teclea `18`, enter, y el octavo está en el ticket. Los del hielo vienen puestos: `1`, `12`, `14`, `18`, `116`.
- **clave** — Cadena de enter: **F10** cobra → teclear el pago y **Enter** calcula el cambio → **Enter** cobra y registra → **Enter** imprime, y cada enter más imprime otra copia → **Esc** deja listo el siguiente ticket. Enter con el campo vacío = pagó justo, así se cobra con dos teclas.
- **nuevo** — Un renglón al pie dice **qué hace enter en ese momento**. Es lo que hace que el teclado se aprenda sin manual.
- **arreglo** — La fase `guardando` no estaba en la tabla de pistas y `pintarPista()` reventaba justo al registrar la venta, cortando la cadena de enter.

### El catálogo

- **clave** — Categorías y productos son **datos**, no código: se dan de alta en Productos y precios. Dos clases: `hielo` (entrega una fracción, y el precio sale de la lista por fracción) y `simple` (refresco, garrafón, botella: precio propio, no descuenta del cuarto frío).
- **clave** — Un producto de hielo **no guarda precio**. Si lo guardara, un día el producto y la lista dirían cosas distintas y nadie sabría cuál manda. La base lo impide con un `CHECK`.
- **clave** — **El hielo es una sola línea que se suma.** Tocar 1/8 tres veces son 3/8 = $106, no tres renglones de $36 = $108. Si fueran renglones sueltos, el ticket diría "3/8" y cobraría otra cosa, y el cliente que sepa sumar tendría razón. Hay prueba.
- **nuevo** — Bajas, no borrados: un producto dado de baja desaparece de la caja pero los tickets viejos siguen diciendo lo mismo. Dar de baja una categoría se lleva sus productos, y avisa cuántos son.
- **nuevo** — Códigos únicos entre productos activos; uno liberado por una baja se puede reutilizar.

### El ticket y la impresora

- **clave** — Ticket rehecho: número pequeño, fecha/hora/cajero en un renglón, **la cantidad en grande y centrada**, el desglose chico debajo solo si dice algo distinto, el total en grande. Fuera el "gracias por su compra". Con cientos de tickets al día, cada renglón de más son metros de papel al mes.
- **clave** — Sale **solo el ticket**: vive en `#area-impresion`, fuera de la pantalla, y al imprimir se esconde todo lo demás. Antes salía la página entera.
- **clave** — Sin el cuadro de "elegir impresora": en Windows, `INICIAR.bat` abre Chrome o Edge con `--app` y `--kiosk-printing`, en un perfil aparte. El perfil aparte no es capricho: con el perfil normal ya abierto, la ventana nueva se pega a esa copia y la impresión directa no se aplica.

### Lo demás

- **nuevo** — Meter dinero y anotar gastos desde la propia pantalla de venta. Verde entra, rojo sale.
- **nuevo** — Los precios se editan en **Productos y precios**, junto al catálogo, y solo el administrador. Salieron del punto de venta.
- **arreglo** — `ARCHIVO_BD` y la carpeta del navegador cuelgan de `CARPETA_DATOS`.
- **arreglo** — La tachita se estiraba a óvalo dentro de un renglón: el `min-height` de 52 px de los botones (para poder tocarlos con el dedo) le ganaba a su `height`.
- **nuevo** — `docs/REGLAS-DEL-NEGOCIO.md`: cómo trabaja de verdad la fábrica (crédito, reparto, neveras en comodato, garrafones, mantenimiento). Se escribe antes de programar, porque en la v0.3 se programó sobre suposiciones y hubo que tirar el módulo entero.

---

## v0.9.1 — Manual de ayuda · 23 de agosto de 2026

El manual vive **dentro** del sistema (`#/ayuda`), no en un PDF aparte que
nadie abre. Escrito para el cajero y el gerente, no para un programador.

- **nuevo** — Nueve temas plegados: entrar, producción, existencia, punto de venta, caja, quién puede qué, respaldos, actualizar y qué hacer si algo no funciona.
- **nuevo** — Buscador que filtra sin volver a dibujar la pantalla (un tema abierto se queda abierto) y abre solos los temas que coinciden.
- **clave** — La tabla de permisos **no está escrita a mano**: `GET /api/ayuda/permisos` la arma leyendo `src/lib/roles.js`. El día que se agregue un rol o se mueva un permiso, el manual se corrige solo. Hay una prueba que compara la tabla contra `puede(rol, permiso)` para cada rol y cada acción: un manual que miente es peor que no tener manual.
- **nuevo** — La prueba también falla si una acción descrita no la puede hacer nadie: o sobra en el manual, o falta el permiso.
- **nuevo** — Visible para todos los roles. No hace falta ser administrador para leer cómo se usa el sistema.

---

## v0.9 — La Caja · 23 de agosto de 2026

Migración `009_caja.sql`.

El espejo en dinero del cuadre del cuarto frío. La cuenta tiene la misma
forma a propósito: quien ya entendió una pantalla entiende la otra.

    fondo + cobrado en efectivo + entradas − salidas = DEBERÍA HABER
    debería haber − contado = DIFERENCIA

### El turno

- **clave** — No hay ninguna columna `saldo` que se vaya sumando. Lo que hay en el cajón se **calcula de los movimientos** cada vez que se pregunta (regla 3.2). Un saldo guardado se desincroniza el día que algo se corte a la mitad; una suma de movimientos, no puede.
- **clave** — Solo puede haber **un turno abierto**. Con dos, ninguna venta sabría a cuál pertenece y los dos cortes saldrían mal. `POST /api/caja/abrir` devuelve 409 si ya hay uno.
- **clave** — Las ventas se amarran solas al turno abierto (`ventas.caja_id`). No se copian importes a la caja: se leen de la tabla de ventas, que es donde viven. Una sola verdad.
- **clave** — Se puede cobrar **sin** turno abierto. La fábrica no se para porque alguien olvidó abrir la caja. Pero ese dinero queda con `caja_id = NULL`, fuera de todo corte, y la pantalla de venta lo avisa en amarillo.
- **clave** — Solo el **efectivo** entra al arqueo. Lo cobrado por otros medios se informa aparte: si se contara, la caja "sobraría" todos los días.
- **clave** — Un corte cerrado guarda sus números **congelados** (`esperado_centavos`, `vendido_centavos`, `entradas_centavos`, `salidas_centavos`, `diferencia_centavos`). Cancelar mañana una venta de hoy no cambia un corte firmado. Hay prueba.
- **nuevo** — Folio de turno consecutivo, asignado dentro de la transacción, igual que los tickets.
- **nuevo** — Gastos, retiros y entradas de dinero, con doble responsable (quién se lo llevó, quién lo anotó — regla 3.6).
- **nuevo** — Anular un movimiento mal capturado: se marca, no se borra (regla 3.4). Y no se puede tocar un movimiento de un turno ya cerrado.
- **nuevo** — Corte imprimible de 80 mm con el desglose, los movimientos y la firma.
- **nuevo** — Historial de cortes con lo que sobró o faltó en cada turno.
- **nuevo** — Permisos: `caja.operar` (cajero y gerente) abre, mueve dinero y cierra; anular un movimiento pide `venta.cancelar` (gerente y admin).

### Detalles

- **mejora** — `soloHora()` y `rango()` en `util.js`: un turno del mismo día se lee "23 ago 2026, de 02:23 a 08:10 p.m." en vez de repetir la fecha dos veces.
- **arreglo** — La tachita se estiraba a pastilla dentro de una celda de tabla; ahora se mantiene circular.

---

## v0.8 — Punto de venta · 23 de agosto de 2026

Migraciones `007_ventas.sql` y `008_cuadre_ventas.sql`.

Se cerró el círculo: hasta la v0.7 el sistema sabía cuánto salió del cuarto
frío, pero no cuánto de eso se había cobrado. Ahora sí.

    salidas − vendido = FALTANTE

### El cobro

- **clave** — Precio por fracción, no proporcional (sección 7.2). El precio de una cantidad es la suma de los precios de los pedazos en que se parte: `descomponer(6) = [4, 2]`, o sea 3/8 = 1/4 + 1/8 = $70 + $36 = **$106**. Como la partición es siempre la misma, tocar seis veces 1/16 cuesta exactamente igual que tocar 1/4 y 1/8. Hay prueba.
- **clave** — El total lo calcula el **servidor**, que vuelve a cotizar cada línea con sus propios precios. Lo que mande la pantalla como importe se ignora. Hay prueba que manda `total_centavos: 1` y recibe $264.
- **clave** — El dinero se guarda en **centavos enteros** (`src/lib/dinero.js`), por la misma razón que el hielo en dieciseisavos: los decimales acumulan errores que después no cuadran en el corte.
- **clave** — El precio queda **copiado** dentro de la línea (regla 3.5). Subir precios hoy no cambia un ticket de ayer. Hay prueba.
- **clave** — Folio consecutivo asignado **dentro de la transacción** (regla 7.3), para que dos cajas cobrando al mismo tiempo no puedan sacar el mismo número. Hay prueba con 8 ventas en paralelo.
- **clave** — Una venta cobrada **no se edita** (regla 7.4): se cancela, y la cancelación guarda motivo, fecha y responsable. Ni la venta ni sus líneas se borran nunca.
- **nuevo** — Pantalla de venta: teclado de fracciones, precio en vivo, líneas con su desglose, botones de billete y el cambio en grande.
- **nuevo** — Ticket de 80 mm con folio, desglose por línea, pago, cambio y quién atendió.
- **nuevo** — Buscador de tickets por folio, importe u hora.
- **nuevo** — Pantalla de precios (solo administrador), con el proporcional como **sugerencia**, nunca como valor impuesto.
- **nuevo** — Permisos: `venta.registrar` (cajero), `venta.cancelar` (gerente y admin), `precios.configurar` (solo admin, vía comodín).

### El conteo con fracciones

- **clave** — `POST /api/existencia/conteos` acepta `dieciseisavos`. Así se captura "quedan 14 marquetas y 5/8" tal cual se dicta en la fábrica. Sigue aceptando `marquetas` enteras por compatibilidad.
- **nuevo** — `public/js/fracciones.js`: el mismo motor de fracciones del servidor, del lado del navegador, más el **teclado** que se reutiliza en el conteo y en la caja. Un solo control, aprendido una sola vez.
- **nuevo** — `deTexto()` entiende `14`, `5/8`, `14 5/8` y `14 y 5/8`, y **rechaza** denominadores que no existen físicamente (`1/3`): la marqueta no se parte en tercios.
- **nuevo** — Diálogo `pedirCantidad()`: los botones y el campo escrito están sincronizados en los dos sentidos.

### El cuadre partido en dos

- **clave** — `vendidoDesde()` suma las líneas de las ventas **no canceladas** de la ventana. Cancelar una venta devuelve el hielo al cuarto frío sin tocar nada más. Hay prueba.
- **clave** — El conteo guarda `vendido` congelado (columna nueva), igual que los demás números: cancelar una venta vieja no mueve un corte ya firmado.
- **nuevo** — La tarjeta del cuarto frío y el ticket de conteo muestran `vendido` y `falta` por separado.

### Arreglos

- **arreglo** — `#buscar` tenía asignada la función directamente (`onclick = buscarTickets`), así que el navegador le pasaba el evento del clic como texto de búsqueda y la lista salía siempre vacía.
- **arreglo** — La tachita de quitar una línea es `position: absolute` (viene de las imágenes) y se escapaba a la esquina de la pantalla. Dentro del ticket va estática, en su celda.
- **arreglo** — `ARCHIVO_BD` se calculaba siempre desde la raíz del proyecto: mover `CARPETA_DATOS` movía los respaldos y el logo, pero dejaba la base atrás.
- **arreglo** — Pasar `undefined` a un `WHERE id = ?` revienta en `node:sqlite` (a diferencia de otros motores). Ahora se pasa `null`.
- **mejora** — `desglose()` junta los repetidos: 14 5/8 se escribe `14×1 + 1/2 + 1/8` en vez de catorce unos seguidos.

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
