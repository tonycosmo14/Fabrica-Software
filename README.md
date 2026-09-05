# 🧊 Hielo LOLHA — sistema de gestión

Sistema para la fábrica de hielo de Hunucmá, Yucatán.
Se construye **por versiones**: cada versión es un pedazo terminado, probado y usable.

**Versión actual: v5.7**

---

## Cómo lo arrancas

### En Windows — doble clic, sin comandos

| Archivo | Para qué |
|---|---|
| **INICIAR.bat** | Arranca el sistema y abre el navegador solo |
| **CREAR-ACCESO-DIRECTO.bat** | Pone el icono en el escritorio (se hace una vez) |
| **DETENER.bat** | Apaga el sistema |
| **ACTUALIZAR.bat** | Baja la versión nueva sin perder los datos |
| **RECUPERAR-ACCESO.bat** | Si el administrador olvidó su PIN y su contraseña |

La primera vez, `INICIAR` instala solo lo que necesita (tarda 1 o 2 minutos).
Si falta Node.js, te abre la página de descarga.

En Mac o Linux el equivalente es **INICIAR-MAC.command**.

### Desde la terminal

```bash
npm install     # solo la primera vez
npm start       # arranca
npm run iniciar # arranca y abre el navegador
```

Verás algo así:

```
  Fábrica de Hielo — v0.1.1
  ------------------------------------------
  Aplicada: 001_inicial.sql

  Primer arranque: se creó el administrador
     usuario:    admin
     contraseña: admin1234
     PIN:        1234

  Listo. Abre el sistema en:
     En esta PC:      http://localhost:3000
     En el celular:   http://192.168.1.50:3000
```

Abre `http://localhost:3000` en el navegador. Para entrar desde el celular,
usa la otra dirección (tiene que estar en el mismo WiFi).

Para detener el sistema: `Ctrl + C` en la terminal.

> La primera vez, el sistema te pide crear tu cuenta de administrador:
> nombre, usuario, contraseña y PIN. No hay ninguna cuenta de fábrica.

### Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca el sistema |
| `npm run iniciar` | Arranca y abre el navegador |
| `npm run dev` | Igual, pero se reinicia solo cuando cambias un archivo |
| `npm run prueba` | Corre las pruebas automáticas |
| `npm run respaldo` | Hace una copia de la base de datos a mano |
| `npm run recuperar` | Restablece el PIN y la contraseña de un administrador |

---

## Los cimientos (v0.1)

Lo que quedó desde la primera versión y sigue siendo la base de todo:

- Entrar tocando tu nombre y escribiendo tu PIN (4 a 6 dígitos)
- Entrar como admin con usuario y contraseña
- La sesión se queda guardada en el dispositivo (no pide PIN cada rato)
- Crear, editar y dar de baja usuarios, con sus roles
- Cada rol ve solo lo suyo (un operario no puede entrar a Usuarios)
- Pantalla **Sistema**: versión, migraciones aplicadas y bitácora
- Pantalla **Qué hay de nuevo** con el historial de versiones
- La base de datos se crea y actualiza sola, con respaldo antes de cada cambio
- Se ve bien en celular **y** en la pantalla grande de la PC (en la PC el PIN
  también se escribe con el teclado)

Todos los módulos del inicio ya funcionan. Lo que falta son áreas nuevas
(clientes, reparto, planta de agua, mantenimiento), no piezas de estas.

---

## Cómo está organizado

```
src/
  servidor.js          Arranque: migra, siembra y levanta el servidor
  version.js           ← El historial de versiones ("Qué hay de nuevo")
  config.js            Puerto, rutas, admin inicial
  db/
    conexion.js        Conexión única a SQLite
    respaldos.js       Copias automáticas dentro y fuera de la PC
    migrar.js          Aplica las migraciones pendientes
    respaldar.js       Copia de seguridad
    migraciones/       001_inicial.sql, 002_..., 003_...  (nunca se editan)
  lib/
    fracciones.js      ⭐ Dieciseisavos de marqueta (regla de oro 3.1)
    dinero.js          Centavos enteros, por la misma razón
    seguridad.js       Hash de PIN y contraseñas
    bitacora.js        Quién ejecutó y quién capturó cada movimiento
    roles.js           Roles y permisos
    ids.js             UUID y fechas
  middleware/
    sesion.js          Quién está conectado y qué puede hacer
  modulos/             Un módulo por área. Agregar uno no toca los demás
    auth/  usuarios/  tanques/  produccion/  existencia/  ventas/  caja/
    catalogo/  impresion/  ayuda/  personalizacion/  versiones/  sistema/
                └ productos, categorías, fotos e inventario

public/                La interfaz (HTML, CSS y JavaScript sin librerías)
  index.html
  css/estilo.css       ← los colores de la marca están al inicio de este archivo
  js/tema.js           Modo claro / oscuro
  js/dialogo.js        Ventanas del sistema (confirmar, pedir cantidad, menú)
  js/fracciones.js     ⭐ El teclado de fracciones: se usa al contar y al cobrar
  js/marca.js          Logo del negocio
  js/app.js            Navegación
  js/vistas/           Una pantalla por archivo

herramientas/          Utilidades del proyecto (genera el icono)
pruebas/
  ayudante.js          ⭐ La fábrica de mentira que usan todas las pruebas
  *.test.js            Una por módulo
datos/                 Base de datos, respaldos, logo y fotos (no se sube a GitHub)
```

