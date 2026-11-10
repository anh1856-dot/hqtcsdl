import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentBody, calendarDate, canManageRentals, customersPath, money, positiveId, rentalsPath, validateAssignment } from '../model.mjs';

const customer = { UserId: 4, FullName: 'Khách thử', Role: 'Customer', Status: 'Active', IsDeleted: false };
const packages = [{ PackageId: 1, IsActive: true }, { PackageId: 2, IsActive: false }];
const trays = [{ TrayCode: 'TRAY-R01-001', Status: 'Available' }, { TrayCode: 'TRAY-R01-002', Status: 'Rented' }];
const valid = { customer, packageId: '1', trayCode: 'TRAY-R01-001', paymentMethod: 'Cash' };

test('requires identified Admin/Operator, rejects guests and Customer', () => {
  assert.equal(canManageRentals({ id: 1, role: 'Admin' }), true);
  assert.equal(canManageRentals({ UserId: '2', Role: 'Operator' }), true);
  for (const user of [null, {}, { role: 'Admin' }, { id: true, role: 'Admin' }, { id: 3, role: 'Customer' }, { id: 1, role: 'admin' }]) {
    assert.equal(canManageRentals(user), false);
  }
});

test('validates database integer identifiers rather than coercing arbitrary values', () => {
  for (const value of [null, undefined, '', ' ', true, [], {}, -1, 0, 1.5, '1e2', 2147483648]) assert.equal(positiveId(value), null);
  assert.equal(positiveId(' 12 '), 12);
});

test('builds only supported rental filters and pagination, without pretending to search rentals', () => {
  const url = new URL(rentalsPath({ status: 'Active', customerId: 4, page: 3, pageSize: 20, q: 'unsupported' }), 'https://example.test');
  assert.equal(url.pathname, '/rentals');
  assert.deepEqual(Object.fromEntries(url.searchParams), { page: '3', pageSize: '20', status: 'Active', customerId: '4' });
});

test('customer search is server-side and only assignment requires active customers', () => {
  const active = new URL(customersPath({ q: ' An & Bình ', page: 2, activeOnly: true }), 'https://example.test');
  assert.equal(active.searchParams.get('q'), 'An & Bình');
  assert.equal(active.searchParams.get('page'), '2');
  assert.equal(active.searchParams.get('role'), 'Customer');
  assert.equal(active.searchParams.get('status'), 'Active');
  assert.equal(new URL(customersPath(), 'https://example.test').searchParams.has('status'), false);
});

test('assignment requires active customer, active package, available tray and a valid payment method', () => {
  assert.deepEqual(validateAssignment(valid, packages, trays), {});
  const bad = validateAssignment({ ...valid, customer: { ...customer, Status: 'Disabled' }, packageId: 2, trayCode: 'TRAY-R01-002', paymentMethod: 'Crypto' }, packages, trays);
  assert.deepEqual(Object.keys(bad).sort(), ['customer', 'packageId', 'paymentMethod', 'trayCode']);
  for (const changedCustomer of [null, { ...customer, IsDeleted: true }, { ...customer, Role: 'Admin' }]) {
    assert.ok(validateAssignment({ ...valid, customer: changedCustomer }, packages, trays).customer);
  }
});

test('stale package/tray choices cannot pass validation after refresh', () => {
  const errors = validateAssignment(valid, [], []);
  assert.ok(errors.packageId); assert.ok(errors.trayCode);
});

test('assignment payload maps camelCase and never invents a final price or operator ID', () => {
  assert.deepEqual(assignmentBody({ ...valid, trayCode: ' tray-r01-001 ', TotalAmount: 0, operatorId: 99 }), {
    customerId: 4, packageId: 1, trayCode: 'TRAY-R01-001', paymentMethod: 'Cash',
  });
});

test('formats calendar dates without timezone shifts and VND including zero', () => {
  assert.equal(calendarDate('2026-11-07'), '07/11/2026');
  assert.equal(calendarDate('2026-11-07T00:00:00.000Z'), '07/11/2026');
  assert.equal(calendarDate(null), '—');
  assert.match(money(150000), /150\.000/);
  assert.match(money(0), /0/);
  assert.equal(money(null), '—');
});
