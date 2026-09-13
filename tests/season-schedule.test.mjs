import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSeasonEvent } from '../lib/season-schedule-contract.ts';
const event = {date:'2026-09-14',time:'08:00',title:'정기 모임',location:'공원',description:''};
test('일정은 시즌 달력 범위의 실제 날짜와 시간을 검증한다',()=>{
 assert.deepEqual(parseSeasonEvent(event), event);
 assert.equal(parseSeasonEvent({...event,endTime:'07:00'}),null);
 assert.equal(parseSeasonEvent({...event,endTime:'24:00'}),null);
 assert.equal(parseSeasonEvent({...event,endTime:'23:20'}).endTime,'23:20');
 for(const date of ['2026-09-31','2026-13-01','2026-08-31','2027-01-01','invalid'])assert.equal(parseSeasonEvent({...event,date}),null);
 for(const time of ['24:00','08:60','8:00'])assert.equal(parseSeasonEvent({...event,time}),null);
 assert.ok(parseSeasonEvent({...event,time:''}));
 assert.equal(parseSeasonEvent({...event,title:' '.repeat(3)}),null);
 assert.equal(parseSeasonEvent({...event,title:'a'.repeat(81)}),null);
});