### Las pruebas

Corren con `npm run prueba`: **279 pruebas en unos 5 segundos**, cada archivo
en su propio proceso y todos a la vez.

Cada archivo levanta su propia fábrica de mentira —carpeta nueva, base nueva,
servidor propio— con una sola línea:

```js
const { llamar, entrarAdmin, bd } = fabricaDePrueba('ventas');
```

Lo que ese archivo necesite listo antes va en `preparar()`, **nunca en un
segundo `test.before`**: los `before` de Node no se esperan entre sí, arrancan
a la vez, y eso produce fallas que aparecen y desaparecen solas.

Lo que se prueba es lo que puede costar dinero: que el folio no se repita, que
un corte cerrado no cambie, que el saldo de un cliente se calcule y no se
guarde, que lo agotado no se venda. No se prueba que un botón sea azul.

### La idea de fondo

- **Un módulo = una carpeta.** Agregar tanques no obliga a tocar usuarios.
- **Las migraciones nunca se editan.** Si algo salió mal, se hace la siguiente
  que lo corrige. Así la base de la fábrica siempre se puede actualizar sin miedo.
- **Nada se borra, nada se edita.** Todo son movimientos con fecha y responsable.

---

## Cómo se cobra en la caja (v0.10, ampliado en v1.5)

La pantalla que se abre al entrar. Izquierda lo que lleva el cliente,
derecha los botones, y **no se desplaza**: todo está siempre en el mismo
sitio.

Desde la v1.5 se queda con la pantalla **entera**: la franja azul de arriba
no se dibuja aquí. El reloj, la fecha y el nombre del negocio se fueron al
renglón de las teclas, que estaba medio vacío, y el menú y quién está en la
caja se metieron en la fila de los botones. En la fábrica esos cien píxeles
de alto valen más como botón que como adorno.

Arriba a la derecha viven los avisos (⚠ con el número de productos bajos,
🧊 si queda poco hielo) y los atajos discretos: existencia, números de los
tanques, gastos del cajón y terminar el turno. Si había un ticket a medias,
se aparta solo antes de salir.

### Sin soltar el teclado

Cada producto tiene un **código**. Los del hielo vienen puestos:

| Código | Es |
|---|---|
| `1` | una marqueta |
| `12` | 1/2 |
| `14` | 1/4 |
| `18` | 1/8 |
| `116` | 1/16 |

```
18  Enter     el octavo entra al ticket
F10            pasa a cobrar, con el cursor puesto
200 Enter      dice el cambio
    Enter      cobra y registra
    Enter      imprime (cada enter más, otra copia)
Esc            listo para el siguiente cliente
```

Si pagan justo, basta **Enter** sin teclear nada. Al pie de la pantalla hay
un renglón que dice qué hace enter en ese momento.

### El hielo es una sola línea

Los pedazos se **suman** en ella. Tocar 1/8 tres veces son **3/8 = $106**
(1/4 + 1/8), no tres renglones de $36. Si fueran renglones sueltos el ticket
diría "3/8" y cobraría $108, y el cliente que sepa sumar tendría razón al
reclamar. Una sola línea es la única forma de que el papel y la lista de
precios digan lo mismo.

### La impresora

El ticket lo manda **el servidor** directo a la impresora térmica, en
ESC/POS. Sale al instante porque no pasa por el navegador.

Una página web no puede hablarle a una impresora: cuando el navegador
imprime, arma una hoja y la manda a su motor de impresión, y la vista previa
se asoma aunque sea un instante. Por eso imprime el servidor.

Se configura una vez en **Productos y precios → Impresora de tickets**:

1. En Windows, compartir la impresora con un nombre corto (`TICKET`).
   No es para que la usen otras PC: es para que Windows le dé un nombre al
   que se le pueda escribir directo.
2. Escribir `\\localhost\TICKET` en el sistema y darle a **imprimir una
   prueba**.

Si no está configurada, imprime el navegador. Todo funciona igual, solo que
aparece el cuadro de imprimir.

### El catálogo

Categorías y productos se dan de alta en **Productos y precios**, sin tocar
el programa. Un producto es de **hielo** (entrega una fracción y toma su
precio de la lista por fracción) o **normal** (un refresco, un garrafón: su
propio precio, y no descuenta del cuarto frío).

Nada se borra: se da de baja. Los tickets viejos nunca cambian.

---

## Cómo se forman los precios (v0.8)

El hielo se vende en pedazos de marqueta, y **cada pedazo tiene su propio
precio**. No se saca dividiendo: el 1/16 se cobra más caro de lo
proporcional porque da más trabajo cortarlo.

| Pedazo | Precio de arranque |
|---|---|
| 1 marqueta | $264.00 |
| 1/2 | $135.00 |
| 1/4 | $70.00 |
| 1/8 | $36.00 |
| 1/16 | $18.00 |

