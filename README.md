# 🧊 Hielo LOLHA — sistema de gestión

Sistema para la fábrica de hielo de Hunucmá, Yucatán.
Se construye **por versiones**: cada versión es un pedazo terminado, probado y usable.

**Versión actual: v0.13**

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
pruebas/               Pruebas automáticas
datos/                 Base de datos, respaldos, logo y fotos (no se sube a GitHub)
```

### La idea de fondo

- **Un módulo = una carpeta.** Agregar tanques no obliga a tocar usuarios.
- **Las migraciones nunca se editan.** Si algo salió mal, se hace la siguiente
  que lo corrige. Así la base de la fábrica siempre se puede actualizar sin miedo.
- **Nada se borra, nada se edita.** Todo son movimientos con fecha y responsable.

---

## Cómo se cobra en la caja (v0.10)

La pantalla que se abre al entrar. Izquierda lo que lleva el cliente,
derecha los botones, y **no se desplaza**: todo está siempre en el mismo
sitio.

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

1. Se programa el pedazo (con su migración `00X_...sql` si toca la base).
2. Se agrega la entrada nueva **hasta arriba** del arreglo en `src/version.js`.
3. Se actualiza `VERSION_ACTUAL` ahí mismo y `version` en `package.json`.
4. Se corre `npm run prueba`.

La pantalla "Qué hay de nuevo" se actualiza sola, y a quien no haya visto la
versión nueva le aparece un punto rojo en el menú.

---

## Camino de versiones

| Versión | Contenido | Estado |
|---|---|---|
| **v0.1** | Cimientos, usuarios, roles, PIN, migraciones, novedades | ✅ listo |
| **v0.1.1** | Ajustes para que se vea bien en PC, PIN con teclado físico | ✅ listo |
| **v0.1.2** | Arranque con doble clic, icono en el escritorio, instalable en el celular | ✅ listo |
| **v0.1.3** | Se instala sin compilador: base de datos incluida en Node | ✅ listo |
| **v0.1.4** | Marca Hielo LOLHA, modo oscuro, asistente de primer arranque | ✅ listo |
| **v0.2** | Configurador de tanques, paños, canastas y moldes | ✅ listo |
| **v0.2.1** | Personalizar (logo propio), diálogos del sistema, quitar paños | ✅ listo |
| **v0.2.2** | Encabezado con logo y reloj, atajos, recuperación de acceso | ✅ listo |
| **v0.3** | Producción: sacar, rellenar, estados, reloj de congelación | ✅ listo |
| **v0.4** | Producción con el flujo real: rotación, paño como unidad, captura en lote | ✅ listo |
| **v0.5** | Números a sacar imprimibles, autorización con PIN, arreglos | ✅ listo |
| **v0.5.1** | Autorización al primer toque con vales, ajustes de formulario | ✅ listo |
| **v0.6** | Respaldos automáticos dentro y fuera de la PC | ✅ listo |
| **v0.7** | La Existencia: conteo del cuarto frío y cuadre del día | ✅ listo |
| **v0.8** | Punto de venta, conteo con fracciones, vendido vs faltante | ✅ listo |
| **v0.9** | La Caja: turnos, gastos, arqueo y corte imprimible | ✅ listo |
| **v0.9.1** | Manual de ayuda dentro del sistema | ✅ listo |
| **v0.10** | Caja táctil: catálogo, teclado rápido, ticket corto | ✅ listo |
| **v0.11** | Impresión ESC/POS desde el servidor, relevo de turno, reimpresión | ✅ listo |
| **v0.12** | Ventas en espera y cambios de ticket | ✅ listo |
| **v0.13** | Productos con foto, costo e inventario | ✅ listo |
| v0.14 | Clientes registrados y crédito | siguiente |
| v0.15 | Reparto, pedidos y neveras en comodato | |
| v0.16 | Planta de agua: garrafones, botellas y depósitos | |
| v0.17 | Mantenimiento: compresores, ósmosis, membranas, horario punta | |
| v0.18 | Estadísticas | |
| v1.0 | Sistema completo en producción | |
