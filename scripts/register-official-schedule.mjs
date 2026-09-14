// Authorized 4th-season schedule additions. Never replaces existing events.
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
process.loadEnvFile('.env.local');
const service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ownerResult=await service.from('participants').select('user_id').eq('season_key','4th').eq('name','이경민').single();
if(ownerResult.error)throw ownerResult.error;
const bucket=service.storage.from('photos'),directory=`hello-2027/schedules/live/${ownerResult.data.user_id}`;
const listed=await bucket.list(directory,{limit:1000});if(listed.error)throw listed.error;
const existing=[];
for(const f of listed.data){if(!f.name.endsWith('.txt'))continue;const r=await bucket.download(`${directory}/${f.name}`);if(r.error)throw r.error;existing.push(JSON.parse(await r.data.text()));}
const requested=[
 {date:'2026-09-23',title:'트레바리 첫 모임'},
 {date:'2026-10-24',title:'러닝 번개 1차'},
 {date:'2026-10-28',title:'트레바리 두 번째 모임'},
 {date:'2026-11-07',endDate:'2026-11-08',title:'트립 1차'},
 {date:'2026-11-25',title:'트레바리 세 번째 모임'},
 {date:'2026-11-28',title:'러닝 번개 2차'},
 {date:'2026-12-12',endDate:'2026-12-13',title:'트립 2차'},
 {date:'2026-12-23',title:'트레바리 네 번째 모임'},
 {date:'2027-01-01',title:'20.27km 일출 러닝'}
];
for(const item of requested){
 const found=existing.find(e=>e.date===item.date&&(e.title===item.title||(item.title.startsWith('트레바리')&&/정기모임|트레바리/.test(e.title))));
 if(found){console.log('유지',item.date,found.title);continue;}
 const event={...item,time:'',location:'',description:item.title==='20.27km 일출 러닝'?'새해 첫날, 20.27km를 함께 달리며 일출을 맞이합니다. 세부 시간과 장소는 추후 안내합니다.':'세부 시간과 장소는 추후 안내합니다.'};
 if(!process.argv.includes('--apply')){console.log('추가 예정',event);continue;}
 const path=`${directory}/${randomUUID()}.txt`;const saved=await bucket.upload(path,JSON.stringify(event),{upsert:false,contentType:'text/plain'});if(saved.error)throw saved.error;
 const check=await bucket.download(path);if(check.error||await check.data.text()!==JSON.stringify(event))throw new Error('Schedule verification failed');
 existing.push(event);console.log('등록',item.date,item.endDate||'',item.title);
}
