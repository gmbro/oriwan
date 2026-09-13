import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSupportDate} from '../lib/support-cooldown.ts';
test('후원은 KST 다음 달 같은 시각에 열리고 월말은 말일로 맞춘다',()=>{
 assert.equal(nextSupportDate(new Date('2026-01-31T23:30:00+09:00')),'2026-02-28T14:30:00.000Z');
 assert.equal(nextSupportDate(new Date('2028-01-31T00:30:00+09:00')),'2028-02-28T15:30:00.000Z');
 assert.equal(nextSupportDate(new Date('2026-12-14T00:06:00+09:00')),'2027-01-13T15:06:00.000Z');
});
