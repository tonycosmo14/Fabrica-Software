/**
 * Pruebas del motor de fracciones (regla de oro 3.1).
 * Se corren con:  npm run prueba
 */
const test = require('node:test');
const assert = require('node:assert');
const f = require('../src/lib/fracciones');
const { descomponer, desglose } = f;

test('convierte dieciseisavos a la fraccion reducida', () => {
  assert.equal(f.aTexto(0), '0');
  assert.equal(f.aTexto(1), '1/16');
  assert.equal(f.aTexto(2), '1/8');
  assert.equal(f.aTexto(4), '1/4');
  assert.equal(f.aTexto(6), '3/8');
  assert.equal(f.aTexto(8), '1/2');
  assert.equal(f.aTexto(16), '1');
  assert.equal(f.aTexto(20), '1 1/4');
  assert.equal(f.aTexto(35), '2 3/16');
});

test('3/8, 1/4+1/8 y 6/16 son el mismo numero', () => {
  const tresOctavos = 6;
  const cuartoMasOctavo = f.sumar([4, 2]);
  const seisDieciseisavos = f.sumar([1, 1, 1, 1, 1, 1]);
  assert.equal(cuartoMasOctavo, tresOctavos);
  assert.equal(seisDieciseisavos, tresOctavos);
  assert.equal(f.aTexto(cuartoMasOctavo), '3/8');
});

test('rechaza decimales: el hielo nunca se guarda con punto', () => {
  assert.throws(() => f.validar(1.5));
  assert.throws(() => f.deMarquetas(2.5));
});

test('una marqueta y media son 24 dieciseisavos', () => {
  assert.equal(f.sumar([f.deMarquetas(1), 8]), 24);
  assert.equal(f.aTexto(24), '1 1/2');
});

// ============================================================
// v0.8 — descomponer y desglose
// El precio de una cantidad se forma partiéndola en pedazos, así que la
// partición tiene que ser SIEMPRE la misma, teclee quien teclee.
// ============================================================

test('descomponer parte en los pedazos más grandes posibles', () => {
  assert.deepEqual(descomponer(6), [4, 2]);        // 3/8 = 1/4 + 1/8
  assert.deepEqual(descomponer(20), [16, 4]);      // 1 1/4
  assert.deepEqual(descomponer(3), [2, 1]);        // 3/16 = 1/8 + 1/16
  assert.deepEqual(descomponer(16), [16]);
  assert.deepEqual(descomponer(0), []);
});

test('la partición no depende de cómo se teclee', () => {
  // Seis toques de 1/16 y un 1/4 más un 1/8 son la misma cantidad,
  // así que tienen que partirse igual y costar igual.
  assert.deepEqual(descomponer(1 + 1 + 1 + 1 + 1 + 1), descomponer(4 + 2));
});

test('el desglose junta los repetidos para que quepa en el ticket', () => {
  assert.equal(desglose(6), '1/4 + 1/8');
  assert.equal(desglose(234), '14×1 + 1/2 + 1/8');   // 14 5/8
});

test('descomponer no acepta medias fracciones', () => {
  assert.throws(() => descomponer(2.5));
});
