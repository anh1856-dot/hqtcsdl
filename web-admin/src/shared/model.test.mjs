import test from 'node:test';
import assert from 'node:assert/strict';
import { date, schedulableTrays, todayIso } from './model.mjs';

test('date() shows SQL DATE strings without shifting the day', () => {
  assert.equal(date('2026-11-15'), '15/11/2026');
  assert.equal(date(null), '—');
});

test('todayIso uses the local calendar date', () => {
  assert.equal(todayIso(new Date(2026, 10, 15, 0, 30)), '2026-11-15');
});

test('schedulableTrays keeps only growing / ready trays (UC36)', () => {
  const trays = ['Available', 'Rented', 'Growing', 'ReadyToHarvest', 'Harvested', 'Maintenance']
    .map((Status, TrayId) => ({ TrayId, Status }));
  assert.deepEqual(schedulableTrays(trays).map((t) => t.Status), ['Growing', 'ReadyToHarvest']);
  assert.deepEqual(schedulableTrays(), []);
});