Se editan en **Punto de venta → Precios** (solo el administrador).

### Por qué no puede cobrarse de más ni de menos

Para cobrar una cantidad cualquiera, el sistema la parte siempre en los
pedazos más grandes posibles y suma sus precios:

```
3/8  →  1/4 + 1/8  →  $70 + $36  =  $106.00
```

Como la partición es siempre la misma, tocar seis veces 1/16 da exactamente
el mismo total que tocar 1/4 y 1/8. **El precio no depende de quién atienda
ni de cómo teclee.** Y el total lo calcula el servidor, no la pantalla.

### El ticket no se corrige, se cancela

Un ticket cobrado nunca se edita ni se borra. Si algo salió mal se
**cancela**, y la cancelación guarda el motivo, la hora y el nombre de quien
la hizo. El ticket original sigue existiendo para siempre. Cancelar una
venta devuelve el hielo al cuarto frío automáticamente.

Cancelar es del **gerente** y del **administrador**; el cajero solo vende.

---

## El cuadre del cuarto frío (v0.7 + v0.8)

A las 3 y a las 8 alguien cuenta lo que queda. El conteo se captura tal como
se dicta: **"14 marquetas y 5/8"**, escrito así o con los botones
`1 · 1/2 · 1/4 · 1/8 · 1/16`.

```
    había  +  se produjo  −  se vendió con ticket  =  debería quedar
    debería quedar  −  contado  =  FALTA
```

**Falta** es lo que salió del cuarto frío sin ticket: lo que se derritió, lo
que se cayó y lo que se fue sin pagar. Ese es el número a vigilar, y hasta
la v0.8 no existía: iba escondido dentro de "salidas".

Cada conteo guarda esos números **congelados**. Si mañana se cancela una
venta vieja o se corrige una sacada, el corte que ya se firmó no cambia.

---

## Los dos inventarios, y por qué están separados

| | **Existencia** (el hielo) | **Inventario** (lo demás) |
|---|---|---|
| Qué contesta | ¿cuadra lo de hoy? | ¿qué hay que pedir? |
| Cada cuándo | dos veces al día, 3 y 8 | cuando toca |
| Se mide en | marquetas y fracciones | piezas |
| Dónde vive | pantalla **Existencia** | **Productos y precios** |

La cuenta es la misma a propósito, para que quien entendió una entienda la
otra:

```
    había + entró − salió = debería haber
    debería haber − contado = FALTA
```

Lo que cambia es el ritmo. El hielo se cuenta dos veces al día porque se
derrite y es el 80% del negocio; un refresco se cuenta cuando toca. Meterlos
en la misma pantalla obligaría a uno de los dos a fingir el ritmo del otro.

### Y por eso avisan distinto (v1.5)

De un refresco el sistema sabe **exactamente** cuántos hay: entraron 24, se
vendieron 20, quedan 4. Si dice cero, es cero. Venderlo solo genera un
problema en el mostrador, así que **se bloquea**: el botón se ve apagado y
teclear su código tampoco lo mete al ticket.

Del hielo **no lo sabe**. Los obreros sacan hielo toda la mañana y reportan
lo que sacaron hasta como las **3 de la tarde**, porque están atendiendo y
sacando al mismo tiempo. El número del sistema es *lo que se ha capturado*,
no *lo que hay*: a media mañana el cuarto frío puede estar lleno y el
sistema marcar cero.

Por eso el hielo tiene su propio símbolo 🧊 y **avisa sin bloquear nunca**.
Parar la venta de hielo por un dato que todavía no llega sería parar la
fábrica.

Todo esto pasa por un solo punto —`alcanza(producto, cantidad)` en
`src/modulos/catalogo/avisos.js`—, y el servidor lo revisa otra vez al
cobrar: el navegador solo se adelanta para no armar un ticket que se va a
caer.

---

## Dar de baja, y borrar de verdad (v1.8)

Son dos cosas distintas y la diferencia es del negocio:

| | **Dar de baja** | **Eliminar** |
|---|---|---|
| Para qué | Lo de temporada, lo que va a volver | Lo que nunca debió estar |
| Qué pasa | Deja de salir en la caja | Desaparece de la base |
| Se recupera | Sí, cuando toca | No |
| Quién | Gerente o administrador | **Solo el administrador** |
| Con qué | Su PIN | **Su contraseña** |

**Solo se puede eliminar lo que nunca se usó.** En cuanto un producto se
vendió, su nombre vive en tickets ya cobrados y en las cuentas del día;
borrarlo dejaría el histórico mintiendo. El servidor lo comprueba y
responde diciendo qué hacer en su lugar. Lo mismo con un cliente que ya
tiene movimientos y con una categoría que todavía tiene productos dentro.

La contraseña y no el PIN es a propósito: el PIN se teclea veinte veces al
día delante de quien sea y sirve para decir *"yo estoy aquí"*. Esto
respalda algo que no se deshace.

Y lo único que no se borra nunca es **la constancia de que alguien borró**.

---

## Precios de mayoreo (v1.9, rehecho en v2.0)

*"Algunos clientes gozan de mayoreo, a partir de 1/2 marqueta."*

