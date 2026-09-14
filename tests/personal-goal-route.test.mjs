import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parseTimeMachineGoalInput,getTimeMachineTiming} from '../lib/time-machine-contract.ts';
const source=readFileSync(new URL('../app/api/me/time-machine/route.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(auth=true){
 const calls=[];let row=null;
 class Response {constructor(body,status=200){this.body=body;this.status=status} static json(body,options={}){return new Response(body,options.status)}}
 const service={from(){const query={select(){return query},eq(k,v){calls.push([k,v]);return query},async maybeSingle(){return {data:row}},upsert(value,options){calls.push({value,options});row={id:'goal',...value,created_at:'2026-09-15'};return query},async single(){return{data:row}}};return query}};
 const deps={NextResponse:Response,resolvePersonalMemberContext:async()=>auth?{ok:true,authUserId:'author',service,connection:{status:'approved',adminUserId:'operator',participant:{id:'member'}}}:{ok:false,reason:'unauthenticated'},guardReadRequest:()=>null,guardMutationRequest:()=>null,readLimitedJson:async req=>({ok:true,value:req.body}),logServerFailure:()=>{},isMissingTableError:()=>false,missingSchemaResponse:()=>({}),getTimeMachineTiming,parseTimeMachineGoalInput,TIME_MACHINE_SEASON_KEY:'4th',invalidatePublicDashboardCache:()=>{},after:()=>{},broadcastDashboardRefreshFromServer:()=>{}};
 const exports={};new Function('exports',...Object.keys(deps),js)(exports,...Object.values(deps));return{...exports,calls};
}
test('목표 API는 비로그인 조회·저장을 DB 접근 전에 차단',async()=>{const h=harness(false);assert.equal((await h.GET({})).status,401);assert.equal((await h.POST({})).status,401);assert.deepEqual(h.calls,[])});
test('목표 본문은 개봉 대기 없이 본인에게 반환하며 타인 ID 입력을 무시',async()=>{const h=harness();const saved=await h.POST({body:{goal_title:'꾸준히 달리기',commitment:'나의 속도로',auth_user_id:'victim',participant_id:'victim'}});assert.equal(saved.status,201);assert.equal(saved.body.goal.title,'꾸준히 달리기');assert.equal(h.calls[0].value.auth_user_id,'author');assert.equal(h.calls[0].value.participant_id,'member');await h.GET({});assert.ok(h.calls.some(x=>x[0]==='auth_user_id'&&x[1]==='author'));assert.ok(h.calls.some(x=>x[0]==='user_id'&&x[1]==='operator'))});
test('재저장은 같은 회원·시즌 목표를 수정하고 입력 길이를 검증',async()=>{const h=harness();await h.POST({body:{goal_title:'첫 목표'}});await h.POST({body:{goal_title:'수정한 목표'}});assert.equal((await h.GET({})).body.goal.title,'수정한 목표');assert.equal(h.calls[0].options.onConflict,'season_key,auth_user_id');assert.equal((await h.POST({body:{goal_title:'가'.repeat(81)}})).status,400)});
test('관리자 목표 조회·삭제 API는 본문 없이 종료',async()=>{const admin=readFileSync(new URL('../app/api/admin/hello-2027/time-machine/route.ts',import.meta.url),'utf8').replace(/^import.*\n/gm,'');const exports={};new Function('exports','NextResponse',ts.transpileModule(admin,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,{json:(body,options)=>({body,...options})});for(const method of ['GET','DELETE']){const r=await exports[method]();assert.equal(r.status,410);assert.equal(r.body.goal,undefined)}});
