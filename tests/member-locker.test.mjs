import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const compile=(s)=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const source=readFileSync(new URL('../lib/member-locker.ts',import.meta.url),'utf8');
const {lockerSnapshot,validateLockerAction,applyLockerEvent}=await import(compile(source));
const prize={id:'claim',message:'🎁 크루 재능기부 1회권',claimed_at:'2026-09-23T01:00:00Z'};
const event=(action,revision,extra={})=>({action,revision,itemId:'gift-claim',operationId:`op${revision}`,role:action==='request'?'member':'admin',actor:'user',at:'2026-09-24T01:00:00Z',note:'사용 희망일 9월 25일',...extra});
test('existing prize claims automatically appear once, fortune text is excluded',()=>{
 const s=lockerSnapshot([prize,prize,{...prize,id:'fortune',message:'오늘도 힘내세요'}],[]);
 assert.equal(s.items.length,1);assert.equal(s.items[0].title,'크루 재능기부 1회권');assert.equal(s.items[0].status,'available');
});
test('request, rejection and re-request retain history; only completed requests become used',()=>{
 const events=[event('request',1),event('reject',2),event('request',3),event('complete',4)];
 assert.equal(lockerSnapshot([prize],events.slice(0,1)).items[0].status,'requested');
 assert.equal(lockerSnapshot([prize],events.slice(0,2)).items[0].status,'available');
 const s=lockerSnapshot([prize],events);assert.equal(s.items[0].status,'used');assert.equal(s.items[0].history.length,4);assert.equal(s.revision,4);
});
test('manual grants and prizes share inventory but preserve origins',()=>{
 const s=lockerSnapshot([prize],[event('grant',1,{itemId:'admin-1',title:'커피 쿠폰'})]);
 assert.equal(s.items.length,2);assert.equal(s.items.find(i=>i.id==='admin-1').source,'admin');
});
test('members cannot grant, complete, reject or reuse pending/used items',()=>{
 const s=lockerSnapshot([prize],[]);
 for(const a of ['grant','complete','reject'])assert.ok(validateLockerAction(s,'member',a,'gift-claim','권','내용'));
 assert.equal(validateLockerAction(s,'member','request','gift-claim','','날짜'),null);
 for(const events of [[event('request',1)],[event('request',1),event('complete',2)]])assert.ok(validateLockerAction(lockerSnapshot([prize],events),'member','request','gift-claim','','날짜'));
});
test('unknown items, empty reasons and invalid admin state transitions are rejected',()=>{
 const s=lockerSnapshot([prize],[]);
 assert.ok(validateLockerAction(s,'member','request','other','','날짜'));
 assert.ok(validateLockerAction(s,'member','request','gift-claim','','   '));
 assert.ok(validateLockerAction(s,'admin','complete','gift-claim','','완료'));
 assert.ok(validateLockerAction(s,'admin','grant','new','x'.repeat(161),'사유'));
 const pending=lockerSnapshot([prize],[event('request',1)]);
 assert.equal(validateLockerAction(pending,'admin','complete','gift-claim','','제공 완료'),null);
});
const server=readFileSync(new URL('../lib/member-locker-server.ts',import.meta.url),'utf8');
const appendSource=server.slice(server.indexOf('export async function appendLockerEvent'));
const {appendLockerEvent}=await import(compile('import { randomUUID } from \"node:crypto\";\n'+appendSource));
test('concurrent commits reserve one revision and clean up only staging files',async()=>{
 const files=new Map();const store={upload:async(path,body)=>{files.set(path,body);return {error:null};},move:async(from,to)=>{
  if(files.has(to))return {error:{statusCode:409,message:'Duplicate'}};
  files.set(to,files.get(from));files.delete(from);return {error:null};
 },remove:async paths=>{for(const p of paths){assert.match(p,/pending/);files.delete(p);}return {error:null};}};
 const results=await Promise.all([appendLockerEvent(store,'test',event('request',1)),appendLockerEvent(store,'test',event('request',1,{operationId:'other'}))]);
 assert.deepEqual(results,[true,false]);assert.equal(files.size,1);
});
test('storage failures are surfaced rather than reported as successful use',async()=>{
 await assert.rejects(()=>appendLockerEvent({upload:async()=>({error:new Error('offline')})},'test',event('request',1)),/offline/);
});
const mutationSource=readFileSync(new URL('../lib/member-locker-route.ts',import.meta.url),'utf8');
let routeSource=mutationSource.replace(/^import .*;\n/gm,'');
routeSource=`const after=()=>{}; const applyLockerEvent=${applyLockerEvent.toString()}; const memberJson=(body,status=200)=>({body,status}); const readMemberJson=async request=>({body:request}); const readLocker=async()=>globalThis.lockerTestLoaded; const appendLockerEvent=async(_s,_d,event)=>{globalThis.lockerTestWrites.push(event);return true;}; const validateLockerAction=${validateLockerAction.toString()};\n`+routeSource;
const {mutateLocker}=await import(compile(routeSource));
test('mutation uses server actor and rejects stale versions or attempts to reuse a completed item',async()=>{
 globalThis.lockerTestWrites=[];globalThis.lockerTestLoaded={events:[],snapshot:lockerSnapshot([prize],[]),store:{},directory:'private'};
 const command={operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',revision:0,action:'request',itemId:'gift-claim',note:'9월 24일',actor:'forged',role:'admin'};
 const result=await mutateLocker(command,{},'owner','member','verified-member','member');
 assert.equal(result.status,200);assert.equal(globalThis.lockerTestWrites[0].actor,'verified-member');assert.equal(globalThis.lockerTestWrites[0].role,'member');
 const stale=await mutateLocker({...command,revision:99},{},'owner','member','verified-member','member');assert.equal(stale.status,409);assert.equal(globalThis.lockerTestWrites.length,1);
});
test('retry of an ambiguously completed grant does not create a second item',async()=>{
 const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 globalThis.lockerTestWrites=[];globalThis.lockerTestLoaded={events:[event('grant',1,{operationId:id,actor:'owner'})],snapshot:{revision:1,items:[]},store:{},directory:'private'};
 const result=await mutateLocker({operationId:id,revision:0,action:'grant',title:'재능기부 1회권',note:'지급'},{},'owner','member','owner','admin');
 assert.equal(result.status,200);assert.equal(globalThis.lockerTestWrites.length,0);
 delete globalThis.lockerTestLoaded;delete globalThis.lockerTestWrites;
});
test('mutation result projection matches a fresh ledger read without an extra storage round trip',()=>{
 let snapshot=lockerSnapshot([prize],[]);const events=[event('request',1),event('reject',2),event('request',3),event('complete',4),event('grant',5,{itemId:'manual',title:'커피 쿠폰'})];
 for(let i=0;i<events.length;i++){snapshot=applyLockerEvent(snapshot,events[i]);assert.deepEqual(snapshot,lockerSnapshot([prize],events.slice(0,i+1)));}
});
