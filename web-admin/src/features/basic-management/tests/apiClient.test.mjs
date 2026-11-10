import test from 'node:test';
import assert from 'node:assert/strict';
import { createBasicManagementClient, BasicManagementApiError } from '../apiClient.mjs';

test('uses injected token, base URL, JSON body and abort signal', async () => {
  const controller = new AbortController();
  let captured;
  const client = createBasicManagementClient({
    baseUrl: 'https://example.test/api/', getToken: async () => 'test-token',
    fetchImpl: async (url, options) => { captured = { url, options }; return Response.json({ data: { RoomId: 1 } }, { status: 201 }); },
  });
  const result = await client.request('/rooms', { method: 'POST', body: { capacity: 5 }, signal: controller.signal });
  assert.equal(captured.url, 'https://example.test/api/rooms');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-token');
  assert.equal(captured.options.headers['Content-Type'], 'application/json');
  assert.equal(captured.options.body, '{"capacity":5}');
  assert.equal(captured.options.signal, controller.signal);
  assert.equal(result.data.RoomId, 1);
});

test('public requests do not invent credentials; DELETE 204 does not parse JSON', async () => {
  const client = createBasicManagementClient({ fetchImpl: async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.body, undefined);
    return new Response(null, { status: 204 });
  } });
  assert.deepEqual(await client.request('/packages/1', { method: 'DELETE' }), { data: null });
});

test('preserves backend business error messages and status', async () => {
  const client = createBasicManagementClient({ fetchImpl: async () => Response.json({ error: { message: 'Phòng đang có khay.', code: 'IN_USE' } }, { status: 409 }) });
  await assert.rejects(client.request('/rooms/1'), (error) => error instanceof BasicManagementApiError && error.status === 409 && error.message === 'Phòng đang có khay.' && error.code === 'IN_USE');
});

test('invokes injected session handler on 401, including non-JSON failures', async () => {
  let calls = 0;
  const client = createBasicManagementClient({ onUnauthorized: () => { calls++; }, fetchImpl: async () => new Response('', { status: 401 }) });
  await assert.rejects(client.request('/users'), (error) => error.status === 401);
  assert.equal(calls, 1);
});

test('reports 403, malformed success and connection failure without fake data', async () => {
  for (const response of [new Response('', { status: 403 }), Response.json({ unexpected: [] })]) {
    const client = createBasicManagementClient({ fetchImpl: async () => response });
    await assert.rejects(client.request('/rooms'), BasicManagementApiError);
  }
  const offline = createBasicManagementClient({ fetchImpl: async () => { throw new TypeError('offline'); } });
  await assert.rejects(offline.request('/rooms'), /Không thể kết nối/);
});

test('preserves abort errors and rejects external paths before sending credentials', async () => {
  let calls = 0;
  const client = createBasicManagementClient({ fetchImpl: async () => { calls++; throw new DOMException('Aborted', 'AbortError'); } });
  for (const path of ['https://outside.test', '//outside.test', 'rooms']) await assert.rejects(client.request(path), /Đường dẫn API/);
  assert.equal(calls, 0);
  await assert.rejects(client.request('/rooms'), (error) => error.name === 'AbortError');
});
