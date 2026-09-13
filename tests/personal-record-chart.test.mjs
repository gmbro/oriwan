import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../lib/personal-record-chart.ts', import.meta.url), 'utf8').replace("'./fourth-season-contract'", JSON.stringify(new URL('../lib/fourth-season-contract.ts', import.meta.url).href));
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {personalRecordChart} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')); 
const record=(date,status='certified',distanceKm=3,durationSeconds=1200)=>({date,status,distanceKm,durationSeconds});
test('all charts exclude preseason and have a September 23 empty start state',()=>{
 for(const period of ['week','month','total']) {
 const result=personalRecordChart([record('2026-09-14')],'2026-09-14',period);
 assert.equal(result.start,'2026-09-23'); assert.equal(result.beforeStart,true); assert.deepEqual(result.buckets,[]);
 }
});
test('seven-day weeks start September 23 and support bounded navigation',()=>{
 const rows=[record('2026-09-22'),record('2026-09-23'),record('2026-09-29','needs_review'),record('2026-09-30'),record('2026-10-01','rejected'),record('2026-10-03')];
 const current=personalRecordChart(rows,'2026-10-02','week'); assert.equal(current.start,'2026-09-30'); assert.equal(current.buckets.reduce((s,b)=>s+b.distance,0),3);
 const previous=personalRecordChart(rows,'2026-10-02','week',-1); assert.equal(previous.start,'2026-09-23'); assert.equal(previous.end,'2026-09-29'); assert.equal(previous.buckets.reduce((s,b)=>s+b.distance,0),6); assert.equal(previous.canPrevious,false); assert.equal(previous.canNext,true);
});
test('monthly and total charts clip both season boundaries and preserve sums',()=>{
 const rows=[record('2026-09-22'),record('2026-09-23'),record('2026-12-31'),record('2027-01-02')];
 const total=personalRecordChart(rows,'2027-01-03','total'); assert.equal(total.start,'2026-09-23');assert.equal(total.end,'2026-12-31');assert.deepEqual(total.buckets.map(b=>b.distance),[3,0,0,3]);
 const first=personalRecordChart(rows,'2027-01-03','month',-99);assert.equal(first.start,'2026-09-23');assert.equal(first.buckets.length,8);
});
