# Reglas del negocio — Hielo LOLHA

Cómo trabaja **de verdad** la fábrica, dicho por Tony. Esto no es un plan de
programación: es la realidad contra la que se programa.

> Escribir aquí antes de programar es a propósito. En la v0.3 se construyó
> producción sobre suposiciones y hubo que tirar el módulo entero cuando se
> supo el flujo real. Lo que está en este archivo ya no se adivina.

Si algo de aquí cambia en la fábrica, **primero se corrige este archivo** y
después el código.

---

## 1. Clientes y crédito

- Se le fía **solo a clientes registrados previamente**. Al público en
  general **no**.
- Un cliente de crédito es una ficha que existe antes de la venta: si no
  está dado de alta, no hay crédito.

### Lo que se decidió al construir la v1.6

Tony no había definido límite, autorización, plazo ni cobranza. En vez de
inventarle una política a la fábrica, **se construyó la cuenta y se dejó la
política configurable**. La cuenta —quién debe, de qué tickets y qué ha
abonado— es la misma con cualquier política; lo de arriba se ajusta sin
tocar el código.

| Punto | Cómo quedó | Cómo se cambia |
|---|---|---|
| Límite de crédito | Campo por cliente. **Vacío = sin límite.** | En la ficha del cliente |
| Pasarse del límite | **No se bloquea: se pide PIN** de gerente o administrador, y queda quién autorizó | Permiso `credito.autorizar` |
| Plazo | Días por cliente, **solo para marcar lo vencido**. Nunca impide vender | En la ficha del cliente |
| Cobranza | Abonos a la cuenta, en efectivo o transferencia. El efectivo entra al cajón como cualquier ingreso | — |

Y dos reglas que sí son del negocio, no configurables:

- Una **venta a crédito no es efectivo**: no entra en el arqueo del cajón,
  porque ese dinero no pasó por ahí. Contarlo haría que la caja faltara
  todos los días.
- Un **abono en efectivo sí entra**, porque el billete sí llegó al cajón.

**Falta por definir todavía:** si se cobra interés o recargo por atraso, y
si hay días de corte fijos (todos cortan el día 15, por ejemplo) o cada
cliente lleva su propio plazo desde la fecha de cada ticket. Hoy es lo
segundo.

---

## 2. Reparto

- El repartidor llega y **los pedidos ya deben estar listos** para que se los
  lleve. El pedido existe antes que la ruta.
- Formas de pago en la ruta:
  - **Transferencia por adelantado** (lo que se quiere promover).
  - **Efectivo contra entrega**, que hoy sigue siendo la mayoría.
- La meta es que paguen antes y el repartidor **solo entregue**, sin manejar
  efectivo. Mientras tanto hay que soportar las dos.

### Neveras en comodato

- Las neveras **las presta la fábrica** al cliente.
- Cada nevera tiene **dos identificadores**:
  - el **número de serie** que trae de fábrica,
  - y un **número propio** que le pone Hielo LOLHA.
- Hay que poder saber **quién tiene cada nevera** en todo momento.

---

## 3. Planta de agua

### Garrafones

- Hay de **19 L y 20 L**, y se cobran **igual**.
- El llenado cuesta **$12**.
- **Cambio de vacío por lleno**, siempre que el que entregan esté bueno: no
  roto, no rajado, no cuarteado.
- Si no hay gente esperando, se intenta devolverle **su mismo garrafón**.
- Si hay gente, **no se debe hacer esperar**: hay que poder darle uno ya
  lleno de inmediato y quedarse con el suyo.
- Si el cliente **no trae garrafón**, paga **depósito** por el envase.

### Otras presentaciones

- Garrafón de **10 L**
- Botellas de **1.5 L** y **1 L**

---

## 4. Mantenimiento

Lista **incompleta**: Tony irá agregando conforme se acuerde.

| Cada cuándo | Qué |
|---|---|
| Cada noche, antes de cerrar | Revisar el **aceite de los compresores**. Si no está nivelado, meterle más. |
| Cada mañana, al abrir (~9 am) | Revisar la **sal de la ósmosis**. Si falta, rellenar. |
| Según el mes | Somos tarifa **GDMTH peninsular**: apagar las máquinas antes del **horario punta**. El horario cambia con el mes. |
| Recomendable, no diario | Medir los **sólidos disueltos** del agua: los de **entrada** y los de **salida**. |
| Por vida útil | Llevar la cuenta de las **membranas**. |
| Por vida útil | Saber cuándo cambiar el **filtro de 5 micras**. |
| Cada 6 u 8 meses | **Lavado de los condensadores**. |

Lo que el sistema tiene que resolver aquí: recordar a tiempo, dejar
constancia de quién lo hizo, y llevar la cuenta de lo que se gasta por uso
(membranas, filtros) y no por fecha.

---

## 5. Cómo se cobra (ya construido)

Está en la v0.8 y funciona, pero se apunta aquí porque es regla de negocio:

- Cada fracción de marqueta tiene **su propio precio**; no se saca dividiendo
  el de la marqueta, porque cortar da trabajo.
- El precio de una cantidad es la suma de los pedazos en que se parte, y la
  partición es siempre la misma: tocar seis veces 1/16 cuesta exactamente lo
  mismo que tocar 1/4 y 1/8.
- El hielo es el **80% de las ventas**.

## 6. Cómo se cuenta (ya construido)

- El conteo del cuarto frío se dicta con fracción: *"quedan 14 marquetas y
  5/8"*.
- Se cuenta a las **3 de la tarde** y a las **8 de la noche**.
- Los obreros **no capturan nada**: sacan hielo y reportan. Hay señores que
  no leen ni escriben y no tienen celular. Captura quien recibe la
  existencia.
- Los paños **siempre** se sacan intercalados (1, 3, 5… luego 2, 4, 6…).
