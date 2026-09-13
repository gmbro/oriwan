import test from 'node:test';
import assert from 'node:assert/strict';
import { memberEvidenceIssues, hasMemberUploadEvidence } from '../lib/member-upload-contract.ts';
const base={activityTime:'07:30',distanceKm:5};
test('missing time and missing distance have separate actionable explanations',()=>{
 assert.equal(memberEvidenceIssues(base).length,0);
 assert.match(memberEvidenceIssues({...base,activityTime:null})[0],/시작 시각/);
 assert.match(memberEvidenceIssues({...base,distanceKm:null})[0],/운동 거리/);
 assert.equal(memberEvidenceIssues({}).length,2);
 assert.equal(hasMemberUploadEvidence({...base,activityTime:null}),false);
});
test('server failure reason is preserved instead of blaming screenshot',()=>{
 assert.deepEqual(memberEvidenceIssues({analysisError:'timeout',warning:'인식 서버 응답 시간이 초과됐어요.'}),['인식 서버 응답 시간이 초과됐어요.']);
});
