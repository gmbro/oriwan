import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../lib/personal-record-chart.ts', import.meta.url), 'utf8').replace("'./fourth-season-contract'", JSON.stringify(new URL('../lib/fourth-season-contract.ts', import.meta.url).href));
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {personalRecordChart: chart} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const record=(date,status='certified',distanceKm=3,durationSeconds=1200)=>({date,status,distanceKm,durationSeconds});
const sum=result=>result.buckets.reduce((s,b)=>s+b.distance,0);
test('all periods exclude pre-season and future records',()=>{
 for(const period of ['day','week','month']) {
 assert.deepEqual(chart([record('2026-08-31')],'2026-08-31',period).buckets,[]);
 assert.equal(sum(chart([record('2026-08-31'),record('2026-09-26')],'2026-09-25',period)),0);
 }
});
test('daily and calendar-week totals reconcile including multiple workouts and personal records',()=>{
 const rows=[record('2026-09-06'),record('2026-09-07'),record('2026-09-07'),{...record('2026-09-25','needs_review',4),isPersonal:true},record('2026-09-25','needs_review'),record('2026-09-25','rejected')];
 const daily=chart(rows,'2026-09-25','day');
 assert.equal(daily.buckets.length,25); assert.equal(daily.buckets[6].distance,6);
 const weekly=chart(rows,'2026-09-25','week');
 assert.deepEqual(weekly.buckets.map(b=>b.distance),[3,6,0,4]);
 assert.deepEqual(weekly.buckets.map(b=>b.label),['1–6일','7–13일','14–20일','21–25일']);
 assert.equal(sum(daily),sum(weekly)); assert.equal(sum(weekly),sum(chart(rows,'2026-09-25','month')));
});
test('month boundary splits calendar weeks without duplicate counting and navigation is bounded',()=>{
 const rows=[record('2026-09-30'),record('2026-10-01')];
 const current=chart(rows,'2026-10-02','week'); assert.equal(sum(current),3); assert.equal(current.buckets[0].label,'1–2일');
 const previous=chart(rows,'2026-10-02','week',-1); assert.equal(sum(previous),3); assert.equal(previous.buckets.at(-1).label,'28–30일');
 assert.equal(previous.canNext,true);assert.equal(previous.canPrevious,false);
 assert.equal(chart(rows,'2026-10-02','day',-99).start,'2026-09-01');
 assert.equal(chart(rows,'2026-10-02','day',99).canNext,false);
});
test('monthly chart always includes September to December and ignores future or invalid values',()=>{
 const rows=[record('2026-09-01'),record('2026-12-31'),record('2027-01-01'),record('2026-09-02','certified',NaN),record('2026-09-03','certified',-3)];
 const current=chart(rows,'2026-09-25','month'); assert.deepEqual(current.buckets.map(b=>b.label),['9월','10월','11월','12월']);assert.deepEqual(current.buckets.map(b=>b.distance),[3,0,0,0]);
 const final=chart(rows,'2027-01-01','month');assert.deepEqual(final.buckets.map(b=>b.distance),[3,0,0,3]);assert.equal(final.canNext,false);assert.equal(final.canPrevious,false);
});
