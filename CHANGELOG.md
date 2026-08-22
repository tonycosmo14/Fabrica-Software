# Historial de versiones

Este archivo es el espejo de `src/version.js`, que es lo que ve el usuario
dentro del sistema en la pantalla **Qué hay de nuevo**.

Tipos: `nuevo` (funcionalidad nueva) · `mejora` · `arreglo` · `clave` (regla de negocio importante)

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
