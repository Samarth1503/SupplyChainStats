const test = require('node:test');
const assert = require('node:assert');
const app = require('../app');
const data = require('../data/logistics.json');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // port 0 = any free port
  });
  baseUrl = 'http://localhost:' + server.address().port;
});

test.after(() => {
  server.close();
});

async function request(path, method) {
  const response = await fetch(baseUrl + path, { method: method || 'GET' });
  const body = await response.json();
  return { status: response.status, body: body, headers: response.headers };
}

test('BE-01 health check', async () => {
  const { status, body } = await request('/api/health');
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(body, { status: 'ok' });
});

test('BE-02 destinations list', async () => {
  const { status, body } = await request('/api/destinations');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.length, 5);
  body.forEach((item) => {
    assert.strictEqual(typeof item.country, 'string');
    assert.strictEqual(typeof item.city, 'string');
    assert.strictEqual(typeof item.code, 'string');
  });
});

test('BE-03 shipments by destination', async () => {
  const { status, body } = await request('/api/shipments?destination=Great%20Britain');
  assert.strictEqual(status, 200);
  assert.ok(body.length > 0);
  const modes = new Set(body.map((s) => s.mode));
  assert.ok(modes.has('Plane') && modes.has('Ferry'));
  body.forEach((s) => {
    assert.strictEqual(s.destinationCountry, 'England');
    ['id', 'mode', 'departureDate', 'arrivalDate', 'status', 'weightKg', 'costUsd'].forEach((field) => {
      assert.ok(field in s, 'missing field ' + field);
    });
  });
  for (let i = 1; i < body.length; i++) {
    assert.ok(body[i - 1].departureDate <= body[i].departureDate, 'not sorted ascending');
  }
});

test('BE-04 mode filter', async () => {
  for (const mode of ['Plane', 'Ferry']) {
    const { status, body } = await request('/api/shipments?destination=Great%20Britain&mode=' + mode);
    assert.strictEqual(status, 200);
    assert.ok(body.length > 0);
    body.forEach((s) => assert.strictEqual(s.mode, mode));
  }
});

test('BE-05 zero matching results returns an empty list', async () => {
  const { status, body } = await request('/api/shipments?destination=Japan&mode=Ferry');
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(body, []);
});

test('BE-06 tariffs for England', async () => {
  const { status, body } = await request('/api/tariffs?destination=Great%20Britain');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.planePerKg, 14);
  assert.strictEqual(body.ferryPerKg, 4.7);
});

test('BE-07 tariff without ferry service', async () => {
  const { status, body } = await request('/api/tariffs?destination=Japan');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.ferryPerKg, null);
  assert.strictEqual(typeof body.planePerKg, 'number');
});

test('BE-08 customer level', async () => {
  const { status, body } = await request('/api/level');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.levelName, 'Gold');
  assert.strictEqual(body.friendPaymentPercent, 5);
  assert.strictEqual(body.redemptionPercent, 10);
  assert.ok(body.kgBought < body.kgRequiredForRenewal);
});

test('BE-09 stats are correct', async () => {
  const { status, body } = await request('/api/stats');
  assert.strictEqual(status, 200);

  // Recompute the expected numbers with plain loops (different code from the API).
  let weight = 0;
  let revenue = 0;
  const statusCount = { Arrived: 0, 'In transit': 0, Scheduled: 0 };
  const planes = [];
  for (const s of data.shipments) {
    weight += s.weightKg;
    revenue += s.costUsd;
    statusCount[s.status]++;
    if (s.mode === 'Plane') {
      planes.push((new Date(s.arrivalDate) - new Date(s.departureDate)) / 86400000);
    }
  }
  const planeAverage = planes.reduce((a, b) => a + b, 0) / planes.length;

  assert.strictEqual(body.totalShipments, data.shipments.length);
  assert.ok(Math.abs(body.totalWeightKg - weight) < 0.1);
  assert.ok(Math.abs(body.totalRevenueUsd - revenue) < 0.01);
  assert.deepStrictEqual(body.byStatus, statusCount);
  assert.strictEqual(body.byMode.Plane.shipments + body.byMode.Ferry.shipments, body.totalShipments);
  assert.ok(Math.abs(body.byMode.Plane.avgTransitDays - planeAverage) < 0.1);
  const destinationTotal = body.byDestination.reduce((sum, d) => sum + d.shipments, 0);
  assert.strictEqual(destinationTotal, body.totalShipments);
  const monthTotal = body.monthly.reduce((sum, m) => sum + m.shipments, 0);
  assert.strictEqual(monthTotal, body.totalShipments);
});

