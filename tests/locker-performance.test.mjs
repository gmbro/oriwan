import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const warm=compile(readFileSync(new URL('../lib/warm-request.ts',import.meta.url),'utf8'));
const request=readFileSync(new URL('../lib/locker-request.ts',import.meta.url),'utf8').replace("'./warm-request'",JSON.stringify(warm));
const {createLockerRequest}=await import(compile(request));
test('menu prefetch and popup share one request; snapshot is synchronously available afterwards',async()=>{
 const original=globalThis.fetch;let calls=0;let finish;
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({revision:0,items:[]})});});};
 try{const cache=createLockerRequest();const a=cache.read();const b=cache.read();assert.equal(calls,1);assert.equal(a,b);finish();await a;assert.equal(cache.peek().revision,0);await cache.read();assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('confirmed write supersedes a slow older GET and caches remain account scoped',async()=>{
 const original=globalThis.fetch;let finish;
 globalThis.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({revision:0,items:[]})});});
 try{const cache=createLockerRequest();const other=createLockerRequest();const pending=cache.read();cache.set({revision:1,items:[]});finish();await pending;assert.equal(cache.peek().revision,1);assert.equal(other.peek(),undefined);}finally{globalThis.fetch=original;}
});
const contract=compile(readFileSync(new URL('../lib/member-locker.ts',import.meta.url),'utf8'));
let server=readFileSync(new URL('../lib/member-locker-server.ts',import.meta.url),'utf8').replace("import 'server-only';",'').replace("import { privateUploadStore } from './member-upload-server';","const privateUploadStore=async()=>globalThis.lockerPerfStore;").replace("'./member-locker'",JSON.stringify(contract));
const {readLocker}=await import(compile(server));
test('fresh lists are read each time but immutable event bodies download once per owner',async()=>{
 let lists=0,downloads=0;const event={revision:1,operationId:'op',itemId:'manual',action:'grant',at:'2026-09-23T00:00:00Z',actor:'admin',role:'admin',title:'권',note:'선물'};
 globalThis.lockerPerfStore={list:async()=>{lists++;return {data:[{name:'0000000001.json'}]};},download:async()=>{downloads++;return {data:{text:async()=>JSON.stringify(event)}};}};
 const query={select(){return this;},eq(){return this;},like(){return this;},order(){return this;},range:async()=>({data:[]})};const service={from:()=>query};
 try{await readLocker(service,'owner-a','member');await readLocker(service,'owner-a','member');assert.equal(lists,2);assert.equal(downloads,1);await readLocker(service,'owner-b','member');assert.equal(downloads,2);}finally{delete globalThis.lockerPerfStore;}
});
