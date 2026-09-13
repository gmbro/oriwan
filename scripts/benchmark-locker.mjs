// Read-only server path benchmark using the first configured member, no personal data printed.
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const contract=compile(readFileSync('lib/member-locker.ts','utf8'));
let source=readFileSync('lib/member-locker-server.ts','utf8').replace("import 'server-only';",'').replace("import { privateUploadStore } from './member-upload-server';",`const privateUploadStore=async service=>{const r=await service.storage.getBucket('member-run-uploads');if(r.error||r.data.public)throw new Error('Private store required');return service.storage.from('member-run-uploads');};`).replace("'./member-locker'",JSON.stringify(contract));
const {readLocker}=await import(compile(source));
const service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const p=await service.from('participants').select('id,user_id').eq('season_key','4th').limit(1).single();if(p.error)throw p.error;
const times=[];for(let i=0;i<4;i++){const start=performance.now();await readLocker(service,p.data.user_id,p.data.id);times.push(Math.round(performance.now()-start));}
console.log(JSON.stringify({readMs:times,meanMs:Math.round(times.reduce((a,b)=>a+b)/times.length)}));