test('BE-10 missing destination returns 400', async () => {
  for (const path of ['/api/shipments', '/api/tariffs']) {
    const { status, body } = await request(path);
    assert.strictEqual(status, 400);
    assert.strictEqual(typeof body.error, 'string');
  }
});

test('BE-11 empty or whitespace destination returns 400', async () => {
  for (const path of ['/api/shipments?destination=', '/api/shipments?destination=%20%20']) {
    const { status, body } = await request(path);
    assert.strictEqual(status, 400);
    assert.strictEqual(typeof body.error, 'string');
  }
});

test('BE-12 repeated destination parameter returns 400', async () => {
  const { status, body } = await request('/api/shipments?destination=Japan&destination=USA');
  assert.strictEqual(status, 400);
  assert.strictEqual(typeof body.error, 'string');
});

test('BE-13 unknown destination returns 404', async () => {
  for (const path of ['/api/shipments?destination=Narnia', '/api/tariffs?destination=Narnia']) {
    const { status, body } = await request(path);
    assert.strictEqual(status, 404);
    assert.strictEqual(typeof body.error, 'string');
  }
});

test('BE-14 destination match is case sensitive', async () => {
  const { status } = await request('/api/shipments?destination=great%20britain');
  assert.strictEqual(status, 404);
});

test('BE-15 invalid mode returns 400', async () => {
  for (const mode of ['Train', 'plane']) {
    const { status, body } = await request('/api/shipments?destination=Japan&mode=' + mode);
    assert.strictEqual(status, 400);
    assert.strictEqual(typeof body.error, 'string');
  }
});

test('BE-16 unknown route returns JSON 404', async () => {
  for (const path of ['/api/nothing', '/']) {
    const { status, body } = await request(path);
    assert.strictEqual(status, 404);
    assert.deepStrictEqual(body, { error: 'Route not found' });
  }
});

test('BE-17 wrong HTTP method returns JSON 404', async () => {
  const post = await request('/api/shipments?destination=Japan', 'POST');
  assert.strictEqual(post.status, 404);
  assert.deepStrictEqual(post.body, { error: 'Route not found' });
  const del = await request('/api/level', 'DELETE');
  assert.strictEqual(del.status, 404);
});

test('BE-18 unexpected error returns generic 500 and the server keeps working', async () => {
  const original = data.shipments;
  data.shipments = null; // makes the stats code throw a real TypeError
  try {
    const { status, body } = await request('/api/stats');
    assert.strictEqual(status, 500);
    assert.deepStrictEqual(body, { error: 'Something went wrong on the server' });
  } finally {
    data.shipments = original;
  }
  const after = await request('/api/health');
  assert.strictEqual(after.status, 200);
});

test('BE-19 CORS header is present', async () => {
  const { headers } = await request('/api/health');
  assert.strictEqual(headers.get('access-control-allow-origin'), '*');
});

test('BE-21 dataset integrity', () => {
  const asOf = data.meta.asOfDate;
  const countries = data.destinations.map((d) => d.country);
  const ids = new Set();
  let destinationWithoutFerry = 0;

  for (const s of data.shipments) {
    assert.ok(!ids.has(s.id), 'duplicate id ' + s.id);
    ids.add(s.id);
    assert.ok(['Plane', 'Ferry'].includes(s.mode), s.id + ' has invalid mode');
    assert.ok(['Arrived', 'In transit', 'Scheduled'].includes(s.status), s.id + ' has invalid status');
    assert.ok(countries.includes(s.destinationCountry), s.id + ' has unknown destination');
    assert.ok(s.arrivalDate >= s.departureDate, s.id + ' arrives before it departs');

    if (s.status === 'Arrived') assert.ok(s.arrivalDate <= asOf, s.id + ' status mismatch');
    if (s.status === 'In transit') {
      assert.ok(s.departureDate <= asOf && s.arrivalDate > asOf, s.id + ' status mismatch');
    }
    if (s.status === 'Scheduled') assert.ok(s.departureDate > asOf, s.id + ' status mismatch');

    const tariff = data.tariffs.find((t) => t.destinationCountry === s.destinationCountry);
    const rate = s.mode === 'Plane' ? tariff.planePerKg : tariff.ferryPerKg;
    assert.ok(rate !== null, s.id + ' uses a mode with no tariff');
    assert.ok(Math.abs(s.costUsd - s.weightKg * rate) < 0.01, s.id + ' cost does not match weight x tariff');
  }

  for (const country of countries) {
    const hasFerry = data.shipments.some((s) => s.destinationCountry === country && s.mode === 'Ferry');
    if (!hasFerry) destinationWithoutFerry++;
  }
  assert.ok(destinationWithoutFerry >= 1, 'need one destination without ferry for the empty-list case');
});