**El mayoreo es una LISTA, no un descuento.** No es *"a Don Carlos le bajas
el 10%"*: es la lista **Mayoreo 1**, donde la marqueta vale $240 en vez de
$264 y cada fracción tiene su propio precio. Varios clientes comparten la
misma lista, y subirle el precio a la lista se lo sube a todos de una vez.

Y no es un porcentaje parejo: el 1/16 cuesta más de lo proporcional porque
cortar da trabajo, y ese trabajo no desaparece por vender mucho (regla 7.2).

### El mayoreo se teclea

La v1.9 lo resolvió por el camino largo —identificar al cliente y *entonces*
capturar—. La v2.0 lo invirtió, siguiendo cómo lo trabajaba Tony antes:

```
   1m  ⏎   1m  ⏎   1m  ⏎        cinco marquetas a mayoreo
   F10                          "¿de quién es?"
   7   ⏎                        el cliente número 7
   …                            el cobro de siempre
```

- `1m` y `12m` son productos de hielo con la marca `mayoreo`. **No tienen
  precio propio**: se cotizan con la lista del cliente si tiene una, y si no
  con la marcada como *normal*.
- **Un ticket con mayoreo no se cobra sin nombre.** La regla vive en el
  servidor (`POST /ventas` responde 409 con `faltaCliente`), no solo en la
  pantalla: es donde no se puede saltar.
- **Salirse del cobro suelta al cliente.** Un cliente pegado al ticket es la
  forma de cobrarle a uno el precio del anterior.
- Cada cliente tiene un **número** correlativo que no se reusa nunca, para
  poder teclearlo.

No hay mínimo configurable: **el mínimo lo dicen los botones que existen**.
Si solo hay marqueta y media, no hay forma de pedir mayoreo por un cuarto.

### Un ticket, dos precios

*"Dame una a mayoreo y un cuarto para la casa"* es un ticket con dos listas.
`prepararLineas()` cotiza **cada línea con la suya**: la de mayoreo con la
lista de mayoreo y el resto con la de público.

### Quién decide el precio

**El servidor, siempre.** La pantalla calcula lo mismo para que se vea al
instante —esperar medio segundo con el cliente enfrente es el peor momento
para esperar—, pero al cobrar se resuelve otra vez desde cero. El precio
queda **copiado** en el ticket (regla 3.5).

Un cliente dado de baja pierde su lista propia; una lista dada de baja cae a
la normal.

---

## Mermas del cuarto frío (v2.0)

Hasta la v1.9 el hielo derretido caía dentro del *faltante* a secas,
mezclado con el que se fue sin pagar. Son dos cosas distintas: una es física
y no tiene remedio, la otra es un problema.

```
    Había en el último conteo
  + Salió de los tanques
  = Debería haber
  − Se vendió al público
  − Se vendió a mayoreo
  − Derretidas, rotas o regaladas
  = Debería haber ahora
```

Las mermas se anotan con quién la vio y quién la capturó (regla 3.6), y
nada se borra: un renglón mal capturado se anula y queda tachado con su
motivo (regla 3.4).

---

## Borrar un ticket (v2.0)

Cancelar y borrar no son lo mismo, y la diferencia es **el papel firmado**:

| | Cancelar | Eliminar |
|---|---|---|
| Qué hace | Deja el renglón tachado con su motivo | Lo quita como si nunca hubiera existido |
| Cuándo se puede | Siempre | Solo con el turno **abierto** |
| Quién | Gerente o administrador | Solo el administrador, con su **contraseña** |
| Las cuentas | Se ajustan solas | No había nada que ajustar |

En cuanto se corta un turno hay un papel firmado con ese número. Borrar un
renglón dejaría al papel diciendo una cosa y al sistema otra, y ese papel es
el que se usa para reclamarle a alguien. Un ticket que es parte de un cambio
tampoco se borra suelto: dejaría al otro apuntando a la nada.

---

## La impresora de tickets (v0.11, por red desde v2.0.1)

El ticket lo manda **el servidor**, no el navegador: así sale al instante,
sin que se asome la ventana de impresión. El destino se lee y el camino se
elige solo:

| Destino | Cómo se manda |
|---|---|
| `192.168.1.65` | socket al puerto **9100** (RAW) |
| `192.168.1.65:9101` | socket a ese puerto |
| `\\localhost\TICKET` | `copy /b` a un nombre compartido de Windows |
| `LPT1:` | `copy /b` a un puerto |
| `C:\tickets` | se guarda como archivo, para probar sin impresora |

**Para una impresora de red basta su dirección.** No hace falta compartirla,
ni que Windows tenga el driver, ni que sea Windows. Un nombre suelto sin
puerto (`tickets`) se lee como archivo a propósito: leerlo como una máquina
de la red convertiría una carpeta mal escrita en ocho segundos de espera por
ticket.

### Elegir en vez de escribir (v2.0.2)

Al abrir Sistema se llena solo un selector con las impresoras que ve
Windows. De cada una se resuelve el destino: si su puerto trae una IP, esa
IP; si no, `windows:NOMBRE`, que entrega el trabajo al spooler marcado
`RAW` vía `winspool.drv`. Eso hace que una USB funcione **sin compartirla**,
que era donde la gente se rendía.

