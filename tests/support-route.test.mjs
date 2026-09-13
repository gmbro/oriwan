import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {nextSupportDate} from '../lib/support-cooldown.ts';
function harness(){
 const objects=new Map();let writes=0;
 const response={json:(body,options)=>({body,status:options?.status??200,cookies:{set(){}}})};
 const source=readFileSync(new URL('../app/api/support/route.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/\bexport /g,'');
 const deps={randomUUID:()=> '00000000-0000-4000-8000-000000000000',NextResponse:response,getServiceClient:()=>({}),resolvePersonalKakaoIdentity:async()=>({ok:true,authUserId:'test-account'}),privateUploadStore:async()=>({download:async key=>objects.has(key)?{data:{text:async()=>objects.get(key)}}:{error:{statusCode:404}},upload:async(key,value)=>{writes++;objects.set(key,value);return{};}}),nextSupportDate,guardMutationRequest:r=>r.hostile?{status:403}:null,guardReadRequest:r=>r.hostile?{status:403}:null};
 const routes=new Function(...Object.keys(deps),`${js};return {GET,POST};`)(...Object.values(deps));
 return{...routes,objects,writes:()=>writes};
}
const request={cookies:{get:()=>undefined}};
test('후원 완료만 저장하며 재요청은 한 달 잠금 시각을 연장하지 않는다',async()=>{
 const h=harness();assert.equal((await h.GET(request)).body.locked,false);assert.equal(h.writes(),0);
 const first=await h.POST(request);assert.equal(first.body.locked,true);assert.equal(h.writes(),1);
 const again=await h.POST(request);assert.equal(again.body.nextAt,first.body.nextAt);assert.equal(h.writes(),1);
 assert.equal((await h.GET(request)).body.locked,true);
 h.objects.set('support-cooldowns/user-test-account.json',JSON.stringify({nextAt:'2000-01-01T00:00:00Z'}));
 assert.equal((await h.GET(request)).body.locked,false);assert.equal((await h.POST(request)).body.locked,true);assert.equal(h.writes(),2);
});
test('다른 출처·손상된 저장 데이터는 후원 완료로 처리하지 않는다',async()=>{
 const h=harness();assert.equal((await h.POST({...request,hostile:true})).status,403);assert.equal(h.writes(),0);
 h.objects.set('support-cooldowns/user-test-account.json','{"nextAt":"invalid"}');assert.equal((await h.POST(request)).status,503);assert.equal(h.writes(),0);
});
