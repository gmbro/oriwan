import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/participant-account-server.ts',import.meta.url),'utf8');
const slice=source.slice(source.indexOf('export async function ensureParticipantAccount('),source.indexOf('export function participantAccountMutationError'));
const js=ts.transpileModule(slice,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('export async','async');
function setup(status){let stored;let writes=0;let calls=0;const resolutions=[{status,adminUserId:'admin'},{status:'pending',adminUserId:'admin'}];
 const dependencies={resolveParticipantAccount:async()=>resolutions[Math.min(calls++,1)],promoteApprovedLegacyHiddenParticipant:async(_s,_u,r)=>r,getAutomaticFourthParticipantId:()=> 'draft',FOURTH_SEASON_KEY:'4th',normalizeAutomaticFourthParticipantName:n=>n,LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER:-1,isUniqueViolation:e=>e.code==='23505'};
 const service={from:table=>({upsert:payload=>{writes++;assert.equal(payload.display_order,-1);return{select:()=>({single:async()=>({})})};},insert:async payload=>{writes++;stored=payload;return{};}})};
 return{run:new Function(...Object.keys(dependencies),`${js};return ensureParticipantAccount;`)(...Object.values(dependencies)).bind(null,service,'auth','새멤버'),stored:()=>stored,writes:()=>writes};}
test('처음 로그인은 숨긴 참가자 초안과 pending 계정만 만든다',async()=>{const h=setup('unlinked');assert.equal((await h.run()).status,'pending');assert.equal(h.stored().status,'pending');assert.equal(h.stored().approved_at,null);assert.equal(h.stored().approved_by,null);});
test('승인 대기·철회·기존 승인 계정은 재로그인으로 상태를 덮어쓰지 않는다',async()=>{for(const status of ['pending','revoked','approved']){const h=setup(status);assert.equal((await h.run()).status,status);assert.equal(h.writes(),0);}});