`GET /impresion/impresoras` le pregunta a Windows con `Get-Printer` y
devuelve nombre, puerto y nombre compartido con la sugerencia ya resuelta.
`GET /impresion/entender?destino=…` dice qué entendió, sin guardar nada: es
lo que alimenta el renglón *"el ticket se manda por red a 192.168.1.65:9100"*
debajo del campo.

**Una impresora apagada no tumba una venta.** El socket lleva reloj de ocho
segundos y `imprimirCrudo()` no lanza nunca: devuelve `{impreso:false,
motivo}` con el motivo ya traducido a algo accionable.

---

## El corte: dos columnas y WhatsApp (v1.9)

Los movimientos del corte salen en **dos columnas** —gastos de un lado,
entradas del otro, cada una con su suma—. Un día de gastos son quince
renglones y las entradas son dos: partido en dos cabe en la mitad de papel,
todos los días. Si solo hay de un tipo no se parte.

El botón **📲 Mandar por WhatsApp** dibuja el corte en un `canvas`, renglón
por renglón, y lo comparte con `navigator.share`. Sin librerías: el programa
corre en la fábrica, sin internet y sin que nadie instale nada, y la imagen
sale idéntica en todos los aparatos. En la PC, que no tiene menú de
compartir, baja el PNG y abre WhatsApp Web con el resumen escrito.

---

## El Historial (v1.8)

*"¿Qué hizo Mari el jueves entre las 3 y las 8?"*

Ventas, gastos, entradas y abonos en una sola lista, filtrable por persona,
por días, por horas y por tipo. Es lo único que un cajero puede hacer con
el dinero, así que es lo único que hay que poder revisar.

**Sale de las tablas de siempre, no de una copia.** No hay tabla
`historial` que llenar: una copia se desincroniza el día que se cancele un
ticket, y entonces el historial diría una cosa y la caja otra.

Se agrupa por **quién capturó**, no por de quién era el turno: la pregunta
es qué hizo esa persona, y quien tecleó el ticket es quien lo hizo (regla
3.6, el relevo de las 2:30).

**No es la bitácora.** La bitácora dice `venta.registrada` con un id y es
para quien programa. Esto dice *"Mari cobró el ticket #412 por $264 a las
3:15"*.

---

## Clientes y crédito (v1.6)

Regla de la fábrica: **se le fía solo a clientes registrados**, nunca al
público en general. Por eso el cliente es una ficha que existe antes de la
venta, y en la caja el botón *Fiar* abre una lista, no un campo de texto.

### La cuenta no se guarda

```
    lo que se llevó fiado  −  lo que ha abonado  =  DEBE
```

No hay columna de saldo (regla 3.2), y hay una prueba que falla si alguien
la agrega. Un número guardado se desincroniza el día que se cancele un
ticket viejo o se anule un abono, y ese día el papel del cliente y la
pantalla de la fábrica dejan de decir lo mismo. Una suma no puede.

Los abonos van **a la cuenta**, no a un ticket concreto: el cliente llega y
deja $500, no dice "esto es del ticket 412". Lo vencido se resuelve por
antigüedad, que es como lo cuenta cualquiera en el mostrador.

### El límite avisa, no bloquea

| | Cómo quedó |
|---|---|
| Límite | Por cliente. **Vacío = sin límite** |
| Pasarse | Pide el PIN de un gerente y guarda quién y por qué |
| Plazo | Días por cliente, solo para marcar lo vencido |

Al de la ferretería que lleva veinte años comprando no se le para la venta
por un número que alguien escribió hace meses. Lo que sí queda es escrito
quién dijo que sí.

### Dónde cae el dinero

- Una **venta fiada no es efectivo**: no entra al arqueo del cajón. Ese
  dinero nunca pasó por ahí, y contarlo haría que la caja faltara todos los
  días. En el corte se ve aparte cuánto salió fiado en el turno.
- Un **abono en efectivo sí entra**, con su renglón en el cajón: el billete
  sí llegó. Anularlo se lo quita también.
- Un abono **por transferencia** no toca el cajón.

---

## El relevo de turno

En la fábrica la existencia se entrega como a las **2:30** y el cajero que
sigue llega a las **3**. En ese rato el que está sigue cobrando, pero ese
dinero ya es del que viene: lo va apartando y se lo entrega cuando llega.

Al terminar el turno, el sistema pregunta **¿ya llegó quien sigue?**

| Respuesta | Qué pasa |
|---|---|
| **Sí, ya llegó** | Corte y cierre de sesión. El que entra pone su PIN, y ese PIN abre su turno a su nombre. |
| **Todavía no llega** | Se cuenta el dinero del que se va y sale su corte, pero queda abierto un turno **sin dueño**. La venta no se para. Lo que entre se aparta, y en cuanto el que llega pone su PIN, el turno se le asigna. |

Cada venta guarda **quién la tecleó** (`capturista_id`) y el turno guarda
**de quién es el dinero** (`cajero_id`). Las dos cosas quedan escritas, que
es justo la regla de oro 3.6.

