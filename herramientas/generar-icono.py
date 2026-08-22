"""
Genera el icono del programa (icono.ico) sin librerias externas.
Dibuja un cubo de hielo isometrico sobre fondo azul redondeado.
Se corre solo cuando se quiera cambiar el icono:  python3 herramientas/generar-icono.py
"""
import struct, zlib

TAM = 256          # tamano final
SS = 4             # supermuestreo para que los bordes salgan suaves
W = TAM * SS

AZUL       = (11, 79, 108)
CUBO_TOPE  = (232, 244, 248)
CUBO_IZQ   = (108, 190, 220)
CUBO_DER   = (23, 137, 184)
BRILLO     = (150, 212, 235)   # reflejo suave sobre la cara izquierda


def dentro(poli, x, y):
    """Prueba de punto en poligono (regla par-impar)."""
    d = False
    n = len(poli)
    j = n - 1
    for i in range(n):
        xi, yi = poli[i]
        xj, yj = poli[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            d = not d
        j = i
    return d


def rect_redondo(x, y, w, r):
    """True si el punto cae dentro del cuadrado con esquinas redondeadas."""
    if x < r and y < r:      return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x > w - r and y < r:  return (x - (w - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y > w - r:  return (x - r) ** 2 + (y - (w - r)) ** 2 <= r * r
    if x > w - r and y > w - r: return (x - (w - r)) ** 2 + (y - (w - r)) ** 2 <= r * r
    return True


# Geometria del cubo, en coordenadas del lienzo grande
cx, cy = W * 0.5, W * 0.53
a = W * 0.30    # media anchura
b = W * 0.17    # media altura del rombo superior
h = W * 0.30    # altura del cuerpo

A = (cx, cy - b - h * 0.5)              # vertice superior
B = (cx + a, cy - h * 0.5)              # derecha
C = (cx, cy + b - h * 0.5)              # centro frontal
D = (cx - a, cy - h * 0.5)              # izquierda

tope = [A, B, C, D]
izq  = [D, C, (C[0], C[1] + h), (D[0], D[1] + h)]
der  = [C, B, (B[0], B[1] + h), (C[0], C[1] + h)]
# Reflejo de luz sobre la cara izquierda
brillo = [(cx - a * 0.66, cy + h * 0.06), (cx - a * 0.46, cy + h * 0.16),
          (cx - a * 0.46, cy + h * 0.70), (cx - a * 0.66, cy + h * 0.60)]

radio = W * 0.20

# --- Dibujo a resolucion alta ---
grande = bytearray(W * W * 4)
for y in range(W):
    fy = y + 0.5
    fila = y * W * 4
    for x in range(W):
        fx = x + 0.5
        if not rect_redondo(fx, fy, W, radio):
            continue                       # fuera del icono: transparente
        color = AZUL
        if dentro(tope, fx, fy):   color = CUBO_TOPE
        elif dentro(der, fx, fy):  color = CUBO_DER
        elif dentro(izq, fx, fy):  color = CUBO_IZQ
        if dentro(brillo, fx, fy): color = BRILLO
        i = fila + x * 4
        grande[i:i + 4] = bytes((*color, 255))

# --- Reduccion promediando bloques de SS x SS ---
pix = bytearray(TAM * TAM * 4)
for y in range(TAM):
    for x in range(TAM):
        r = g = bl = al = 0
        for dy in range(SS):
            base = ((y * SS + dy) * W + x * SS) * 4
            for dx in range(SS):
                i = base + dx * 4
                a_ = grande[i + 3]
                r += grande[i] * a_; g += grande[i + 1] * a_; bl += grande[i + 2] * a_; al += a_
        n = SS * SS
        o = (y * TAM + x) * 4
        if al:
            pix[o] = r // al; pix[o + 1] = g // al; pix[o + 2] = bl // al
        pix[o + 3] = al // n


def png(ancho, alto, datos):
    crudo = b''.join(b'\x00' + bytes(datos[y * ancho * 4:(y + 1) * ancho * 4]) for y in range(alto))
    def trozo(tipo, cuerpo):
        return (struct.pack('>I', len(cuerpo)) + tipo + cuerpo
                + struct.pack('>I', zlib.crc32(tipo + cuerpo) & 0xffffffff))
    return (b'\x89PNG\r\n\x1a\n'
            + trozo(b'IHDR', struct.pack('>IIBBBBB', ancho, alto, 8, 6, 0, 0, 0))
            + trozo(b'IDAT', zlib.compress(crudo, 9))
            + trozo(b'IEND', b''))


def reducir(datos, origen, destino):
    """Reduce la imagen a otro tamano, promediando."""
    f = origen // destino
    salida = bytearray(destino * destino * 4)
    for y in range(destino):
        for x in range(destino):
            r = g = b = a = 0
            for dy in range(f):
                base = ((y * f + dy) * origen + x * f) * 4
                for dx in range(f):
                    i = base + dx * 4
                    aa = datos[i + 3]
                    r += datos[i] * aa; g += datos[i + 1] * aa; b += datos[i + 2] * aa; a += aa
            o = (y * destino + x) * 4
            if a:
                salida[o] = r // a; salida[o + 1] = g // a; salida[o + 2] = b // a
            salida[o + 3] = a // (f * f)
    return salida


# El .ico lleva varios tamanos: Windows toma el que necesita en cada vista.
tamanos = [256, 128, 64, 48, 32, 16]
imagenes = [(t, png(t, t, pix if t == 256 else reducir(pix, 256, t))) for t in tamanos]

cabecera = struct.pack('<HHH', 0, 1, len(imagenes))
desplazamiento = 6 + 16 * len(imagenes)
entradas, cuerpos = b'', b''
for t, datos in imagenes:
    entradas += struct.pack('<BBBBHHII', t if t < 256 else 0, t if t < 256 else 0,
                            0, 0, 1, 32, len(datos), desplazamiento)
    cuerpos += datos
    desplazamiento += len(datos)

open('icono.ico', 'wb').write(cabecera + entradas + cuerpos)
open('public/icono.png', 'wb').write(imagenes[0][1])
print('icono.ico y public/icono.png generados')
