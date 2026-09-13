import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMemberUploadEvidence, memberEvidenceIssues } from '../lib/member-upload-contract.ts';
test('start time deadline distinguishes late exercise from unreadable evidence',()=>{
 const draft={distanceKm:3.58,activityTime:'07:59'};
 assert.equal(hasMemberUploadEvidence(draft),true);
 for(const activityTime of ['08:00','23:29']) {
  assert.equal(hasMemberUploadEvidence({...draft,activityTime}),false);
  const message=memberEvidenceIssues({...draft,activityTime}).join(' ');
  assert.ok(message.includes(activityTime)); assert.ok(message.includes('오전 8시 이전')); assert.ok(!message.includes('읽지 못'));
 }
 assert.match(memberEvidenceIssues({...draft,activityTime:null}).join(' '),/읽지 못/);
});