Antes esto no se podía registrar: se seguía cobrando con el usuario del que
se iba, y las ventas de la noche salían a nombre de quien no era.

---

## El corte de caja (v0.9)

La caja se cuadra igual que el cuarto frío, pero con billetes:

```
    fondo + cobrado en efectivo + entradas − gastos = debería haber
    debería haber − contado = DIFERENCIA
```

El turno se abre con el fondo para dar cambio, las ventas **se pegan solas**,
se anotan los gastos (gasolina, refrescos, retiros a la caja fuerte) y al
final se cuentan los billetes. El sistema dice si sobra o falta, y por qué
suele pasar cada caso.

**Un corte cerrado no cambia nunca más.** Si mañana cancelas una venta de
hoy, el corte que ya se firmó se queda como está. Es un papel firmado.

**Si nadie abrió la caja, se cobra igual.** La fábrica no se para porque
alguien olvidó abrir el turno. Pero la pantalla de venta lo avisa en
amarillo, porque ese dinero no va a aparecer en ningún corte.

Solo el efectivo entra al arqueo. Lo que se cobre por otros medios se
informa aparte: ese dinero nunca pasó por el cajón.

---

## El manual de ayuda

Está **dentro del sistema**, en el menú → **Ayuda** (o `#/ayuda`). Lo ve
cualquiera: no hace falta ser administrador para leer cómo se usa.

Nueve temas plegados, con buscador. Y una cosa que vale la pena señalar: la
tabla de **quién puede hacer qué** no está escrita a mano. El servidor la
arma leyendo los permisos de verdad (`src/lib/roles.js`), así que el día que
se agregue un rol o se mueva un permiso, el manual se corrige solo. Hay una
prueba que compara la tabla contra los permisos reales, rol por rol: un
manual que miente es peor que no tener manual.

Para agregar o corregir un tema se edita `TEMAS` en
`public/js/vistas/ayuda.js`. El campo `busca` son las palabras con las que
ese tema tiene que aparecer en el buscador.

---

## El cajón del dinero (v2.1)

El cajón no tiene cerebro: es un solenoide con un cable RJ11 metido en la
impresora. La impresora le manda un pulso y el resorte lo dispara. El
comando es `ESC p m t1 t2` — salida (2 o 5), duración del pulso y espera.

Dos decisiones:

- **El pulso es su propio documento**, no va colgado del ticket. El ticket
  solo sale si el cajero lo pide; el cajón tiene que abrirse siempre que
  entre efectivo. Colgado del ticket, el día que nadie imprime el cajón no
  abre.
- **Se abre al cobrar**, desde la pantalla de venta, no desde el servidor al
  registrar: así el cajero que cobra por el celular no abre el cajón de la
  PC sin estar ahí.

---

## Los sonidos (v2.1)

Se **sintetizan** con WebAudio, no son archivos: el programa vive sin
internet, unos MP3 se pierden en una actualización, pesan cero y se ajustan
cambiando un número. Onda triangular con rampa de subida y bajada — un tono
que arranca de golpe hace "clic" en las bocinas baratas.

El enganche está en `avisar()`, no en cada pantalla: todo lo que sale bien o
mal pasa por ahí, así que a una pantalla nueva no se le puede olvidar.

La preferencia vive en `localStorage`, **por aparato**: la PC de la caja
tiene bocinas y el celular del reparto no tiene por qué pitar en la calle.

---

## Devoluciones completas (v2.1)

Una devolución completa **es cancelar el ticket**. El hielo vuelve al cuarto
frío solo y la caja se ajusta sola porque lo cobrado deja de contar; una
tabla aparte sería otra cuenta que se puede desincronizar.

Lo que añade `POST /ventas/:id/devolver` sobre cancelar:

| | |
|---|---|
| Motivo de una lista cerrada | Veinte *"se cansó de esperar"* son un problema de la fila, y eso no se ve con texto libre |
| Compensa el cajón | Si el ticket es de un turno cerrado, ese dinero entró otro día pero sale del cajón de hoy |
| Distingue el fiado | No entró dinero: se cancela el cargo y el cliente deja de deberlo |

---

## El número del ticket (v2.2)

Cada venta lleva **dos** números y conviene no confundirlos:

| | Qué es | Se reinicia |
|---|---|---|
| `folio` | La identidad. Amarra un cambio con otro y un ticket con su corte | Nunca |
| `serie` + `folio_anual` | Lo que se imprime y se dice: **2026-412** | Cada 1 de enero |

Separarlos permite reiniciar la cuenta cada año **sin tocarle la identidad a
papeles que ya se firmaron**. El año sale de `strftime('%Y','now','localtime')`
— ver la trampa de la zona horaria, más abajo: el 31 de diciembre a las 7 de
la tarde de aquí ya es enero en UTC.

`leerNumero()` acepta `2026-412`, `412` y `#412`, y `numeroDeTicket()` lo
escribe. Los dos viven en `src/modulos/ventas/folio.js` y el servidor manda
el `numero` ya escrito en cada respuesta: así ninguna pantalla lo arma por
su cuenta y ninguna se olvida de la serie.

