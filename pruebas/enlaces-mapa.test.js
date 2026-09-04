/**
 * PRUEBAS DEL ENLACE DE GOOGLE MAPS  (v5.7.1)
 *
 * "Si yo pongo el link de Google Maps lo rechaza."
 *
 * Lo rechazaba porque el enlace corto del celular no trae las coordenadas:
 * hay que seguirlo. Aquí se prueba sin internet, con un `traer` de mentira
 * que contesta las redirecciones que contestaría Google.
 */
const test = require('node:test');
const assert = require('node:assert');
const { coordenadasDe, resolverEnlace, hostPermitido } = require('../src/lib/enlaces-mapa');

test('saca las coordenadas de todas las formas en que las manda Google', () => {
  const casos = [
    ['https://www.google.com/maps/place/Hunucm%C3%A1/@21.0163,-89.8756,17z/data=!3m1', 21.0163, -89.8756],
    ['https://www.google.com/maps/place/x/data=!4m6!3m5!8m2!3d21.0163!4d-89.8756', 21.0163, -89.8756],
    ['https://maps.google.com/?q=21.0163,-89.8756', 21.0163, -89.8756],
    ['https://www.google.com/maps/search/?api=1&query=21.0163%2C-89.8756', 21.0163, -89.8756],
    ['https://www.google.com/maps/dir/?api=1&destination=21.0163,-89.8756', 21.0163, -89.8756],
    ['geo:21.0163,-89.8756?z=17', 21.0163, -89.8756],
    ['21.0163, -89.8756', 21.0163, -89.8756],
    ['21.0163;-89.8756', 21.0163, -89.8756]
  ];
  for (const [t, lat, lon] of casos) {
    const p = coordenadasDe(t);
    assert.ok(p, `no salió nada de ${t}`);
    assert.equal(p.lat, lat); assert.equal(p.lon, lon);
  }
});

test('de un enlace corto NO salen coordenadas sin seguirlo', () => {
  assert.equal(coordenadasDe('https://maps.app.goo.gl/AbCdEf12'), null);
});

test('solo se siguen enlaces de Google: cualquier otro se rechaza sin pedirlo', async () => {
  assert.ok(hostPermitido('https://maps.app.goo.gl/x'));
  assert.ok(hostPermitido('https://www.google.com/maps/place/x'));
  assert.ok(hostPermitido('https://google.com.mx/maps'));
  assert.ok(!hostPermitido('https://ejemplo.com/maps.app.goo.gl'));
  assert.ok(!hostPermitido('http://192.168.1.65/'));
  assert.ok(!hostPermitido('file:///etc/passwd'));

  let pidio = 0;
  const traer = async () => { pidio++; return { headers: new Map(), text: async () => '' }; };
  assert.equal(await resolverEnlace('https://ejemplo.com/lo-que-sea', traer), null);
  assert.equal(pidio, 0, 'ni siquiera lo pide');
});

test('el enlace corto del celular se sigue hasta el largo', async () => {
  // Como contesta Google: 302 al enlace largo, que ya trae la chincheta.
  const traer = async (url) => {
    if (url.startsWith('https://maps.app.goo.gl/')) {
      return { headers: new Map([['location',
        'https://www.google.com/maps/place/Abarrotes+Juan/@21.0163,-89.8756,17z/data=!3m1']]),
        text: async () => '' };
    }
    throw new Error('no debería llegar aquí: ' + url);
  };
  const p = await resolverEnlace('https://maps.app.goo.gl/AbCdEf12', traer);
  assert.deepEqual(p, { lat: 21.0163, lon: -89.8756 });
});

test('si la redirección se sale de Google, se para ahí', async () => {
  let pidio = 0;
  const traer = async () => {
    pidio++;
    return { headers: new Map([['location', 'https://malo.com/@21.0,-89.0']]), text: async () => '' };
  };
  // El destino trae coordenadas, pero NO es Google: ni así se usa.
  assert.equal(await resolverEnlace('https://maps.app.goo.gl/x', traer), null);
  assert.equal(pidio, 1);
});

test('si la página final no trae coordenadas en la dirección, se buscan en el cuerpo', async () => {
  const traer = async () => ({
    headers: new Map(),
    text: async () => '<html>…window.APP_INIT=[[…"!3d21.0163!4d-89.8756"…]]</html>'
  });
  const p = await resolverEnlace('https://www.google.com/maps/place/Algo', traer);
  assert.deepEqual(p, { lat: 21.0163, lon: -89.8756 });
});

test('un enlace que no responde no cuelga nada: contesta null', async () => {
  const traer = async () => { throw new Error('se cayó la red'); };
  assert.equal(await resolverEnlace('https://maps.app.goo.gl/x', traer), null);
});
