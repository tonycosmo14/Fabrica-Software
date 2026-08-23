# Historial de versiones

Este archivo es el espejo de `src/version.js`, que es lo que ve el usuario
dentro del sistema en la pantalla **Qué hay de nuevo**.

Tipos: `nuevo` (funcionalidad nueva) · `mejora` · `arreglo` · `clave` (regla de negocio importante)

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