---

## Actualizar desde un ZIP (v2.2)

`POST /sistema/actualizar/revisar` dice qué trae sin tocar nada;
`POST /sistema/actualizar` instala. El orden dentro de `instalar()` no es
negociable: respaldo de la base → copia de la versión vieja → escribir.

Lo que se reemplaza es una **lista blanca** (`src`, `public` y unos archivos
sueltos). Con una lista negra, el día que el ZIP traiga una carpeta nueva
que a nadie se le ocurrió prohibir, se copia. `datos` está además en la
lista de intocables.

`src/lib/zip.js` lee el formato a mano —directorio central e
`inflateRawSync`— porque una actualización que necesita `npm install` para
instalarse no se puede instalar en una fábrica sin internet.

`instalar()` acepta `raiz` y `carpetaDatos` para poder probarse sobre una
instalación de mentiras en `/tmp`. Es el código más peligroso del programa;
probarlo "de mentiritas" sería no probarlo.

---

## La trampa de la zona horaria

Las fechas se guardan en **UTC** (`new Date().toISOString()`): un instante,
no una hora de pared. Es lo correcto, pero abre una trampa que ya costó un
bug de los caros.

Yucatán va **seis horas detrás**. Un ticket de las 6:29 p.m. se guarda como
las 00:29 del **día siguiente**. Así que cualquier consulta que compare la
columna guardada contra un día o una hora **del reloj de la fábrica** tiene
que convertirla primero:

```sql
date(v.fecha, 'localtime') = date('now', 'localtime')   -- ✓
time(m.fecha, 'localtime') >= time(?)                   -- ✓

date(v.fecha) = date('now', 'localtime')                -- ✗ media tarde perdida
```

**Regla:** si a un lado de la comparación hay una fecha escrita por una
persona —un filtro, un día del calendario, una hora— el otro lado lleva
`'localtime'`. Si los dos lados son columnas guardadas, no: los dos están
en UTC y se comparan tal cual.

`pruebas/zona-horaria.test.js` corre con `TZ=America/Merida` puesto: en una
computadora en UTC este error no se puede reproducir, y una prueba que no
puede fallar no prueba nada.

---

## Las reglas de oro (del plan)

Están escritas en el código, no solo en el documento:

| # | Regla | Dónde vive |
|---|---|---|
| 3.1 | El hielo se guarda en dieciseisavos enteros, nunca decimales | `src/lib/fracciones.js` |
| 3.2 | Todo es un movimiento inmutable | `src/modulos/produccion/estado.js` |
| 3.3 | UUID interno estable, nombre editable | `src/lib/ids.js` |
| 3.4 | Nada se borra: baja con fecha | columnas `activo` / `fecha_baja` |
| 3.5 | El precio se copia dentro de la venta | `src/modulos/ventas/precios.js`, columna `venta_lineas.precio_centavos` |
| 3.6 | Doble responsable: ejecutor y capturista | tabla `bitacora` |

---

## Cómo se agrega una versión nueva

0. La numeración: después de la v0.9 viene la **v1.0**, no la v0.10. El
   tercer número (v1.4.1) es solo para arreglos o cambios de aspecto.
1. Se programa el pedazo (con su migración `0XX_...sql` si toca la base).
2. Se agrega la entrada nueva **hasta arriba** del arreglo en `src/version.js`.
3. Se actualiza `VERSION_ACTUAL` ahí mismo y `version` en `package.json`.
4. Se corre `npm run prueba`.

La pantalla "Qué hay de nuevo" se actualiza sola, y a quien no haya visto la
versión nueva le aparece un punto rojo en el menú.

---

## Camino de versiones

Esta tabla se genera de `src/version.js`, que es la única fuente de
verdad de qué hay en cada versión. Escrita a mano se quedaba atrás.

