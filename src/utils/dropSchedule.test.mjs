import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDropDate, getDropTime } from './dropSchedule.js';

test('parseDropDate returns null for empty values', () => {
  assert.equal(parseDropDate(''), null);
  assert.equal(parseDropDate(undefined), null);
});

test('parseDropDate returns null for invalid dates', () => {
  assert.equal(parseDropDate('not-a-date'), null);
});

test('parseDropDate and getDropTime work for valid dates', () => {
  const parsed = parseDropDate('2026-07-20T12:00:00.000Z');
  assert.ok(parsed instanceof Date);
  assert.equal(getDropTime('2026-07-20T12:00:00.000Z'), parsed.getTime());
});
