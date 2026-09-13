import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
process.loadEnvFile('.env.local');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='member-run-uploads';const meta=await client.storage.getBucket(bucket);if(meta.error||meta.data.public)throw new Error('Private storage required');
const store=client.storage.from(bucket);const dir=`locker-storage-check/${randomUUID()}`;const paths=[`${dir}/a.json`,`${dir}/b.json`,`${dir}/target.json`];
try{
 for(const p of paths.slice(0,2)){const r=await store.upload(p,JSON.stringify({source:p}),{contentType:'application/json',upsert:false});if(r.error)throw r.error;}
 const results=await Promise.all(paths.slice(0,2).map(p=>store.move(p,paths[2])));
 console.log(results.map(r=>r.error?{code:r.error.statusCode,message:r.error.message}:'moved'));
 if(results.filter(r=>!r.error).length!==1)throw new Error('Atomic move failed');
 const r=await store.download(paths[2]);if(r.error)throw r.error;JSON.parse(await r.data.text());console.log('Atomic move and read passed');
}finally{const r=await store.remove(paths);if(r.error)throw r.error;console.log('Isolated probe removed');}
