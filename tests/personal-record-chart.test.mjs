import test from 'node:test';
import assert from 'node:assert/strict';
import { personalRecordChart } from '../lib/personal-record-chart.ts';
const record = (date, status = 'certified', distanceKm = 3, durationSeconds = 1200) => ({ date, status, distanceKm, durationSeconds });
test('weekly buckets use Monday, exclude future and rejected, include pending metrics', () => {
 const result = personalRecordChart([record('2026-09-13'),record('2026-09-14','needs_review'),record('2026-09-14','rejected'),record('2026-09-15')], '2026-09-14','week');
 assert.equal(result.start,'2026-09-14'); assert.equal(result.buckets.length,1); assert.equal(result.buckets[0].distance,3); assert.equal(result.buckets[0].minutes,20);
});
test('monthly zero days and total month buckets preserve sums across year boundaries', () => {
 const rows = [record('2026-12-31'),record('2027-01-02','certified',5,600)];
 const monthly = personalRecordChart(rows,'2027-01-03','month'); assert.equal(monthly.buckets.length,3); assert.equal(monthly.buckets[0].distance,0);
 const total = personalRecordChart(rows,'2027-01-03','total'); assert.deepEqual(total.buckets.map(b=>b.distance),[3,5]);
 assert.equal(personalRecordChart([],'2027-01-03','total').buckets[0].distance,0);
});
