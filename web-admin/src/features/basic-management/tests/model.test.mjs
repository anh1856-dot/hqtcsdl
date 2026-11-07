import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUsersPath, fieldPayload, initialValues, validateFields, formatMoney } from '../model.mjs';

test('validates required, positive integers and optional nonnegative yield', () => {
  const fields = [
    { name: 'name', required: true }, { name: 'days', type: 'number', required: true, integer: true, min: 1 },
    { name: 'yield', type: 'number', min: 0, step: '0.01' },
  ];
  assert.deepEqual(validateFields(fields, { name: ' Nấm ', days: '28', yield: '' }), {});
  assert.deepEqual(validateFields(fields, { name: 'Nấm', days: '1', yield: '0' }), {});
  for (const days of ['0', '-1', '1.5', 'NaN', 'Infinity']) assert.ok(validateFields(fields, { name: 'Nấm', days }).days);
  assert.ok(validateFields(fields, { name: ' ', days: '1', yield: '-1' }).name);
  assert.ok(validateFields(fields, { name: 'Nấm', days: '1', yield: '-1' }).yield);
  assert.ok(validateFields(fields, { name: 'Nấm', days: '1', yield: '0.123' }).yield);
});

test('validates email, safe image URL, password and enum values', () => {
  const fields = [
    { name: 'email', type: 'email' }, { name: 'image', type: 'url' },
    { name: 'password', type: 'password' }, { name: 'role', options: [{ value: 'Admin' }] },
  ];
  assert.deepEqual(validateFields(fields, { email: 'a@example.test', image: 'https://example.test/image.png', password: 'abcdef', role: 'Admin' }), {});
  const errors = validateFields(fields, { email: 'bad', image: 'javascript:alert(1)', password: '123', role: 'Owner' });
  assert.equal(Object.keys(errors).length, 4);
});

test('maps PascalCase response and sends only allowed camelCase fields', () => {
  const fields = [
    { name: 'roomCode', source: 'RoomCode', createOnly: true },
    { name: 'capacity', source: 'Capacity', type: 'number' },
    { name: 'description', source: 'Description' },
  ];
  const row = { RoomCode: 'R01', Capacity: 12, Description: null };
  assert.deepEqual(initialValues(fields, row), { roomCode: 'R01', capacity: 12, description: '' });
  assert.deepEqual(fieldPayload(fields, { roomCode: 'R99', capacity: '15', description: '' }, row), { capacity: 15, description: null });
});

test('converts package status to boolean and keeps zero prices', () => {
  const fields = [{ name: 'isActive', type: 'boolean' }, { name: 'pricePerTray', type: 'number' }];
  assert.deepEqual(fieldPayload(fields, { isActive: false, pricePerTray: '0' }), { isActive: false, pricePerTray: 0 });
  assert.equal(fieldPayload(fields, { isActive: 'true', pricePerTray: '1' }).isActive, true);
});

test('does not trim passwords or include unrelated fields in payload', () => {
  const payload = fieldPayload([{ name: 'newPassword', type: 'password' }], { newPassword: ' abcdef ', PasswordHash: 'never-send' });
  assert.deepEqual(payload, { newPassword: ' abcdef ' });
});

test('encodes search and includes server-side filters and pagination', () => {
  const path = buildUsersPath({ q: ' An & Bình ', role: 'Customer', status: 'Disabled', page: 2, pageSize: 20 });
  const url = new URL(path, 'https://example.test');
  assert.equal(url.pathname, '/users');
  assert.equal(url.searchParams.get('q'), 'An & Bình');
  assert.equal(url.searchParams.get('role'), 'Customer');
  assert.equal(url.searchParams.get('status'), 'Disabled');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('pageSize'), '20');
  assert.match(formatMoney(150000), /150\.000/);
});
