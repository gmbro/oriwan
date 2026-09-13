import assert from 'node:assert/strict';
import test from 'node:test';
import { getCrewGoals } from '../lib/crew-goals.ts';

test('목표 경계에서 체크하고 다음 목표만 공개한다', () => {
  const states = value => getCrewGoals(value).map(goal => goal.state);
  assert.deepEqual(states(0), ['active', 'locked', 'locked', 'locked']);
  assert.deepEqual(states(999.999), states(0));
  assert.deepEqual(states(1000), ['completed', 'active', 'locked', 'locked']);
  assert.deepEqual(states(2027), ['completed', 'completed', 'active', 'locked']);
  assert.deepEqual(states(5000), ['completed', 'completed', 'completed', 'active']);
  assert.deepEqual(states(10000), ['completed', 'completed', 'completed', 'completed']);
  assert.deepEqual(states(12000), states(10000));
});

test('잘못된 집계와 승인 취소 시 거짓 달성을 유지하지 않는다', () => {
  for (const value of [-1, NaN, Infinity]) assert.equal(getCrewGoals(value)[0].state, 'active');
  assert.equal(getCrewGoals(2027)[1].state, 'completed');
  assert.equal(getCrewGoals(2026.9)[1].state, 'active');
});
