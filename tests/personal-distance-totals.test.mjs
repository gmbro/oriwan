import test from 'node:test';
import assert from 'node:assert/strict';
import {fourthMemberTotals} from '../lib/fourth-season-contract.ts';
test('September personal distance and official distance are disjoint; future/pending/rejected excluded',()=>{
 const r=(date,status,distance,isPersonal=false)=>({recordDateIso:date,status,distanceKm:distance,durationMinutes:distance*10,isPersonal});
 const rows=[r('2026-08-31','certified',100),r('2026-09-01','certified',5),r('2026-09-22','certified',4),r('2026-09-23','certified',3),r('2026-09-25','needs_review',2,true),r('2026-09-25','needs_review',99),r('2026-09-25','rejected',99),r('2026-09-26','certified',99)];
 assert.deepEqual(fourthMemberTotals(rows,'2026-09-25'),{totalDistanceKm:14,totalDurationMinutes:140,certifiedDistanceKm:3,personalDistanceKm:11});
});
