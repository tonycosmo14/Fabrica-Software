# 🧊 Hielo LOLHA — sistema de gestión

Sistema para la fábrica de hielo de Hunucmá, Yucatán.
Se construye **por versiones**: cada versión es un pedazo terminado, probado y usable.

**Versión actual: v0.7**

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

## Qué hay en la v0.1

Lo que **ya funciona y puedes probar**:

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

Lo que **todavía no existe** (aparece en gris en el inicio):
tanques (v0.2), producción (v0.3), venta (v0.4), caja (v0.5).

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
    seguridad.js       Hash de PIN y contraseñas
    bitacora.js        Quién ejecutó y quién capturó cada movimiento
    roles.js           Roles y permisos
    ids.js             UUID y fechas
  middleware/
    sesion.js          Quién está conectado y qué puede hacer
  modulos/             Un módulo por área. Agregar uno no toca los demás
    auth/  usuarios/  tanques/  produccion/  existencia/
    personalizacion/  versiones/  sistema/

public/                La interfaz (HTML, CSS y JavaScript sin librerías)
  index.html
  css/estilo.css       ← los colores de la marca están al inicio de este archivo
  js/tema.js           Modo claro / oscuro
  js/dialogo.js        Ventanas del sistema (confirmar, pedir número, menú)
  js/marca.js          Logo del negocio
  js/app.js            Navegación
  js/vistas/           Una pantalla por archivo

herramientas/          Utilidades del proyecto (genera el icono)
pruebas/               Pruebas automáticas
datos/                 Base de datos y respaldos (no se sube a GitHub)
```

### La idea de fondo

- **Un módulo = una carpeta.** Agregar tanques no obliga a tocar usuarios.
- **Las migraciones nunca se editan.** Si algo salió mal, se hace la siguiente
  que lo corrige. Así la base de la fábrica siempre se puede actualizar sin miedo.
- **Nada se borra, nada se edita.** Todo son movimientos con fecha y responsable.

---

## Las reglas de oro (del plan)

Están escritas en el código, no solo en el documento:

| # | Regla | Dónde vive |
|---|---|---|
| 3.1 | El hielo se guarda en dieciseisavos enteros, nunca decimales | `src/lib/fracciones.js` |
| 3.2 | Todo es un movimiento inmutable | `src/modulos/produccion/estado.js` |
| 3.3 | UUID interno estable, nombre editable | `src/lib/ids.js` |
| 3.4 | Nada se borra: baja con fecha | columnas `activo` / `fecha_baja` |
| 3.5 | El precio se copia dentro de la venta | llega en v0.4 |
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
| v0.8 | Punto de venta: fracciones, precios y tickets | siguiente |
| v0.4 | Punto de venta: fracciones, precios por fracción, tickets | |
| v0.5 | Caja: sesiones, vales, arqueos y cortes | |
| v0.6 | Clientes, mayoreo, crédito y autorizaciones | |
| v0.7 | Mantenimiento: equipos, tareas, insumos, checklists | |
| v0.8 | Planta de agua y garrafones | |
| v0.9 | Reparto, mapas y neveras en comodato | |
| v1.0 | Sistema completo en producción | |
