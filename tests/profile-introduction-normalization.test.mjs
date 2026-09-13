import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfileIntroduction as normalize } from '../lib/hello-2027-profile-introduction-contract.ts';
test('pasted Korean introduction preserves joined emoji and removes invisible paste marks',()=>{
 const text='안녕하세요. 운동을 시작합니다. 화이팅🏋️‍♂️';
 assert.equal(normalize('\ufeff'+text+'\u200b'),text);
 assert.equal(normalize('안녕\r\n  반가워요'), '안녕 반가워요');
});
test('normalization does not truncate long input or coerce invalid payloads',()=>{
 assert.equal(normalize('가'.repeat(321)).length,321);
 assert.equal(normalize(null),null);
 assert.equal(normalize('\u202e  \u200b'), '');
});
