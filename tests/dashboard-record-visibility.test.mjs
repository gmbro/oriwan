import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/dashboard-record-visibility.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace('export function','function');
const project=new Function(`${js}; return projectDashboardRecords;`)();
test('spectators receive approved totals but no pending rows, calendar or private fields',()=>{
 const rows=[{recordDateIso:'2026-09-13',status:'certified',distanceKm:5,durationMinutes:30},{recordDateIso:'2026-09-14',status:'certified',distanceKm:3,durationMinutes:20},{recordDateIso:'2026-09-14',status:'needs_review',distanceKm:99,durationMinutes:99},{recordDateIso:'2026-09-15',status:'certified',distanceKm:88,durationMinutes:88}];
 const member={id:'a',fullName:'러너',product:{name:'소개',description:'private legacy memo'},recordHistory:rows,completed:true,seasonCompletionRate:80,distanceKm:99,durationMinutes:99,certifiedDays:2,totalDistanceKm:195,totalDurationMinutes:237,privateFutureField:'secret'};
 const snapshot={referenceDateIso:'2026-09-14',participants:[member],guestbook:[{body:'private comment'}]};
 const out=project(snapshot,false); const p=out.participants[0];
 assert.equal(p.totalDistanceKm,8);assert.equal(p.totalDurationMinutes,50);assert.equal(p.weeklyDistanceKm,3);assert.equal(p.weeklyDurationMinutes,20);assert.equal(p.certifiedDays,2);
 assert.deepEqual(p.recordHistory,[]);assert.equal(p.distanceKm,null);assert.equal(p.durationMinutes,null);assert.equal('privateFutureField' in p,false);assert.equal(p.product.description,'');assert.deepEqual(out.guestbook,[]);
 assert.deepEqual(project(snapshot,true).participants,snapshot.participants);assert.deepEqual(project(snapshot,true).guestbook,[]);assert.equal(member.recordHistory.length,4);assert.equal(snapshot.guestbook.length,1);
});
