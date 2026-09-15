import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
import {prepareBannerImage,MAX_BANNER_SOURCE_BYTES,MAX_BANNER_TRANSFER_BYTES} from '../lib/banner-image-upload.ts';
test('20MB 원본은 전송 전 3MB 이내로 최적화하고 이미지 자원을 해제',async()=>{
 const previousBitmap=globalThis.createImageBitmap,previousDocument=globalThis.document;let closed=false,attempts=0;
 globalThis.createImageBitmap=async()=>({width:6000,height:4000,close(){closed=true}});
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toBlob(callback){attempts++;callback(new Blob([new Uint8Array(attempts===1?MAX_BANNER_TRANSFER_BYTES+1:1024)],{type:'image/webp'}))}})};
 try{const result=await prepareBannerImage(new File([new Uint8Array(MAX_BANNER_SOURCE_BYTES)],'large.png',{type:'image/png'}));assert.ok(result.size<=MAX_BANNER_TRANSFER_BYTES);assert.equal(attempts,2);assert.equal(closed,true);assert.equal(result.type,'image/webp');await assert.rejects(()=>prepareBannerImage(new File([new Uint8Array(MAX_BANNER_SOURCE_BYTES+1)],'huge.png',{type:'image/png'})),/20MB/)}finally{globalThis.createImageBitmap=previousBitmap;globalThis.document=previousDocument}
});
test('회원 및 어드민 세션 갱신 쿠키를 동시에 보존',async()=>{
 const source=readFileSync(new URL('../lib/supabase/proxy.ts',import.meta.url),'utf8');const js=ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const incoming=new Map([['twtt-admin-auth','old']]);const request={cookies:{getAll:()=>[...incoming].map(([name,value])=>({name,value})),set:(name,value)=>incoming.set(name,value)}};
 const calls=[];const next=()=>{const out=new Map();return{cookies:{getAll:()=>[...out.values()],set:(name,value,options)=>{const c=typeof name==='object'?name:{name,value,...options};out.set(c.name,c)}}}};
 const createServerClient=(url,key,options)=>({auth:{getClaims:async()=>{const name=options.cookieOptions.name||'member-auth';calls.push(name);options.cookies.setAll([{name,value:'renewed',options:{maxAge:31536000}}])}}});
 const exports={};new Function('exports','createServerClient','NextResponse','process',js)(exports,createServerClient,{next},{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.com',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public'}});
 const result=await exports.updateSession(request);assert.deepEqual(calls,['member-auth','twtt-admin-auth']);assert.equal(result.cookies.getAll().length,2);assert.ok(result.cookies.getAll().every(c=>c.maxAge===31536000));
});
test('어드민 세션 조회 실패 시 저장된 인증 쿠키를 지우지 않음',async()=>{
 const source=readFileSync(new URL('../app/api/admin/session/route.ts',import.meta.url),'utf8');const js=ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;let cleared=false,options;
 const deps={NextResponse:{json:(body,opts)=>({body,...opts})},ADMIN_EMAIL:'admin@example.com',isAdminEmail:()=>true,clearAdminSessionCookie:()=>cleared=true,hasValidAdminSession:async()=>true,setAdminSessionCookie:()=>true,guardMutationRequest:()=>null,readLimitedJson:()=>{},logServerFailure:()=>{},createAdminAuthClient:async()=>{options={cookieName:"twtt-admin-auth"};return{auth:{getClaims:async()=>({error:new Error("network"),data:null})}}},createClient:async()=>({}),process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.com',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public'}}};const exports={};new Function('exports',...Object.keys(deps),js)(exports,...Object.values(deps));const response=await exports.GET();assert.equal(response.status,503);assert.equal(cleared,false);assert.equal(options.cookieName,'twtt-admin-auth');
});
