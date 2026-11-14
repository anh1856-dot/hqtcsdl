import test from 'node:test';
import assert from 'node:assert/strict';
import { apiBase, createApi } from './api.mjs';
import {
  actuators,
  deliveryNext,
  formBody,
  readingState,
  stages,
  validate,
} from './model.mjs';

test('absolute API URL is valid for dev, preview and static builds', () => {
  assert.equal(
    apiBase('http://localhost:3000/api/'),
    'http://localhost:3000/api',
  );
  for (const input of [
    '/api',
    'javascript:bad',
    'http://user:secret@example.test/api',
    'https://example.test/api?x=1',
  ])
    assert.throws(() => apiBase(input));
});
test('authenticated CSV download uses configured API and rejects JSON masquerading as CSV', async () => {
  let capture;
  const api = createApi({
    baseUrl: 'http://example.test/api',
    getToken: () => 'test-only',
    fetchImpl: async (url, options) => {
      capture = { url, options };
      return new Response('Revenue\r\n100', {
        headers: { 'Content-Type': 'text/csv' },
      });
    },
  });
  assert.equal(
    await (
      await api.request('/reports/revenue?format=csv', { download: true })
    ).text(),
    'Revenue\r\n100',
  );
  assert.equal(capture.options.headers.Authorization, 'Bearer test-only');
  assert.equal(
    capture.url,
    'http://example.test/api/reports/revenue?format=csv',
  );
  const bad = createApi({
    baseUrl: 'http://example.test/api',
    getToken: () => null,
    fetchImpl: async () => Response.json({ data: [] }),
  });
  await assert.rejects(
    bad.request('/reports/revenue', { download: true }),
    /CSV/,
  );
});
test('401 expires host session; 403 preserves session and business error', async () => {
  let expired = 0;
  for (const status of [401, 403]) {
    const api = createApi({
      baseUrl: 'http://example.test/api',
      getToken: () => 'test',
      onUnauthorized: () => expired++,
      fetchImpl: async () =>
        Response.json(
          { error: { message: 'Không có quyền.', code: 'DENIED' } },
          { status },
        ),
    });
    await assert.rejects(
      api.request('/devices'),
      (e) => e.status === status && e.code === 'DENIED',
    );
  }
  assert.equal(expired, 1);
});
test('writes are never automatically retried on ambiguous network failure', async () => {
  let calls = 0;
  const api = createApi({
    baseUrl: 'http://example.test/api',
    getToken: () => '',
    fetchImpl: async () => {
      calls++;
      throw new TypeError();
    },
  });
  await assert.rejects(
    api.request('/trays/1/harvest', { method: 'POST', body: { weightKg: 1 } }),
    /Kiểm tra dữ liệu/,
  );
  assert.equal(calls, 1);
});
test('forms validate required numbers, decimal precision, passwords and allowed options', () => {
  const fields = [
    {
      name: 'qty',
      type: 'number',
      integer: true,
      min: 1,
      max: 100,
      required: true,
    },
    { name: 'weight', type: 'number', step: '0.01' },
    { name: 'password', type: 'password' },
    { name: 'status', options: [{ value: 'Active' }] },
  ];
  const errors = validate(fields, {
    qty: '1.2',
    weight: '0.123',
    password: '12',
    status: 'Unknown',
  });
  assert.equal(Object.keys(errors).length, 4);
  assert.deepEqual(
    validate(fields, {
      qty: '1',
      weight: '0',
      password: '123456',
      status: 'Active',
    }),
    {},
  );
});
test('body retains password whitespace, booleans and numbers and omits unavailable room changes', () => {
  assert.deepEqual(
    formBody(
      [
        { name: 'password', type: 'password' },
        { name: 'isSimulated', type: 'checkbox' },
        { name: 'roomId', type: 'number', omitEmpty: true },
        { name: 'weightKg', type: 'number' },
      ],
      { password: ' secret ', isSimulated: false, roomId: '', weightKg: '0' },
    ),
    { password: ' secret ', isSimulated: false, weightKg: 0 },
  );
});
test('reading status distinguishes missing data and old measurements', () => {
  const now = Date.parse('2026-11-10T10:00:00Z');
  assert.match(readingState(null, now), /Chưa/);
  assert.match(readingState('2026-11-10T09:00:00Z', now), /cũ/);
  assert.match(readingState('2026-11-10T09:59:00Z', now), /gần/);
});
test('backend transition rules and actuator/stage sets do not invent unsupported actions', () => {
  assert.deepEqual(deliveryNext.Completed, []);
  assert.equal(deliveryNext.Pending.includes('Shipping'), false);
  assert.equal(actuators.includes('Camera'), false);
  assert.deepEqual(stages.slice(stages.indexOf('Fruiting') + 1), ['Harvest']);
});
