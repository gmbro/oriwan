import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parseTimeMachineGoalInput} from '../lib/time-machine-contract.ts';
const source=readFileSync(new URL('../app/api/admin/hello-2027/time-machine/route.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const participant='11111111-1111-4111-8111-111111111111';
function harness(auth=true,owner='operator'){
 let row={id:'goal',user_id:owner,season_key:'4th',participant_id:participant,goal_title:'처음 목표',goal_detail:'',commitment:'',created_at:new Date().toISOString()};
 const calls=[];
 const service={from(){calls.push('db');let action='read',values;const filters=[];const query={eq(k,v){filters.push([k,v]);return query},select(){return query},update(v){values=v;action='update';return query},delete(){action='delete';return query},async maybeSingle(){if(!row||!filters.every(([k,v])=>row[k]===v))return {data:null};const previous=row;if(action==='update')row={...row,...values};if(action==='delete')row=null;return {data:action==='delete'?previous:row};}};return query;}};
 const deps={NextResponse:{json:(body,options)=>({body,...options})},after:()=>{},requireAdminDataAccess:async()=>auth?{ok:true,user:{id:'operator'},service}:{ok:false,response:{status:401}},guardReadRequest:()=>null,guardMutationRequest:()=>null,readLimitedJson:async req=>({ok:true,value:req.body}),parseTimeMachineGoalInput,TIME_MACHINE_SEASON_KEY:'4th',broadcastDashboardRefreshFromServer:()=>{}};
 const exports={};new Function('exports',...Object.keys(deps),js)(exports,...Object.values(deps));
 const request=(body={})=>({nextUrl:new URL(`https://example.com/?participant_id=${participant}`),body:{participant_id:participant,...body}});
 return {...exports,request,calls};
}
test('관리자 인증 없이는 목표 조회·수정·삭제 모두 차단',async()=>{const h=harness(false);for(const method of ['GET','PATCH','DELETE'])assert.equal((await h[method](h.request())).status,401);assert.deepEqual(h.calls,[])});
test('다른 운영자의 목표는 읽거나 변경·삭제하지 못함',async()=>{const h=harness(true,'other');assert.equal((await h.GET(h.request())).body.goal,null);assert.equal((await h.PATCH(h.request({goal_title:'수정 요청'}))).status,404);assert.equal((await h.DELETE(h.request())).status,404)});
test('담당 운영자는 30일 이내에도 수정·삭제하며 기존 잠금 시작일 보존',async()=>{const h=harness();const original=(await h.GET(h.request())).body.goal;const updated=await h.PATCH(h.request({goal_title:'운영자 수정',user_id:'forged',created_at:'2000-01-01'}));assert.equal(updated.status,200);assert.equal(updated.body.goal.goal_title,'운영자 수정');assert.equal(updated.body.goal.created_at,original.created_at);assert.equal(updated.body.goal.user_id,'operator');assert.equal((await h.DELETE(h.request())).status,200);assert.equal((await h.GET(h.request())).body.goal,null)});
