const test = require('node:test');
const assert = require('node:assert');
const s = require('../src/lib/seguridad');

test('el PIN se guarda hasheado y se puede verificar', () => {
  const { hash, sal } = s.hashear('1234');
  assert.notEqual(hash, '1234');
  assert.ok(s.verificar('1234', hash, sal));
  assert.ok(!s.verificar('1235', hash, sal));
});

test('acepta PIN de 4 a 6 digitos y nada mas', () => {
  assert.ok(s.esPinValido('1234'));
  assert.ok(s.esPinValido('123456'));
  assert.ok(!s.esPinValido('123'));
  assert.ok(!s.esPinValido('1234567'));
  assert.ok(!s.esPinValido('12a4'));
});
