import test from 'node:test';
import assert from 'node:assert/strict';
import {certificationDay,untilNextCertificationDay,hasCertification,certificationFailure} from '../lib/certification-ui.ts';
test('certification day rolls over precisely at KST midnight',()=>{
 const before=Date.parse('2026-09-15T14:59:59.999Z');
 assert.equal(certificationDay(before),'2026-09-15');assert.equal(untilNextCertificationDay(before),1);
 assert.equal(certificationDay(before+1),'2026-09-16');assert.equal(untilNextCertificationDay(before+1),86400000);
});
test('only certified records on the current day disable certification',()=>{
 const records=[{date:'2026-09-15',status:'certified'},{date:'2026-09-16',status:'needs_review'}];
 assert.equal(hasCertification(records,'2026-09-15'),true);assert.equal(hasCertification(records,'2026-09-16'),false);
});
test('alerts explain conflicts and never display raw provider details',()=>{
 assert.match(certificationFailure(409),/이미 기록/);
 assert.equal(certificationFailure(503,'stack trace with private provider payload'), '인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
 assert.doesNotMatch(certificationFailure(400,'raw\ntrace'),/\n|trace/);
});
