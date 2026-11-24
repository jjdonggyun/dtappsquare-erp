import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueJobs } from '../scripts/ubuntu-scheduler.mjs';

test('weekday 09:00 Seoul schedules operational alerts and hourly settlement', () => {
  const jobs = dueJobs(new Date('2026-11-24T00:00:00Z'), false);
  assert.deepEqual(jobs.map((job) => job.path), ['/api/internal/monthly-card-settlement', '/api/internal/operational-alerts']);
  assert.equal(dueJobs(new Date('2026-11-22T00:00:00Z'), false).length, 1);
  assert.equal(dueJobs(new Date('2026-11-24T00:01:00Z'), false).length, 0);
});
test('mail dispatch is optional and uses the dispatcher secret every five minutes', () => {
  const now = new Date('2026-11-24T01:05:00Z');
  assert.deepEqual(dueJobs(now, false), []);
  assert.deepEqual(dueJobs(now, true), [{ path: '/api/internal/email-dispatch', method: 'POST', secret: 'EMAIL_DISPATCH_SECRET' }]);
});
