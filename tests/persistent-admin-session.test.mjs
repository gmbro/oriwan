import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,timingSafeEqual} from 'node:crypto';
import ts from 'typescript';
test('persistent admin cookie remains signed, owner-bound, renewable and clearable',async()=>{
 let cookie;const source=readFileSync(new URL('../lib/admin-server.ts',import.meta.url),'utf8');
 const snippet=source.slice(source.indexOf('const ADMIN_SESSION_COOKIE'),source.indexOf('export async function requireAdminUser')).replaceAll('export ','');
 const js=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const api=new Function('createHmac','timingSafeEqual','cookies','process','Buffer',js+';return {setAdminSessionCookie,hasValidAdminSession,clearAdminSessionCookie};')(createHmac,timingSafeEqual,async()=>({get:()=>cookie}),{env:{ADMIN_SESSION_SECRET:'test-only-session-signing-secret-long-enough',NODE_ENV:'production'}},Buffer);
 let options;const response={cookies:{set:(name,value,opts)=>{cookie={value};options=opts;}}};
 assert.equal(api.setAdminSessionCookie(response,'owner'),true);assert.equal(options.maxAge,31536000);assert.equal(options.httpOnly,true);assert.equal(options.secure,true);
 assert.equal(await api.hasValidAdminSession('owner'),true);assert.equal(await api.hasValidAdminSession('other'),false);
 cookie.value+='tampered';assert.equal(await api.hasValidAdminSession('owner'),false);
 api.setAdminSessionCookie(response,'owner');assert.equal(await api.hasValidAdminSession('owner'),true);
 api.clearAdminSessionCookie(response);assert.equal(options.maxAge,0);assert.equal(await api.hasValidAdminSession('owner'),false);
});
