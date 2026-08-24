/**
 * PRUEBAS DEL MANUAL DE AYUDA
 *
 * Lo importante de esta prueba: la tabla de "quién puede qué" NO está
 * escrita a mano. Se arma de los permisos reales. Aquí se comprueba que de
 * verdad coincide, porque un manual que miente es peor que no tener manual.
 */
const test = require('node:test');
const assert = require('node:assert');
const { fabricaDePrueba } = require('./ayudante');
const { puede } = require('../src/lib/roles');

const { llamar, preparar, sinSesion } = fabricaDePrueba('ayuda');


test('la tabla de permisos dice la verdad, rol por rol', async () => {
  const { json } = await llamar('/api/ayuda/permisos');
  const { roles, acciones } = json.datos;

  assert.ok(acciones.length >= 15, 'están descritas todas las acciones');

  for (const a of acciones) {
    for (const r of roles) {
      const puedeDeVerdad = puede(r.rol, a.permiso);
      const diceLaTabla = a.quienes.includes(r.rol);
      assert.equal(diceLaTabla, puedeDeVerdad,
        `"${a.texto}": la tabla dice ${diceLaTabla} y el sistema dice ${puedeDeVerdad} para ${r.rol}`);
    }
  }
});

test('el administrador aparece con comodín y puede todo', async () => {
  const { json } = await llamar('/api/ayuda/permisos');
  const admin = json.datos.roles.find((r) => r.rol === 'admin');
  assert.equal(admin.comodin, true);
  for (const a of json.datos.acciones) {
    assert.ok(a.quienes.includes('admin'), `el admin debería poder: ${a.texto}`);
  }
});

test('un operario aparece solo en lo suyo', async () => {
  const { json } = await llamar('/api/ayuda/permisos');
  const suyas = json.datos.acciones.filter((a) => a.quienes.includes('operario'));
  assert.ok(suyas.length > 0);
  assert.ok(suyas.every((a) => a.grupo === 'Producción'),
    'el operario no debería aparecer fuera de Producción');
});

test('cada acción descrita corresponde a un permiso que alguien tiene', async () => {
  const { json } = await llamar('/api/ayuda/permisos');
  for (const a of json.datos.acciones) {
    assert.ok(a.quienes.length > 0,
      `nadie puede "${a.texto}" (${a.permiso}): o sobra en el manual, o falta el permiso`);
  }
});

test('la ayuda pide sesión: no se lee desde fuera', async () => {
  const r = await sinSesion(() => llamar('/api/ayuda/permisos'));
  assert.equal(r.estado, 401);
});
