import test from 'node:test';
import assert from 'node:assert/strict';
import { createRentalsClient, RentalsApiError } from '../api.mjs';

test('injects authentication and forwards exact assignment body and signal', async () => {
  const abort = new AbortController();
  let captured;
  const client = createRentalsClient({ baseUrl: 'https://example.test/api/', getToken: async () => 'mock-token', fetchImpl: async (url, options) => {
    captured = { url, options }; return Response.json({ data: { rentalId: 9 } }, { status: 201 });
  } });
  const body = { customerId: 4, packageId: 1, trayCode: 'T01', paymentMethod: 'Cash' };
  assert.deepEqual(await client.request('/rentals/assign', { method: 'POST', body, signal: abort.signal }), { data: { rentalId: 9 } });
  assert.equal(captured.url, 'https://example.test/api/rentals/assign');
  assert.equal(captured.options.headers.Authorization, 'Bearer mock-token');
  assert.equal(captured.options.signal, abort.signal);
  assert.deepEqual(JSON.parse(captured.options.body), body);
});

test('business errors preserve 400/401/403/404/409 and backend message', async () => {
  for (const status of [400, 401, 403, 404, 409]) {
    const client = createRentalsClient({ fetchImpl: async () => Response.json({ error: { message: 'Khay đã được thuê.', code: 'DB_50006' } }, { status }) });
    await assert.rejects(client.request('/rentals/assign', { method: 'POST', body: {} }), (error) => error instanceof RentalsApiError && error.status === status && error.code === 'DB_50006' && error.message === 'Khay đã được thuê.');
  }
});

test('network failures on writes explain uncertain outcome and never retry automatically', async () => {
  let requests = 0;
  const client = createRentalsClient({ fetchImpl: async () => { requests++; throw new TypeError('offline'); } });
  await assert.rejects(client.request('/rentals/assign', { method: 'POST', body: {} }), (error) => error.code === 'UNCONFIRMED' && /kiểm tra danh sách đơn/.test(error.message));
  assert.equal(requests, 1);
  await assert.rejects(client.request('/rentals'), (error) => error.code === 'NETWORK');
});

test('invalid successful envelopes cannot masquerade as a confirmed assignment', async () => {
  const client = createRentalsClient({ fetchImpl: async () => Response.json({ unexpected: true }) });
  await assert.rejects(client.request('/rentals'), (error) => error.code === 'BAD_RESPONSE');
  await assert.rejects(client.request('/rentals/assign', { method: 'POST', body: {} }), (error) => error.code === 'UNCONFIRMED');
});

test('supports 204 and safe fallback messages for non-JSON errors', async () => {
  const empty = createRentalsClient({ fetchImpl: async () => new Response(null, { status: 204 }) });
  assert.deepEqual(await empty.request('/rentals'), { data: null });
  for (const status of [401, 403, 404]) {
    const client = createRentalsClient({ fetchImpl: async () => new Response('error', { status }) });
    await assert.rejects(client.request('/rentals'), (error) => error.status === status && error.message.length > 0);
  }
});

test('does not manufacture tokens, preserves aborts and blocks external credential destinations', async () => {
  let requests = 0;
  const client = createRentalsClient({ fetchImpl: async (url, options) => {
    requests++; assert.equal(options.headers.Authorization, undefined); throw new DOMException('Aborted', 'AbortError');
  } });
  for (const path of ['https://outside.test', '//outside.test', 'rentals']) await assert.rejects(client.request(path), /Đường dẫn API/);
  assert.equal(requests, 0);
  await assert.rejects(client.request('/rentals'), (error) => error.name === 'AbortError');
});
