import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/dashboard-record-visibility.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace('export function','function');
const project=new Function(`${js}; return projectDashboardRecords;`)();
test('anonymous projection drops detailed records without mutating shared authenticated data',()=>{
 const member={id:'a',fullName:'러너',product:{name:'소개',description:''},recordHistory:[{distanceKm:7}],completed:true,seasonCompletionRate:88,distanceKm:7,durationMinutes:42,certifiedDays:20,totalDistanceKm:140,totalDurationMinutes:840,privateFutureField:'secret'};
 const snapshot={participants:[member],completedToday:3};
 const projected=project(snapshot,false); assert.deepEqual(projected.participants[0].recordHistory,[]); assert.equal(projected.participants[0].distanceKm,null); assert.equal(projected.participants[0].totalDistanceKm,0); assert.equal('privateFutureField' in projected.participants[0],false);assert.equal(project(snapshot,true),snapshot);assert.equal(member.recordHistory.length,1);
});