| Versión | Contenido | Estado |
|---|---|---|
| **v0.1** | Cimientos | ✅ listo |
| **v0.1.1** | Se ve bien en la PC | ✅ listo |
| **v0.1.2** | Se abre con doble clic | ✅ listo |
| **v0.1.3** | Se instala sin pelear | ✅ listo |
| **v0.1.4** | Hielo LOLHA | ✅ listo |
| **v0.2** | Tanques | ✅ listo |
| **v0.2.1** | Personalizar y mejor acabado | ✅ listo |
| **v0.2.2** | Encabezado, reloj y atajos | ✅ listo |
| **v0.3** | Producción | ✅ listo |
| **v0.4** | Producción como trabaja la fábrica | ✅ listo |
| **v0.5** | Los números a sacar | ✅ listo |
| **v0.5.1** | Autoriza primero, decide después | ✅ listo |
| **v0.6** | Respaldos automáticos | ✅ listo |
| **v0.7** | La Existencia | ✅ listo |
| **v0.8** | Punto de venta | ✅ listo |
| **v0.9** | La Caja | ✅ listo |
| **v0.9.1** | Manual de ayuda | ✅ listo |
| **v1.0** | La caja de verdad | ✅ listo |
| **v1.1** | Impresión de verdad y relevo de turno | ✅ listo |
| **v1.2** | Dos clientes a la vez y cambios de ticket | ✅ listo |
| **v1.3** | Productos con foto, costo e inventario | ✅ listo |
| **v1.4** | Editar sin formularios | ✅ listo |
| **v1.5** | La caja avisa y la pantalla rinde | ✅ listo |
| **v1.6** | Clientes y crédito | ✅ listo |
| **v1.6.1** | Sin teclas en el celular | ✅ listo |
| **v1.7** | La caja obedece | ✅ listo |
| **v1.8** | Historial, y borrar de verdad | ✅ listo |
| **v1.9** | Mayoreo, papel y WhatsApp | ✅ listo |
| **v2.0** | La caja de diario | ✅ listo |
| **v2.0.1** | La impresora de red | ✅ listo |
| **v2.0.2** | Tres que estorbaban | ✅ listo |
| **v2.1** | El cajón, el sonido y las devoluciones | ✅ listo |
| **v2.2** | El número del año, y actualizar solo | ✅ listo |
| **v2.3** | Como se construye un ticket | ✅ listo |
| **v2.4** | Listas que se pueden leer | ✅ listo |
| **v2.5** | Los gastos de siempre y el turno relevado | ✅ listo |
| **v2.6** | El ticket chico | ✅ listo |
| **v2.7** | Las cuentas de la empresa | ✅ listo |
| **v2.7.1** | Los arreglos del estreno | ✅ listo |
| **v2.8** | El día del arranque | ✅ listo |
| **v2.9** | Los números | ✅ listo |
| **v2.9.1** | Que los números cuadren | ✅ listo |
| **v3.0** | Cómo salió el hielo | ✅ listo |
| **v3.1** | Lo que faltaba del hielo, y la pantalla ordenada | ✅ listo |
| **v3.2** | Las canastas que quedaron pendientes | ✅ listo |
| **v3.3** | Configurar tanques, donde le toca | ✅ listo |
| **v3.4** | Anotar la existencia, en el orden en que se canta | ✅ listo |
| **v3.5** | Lo que estaba roto y lo que estorbaba | ✅ listo |
| **v3.6** | Las dos temperaturas | ✅ listo |
| **v3.7** | El recibo de luz completo, y el IVA que nos deben | ✅ listo |
| **v3.8** | La gente y los clientes, con cara | ✅ listo |
| **v3.9** | Corregir un corte, y el historial de un vistazo | ✅ listo |
| **v4.0** | Una sola manera de anotar el hielo | ✅ listo |
| **v4.1** | El corte se lo come todo | ✅ listo |
| **v4.2** | El corte del hielo | ✅ listo |
| **v4.3** | Los vales | ✅ listo |
| **v4.4** | El corte en dos columnas | ✅ listo |
| **v4.5** | Lo encomendado | ✅ listo |
| **v4.6** | La hoja, a tu manera | ✅ listo |
| **v4.7** | Menos papel, más rastro | ✅ listo |
| **v4.8** | La raya | ✅ listo |
| **v4.9** | Que el sistema te escriba | ✅ listo |
| **v5.0** | Los tickets, como los dibujaste | ✅ listo |
| **v5.1** | Las neveras | ✅ listo |
| **v5.2** | El agua: la máquina | ✅ listo |
| **v5.2.1** | La puesta en marcha, arreglada | ✅ listo |
| **v5.2.2** | El ticket de mayoreo y la palabra crédito | ✅ listo |
| **v5.3** | Paga una parte y debe la otra | ✅ listo |
| **v5.4** | Los clientes, por lo que compran | ✅ listo |
| **v5.5** | Cobrar la deuda desde la caja | ✅ listo |
| **v5.6** | Los pedidos | ✅ listo |
| **v5.7** | La salida y la liquidación | ✅ listo |
| **v5.7.1** | Lo que salió en la revisión | ✅ listo |
| **v5.8** | El pedido, desde cobrar | ✅ listo |
| **v5.8.1** | Los QR ya se leen | ✅ listo |
| **v5.9** | Las neveras en el mapa | ✅ listo |
| **v6.0** | La hueca es merma | ✅ listo |
| **v6.1** | El administrador corrige lo que sea | ✅ listo |
| **v6.2** | El precio especial de una vez | ✅ listo |
| **v6.3** | Los pedidos, a su camioneta | ✅ listo |
| **v6.4** | Los de siempre y los de una vez | ✅ listo |
| **v6.5** | Los estados del hielo, como son | ✅ listo |
| **v6.5.1** | Que no se pierda de vista | ✅ listo |
| **v6.6** | Corregir el paño, molde por molde | ✅ listo |
| **v6.7** | Revisar el tanque | ✅ listo |
| **v6.8** | La raya, como se paga de verdad | ✅ listo |
| **v6.8.1** | Tres cosas que estorbaban | ✅ listo |
| **v6.9** | Clientes, como los quiero ver | ✅ listo |
| **v6.9.1** | La nevera del cliente, y el ancho de la ficha | ✅ listo |
| **v7.0** | Pedidos, como los quiero ver | ✅ listo |

**Lo que falta:** el instalador para Windows, y la
importación de lo que hay en Aronium la noche antes de arrancar.
