import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { privateUploadStore } from './member-upload-server';
import { lockerSnapshot, type LockerEvent, type LockerClaim } from './member-locker';
export function lockerDirectory(owner:string, participant:string) { return `locker/4th/${process.env.NODE_ENV==='development'?'local':'live'}/${owner}/${participant}`; }
export async function readLocker(service:SupabaseClient,owner:string,participant:string) {
 const store=await privateUploadStore(service); const directory=lockerDirectory(owner,participant);
 const claims:LockerClaim[]=[];
 for(let offset=0;;offset+=1000){
  const r=await service.from('daily_gift_claims').select('id,message,claimed_at').eq('user_id',owner).eq('season_key','4th').eq('participant_id',participant).like('message','🎁 %').order('id').range(offset,offset+999);
  if(r.error) throw r.error; claims.push(...r.data); if(r.data.length<1000) break;
 }
 const events:LockerEvent[]=[];
 for(let offset=0;;offset+=1000){
  const listed=await store.list(directory,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
  if(listed.error) throw listed.error;
  const files=listed.data.filter(f=>/^\d{10}\.json$/.test(f.name));
  for(let start=0;start<files.length;start+=20){
   events.push(...await Promise.all(files.slice(start,start+20).map(async f=>{
    const r=await store.download(`${directory}/${f.name}`); if(r.error) throw r.error;
    const event=JSON.parse(await r.data.text()) as LockerEvent;
    if(event.revision!==Number(f.name.slice(0,10))) throw new Error('Invalid locker revision');
    return event;
   })));
  }
  if(listed.data.length<1000) break;
 }
 events.sort((a,b)=>a.revision-b.revision);
 if(events.some((e,i)=>e.revision!==i+1)) throw new Error('Incomplete locker history');
 return {store,directory,events,snapshot:lockerSnapshot(claims,events)};
}
// Commit a uniquely staged object with Storage's atomic move (destination must not
// exist). Upload alone is not a lock: concurrent uploads can both report success.
// Revision files are never overwritten or deleted; losers reload and retry.
export async function appendLockerEvent(store:Awaited<ReturnType<typeof privateUploadStore>>,directory:string,event:LockerEvent) {
 const staging=`${directory}/pending/${randomUUID()}.json`;
 const result=await store.upload(staging,JSON.stringify(event),{contentType:'application/json',cacheControl:'0',upsert:false});
 if(result.error) throw result.error;
 try {
  const moved=await store.move(staging,`${directory}/${String(event.revision).padStart(10,'0')}.json`);
  if(moved.error) {
   if(String(moved.error.statusCode)==='409'||/duplicate|already exists/i.test(moved.error.message)) return false;
   throw moved.error;
  }
  return true;
 } finally {
  // Only the disposable staging path is eligible for cleanup, never the ledger.
  await store.remove([staging]);
 }
}
