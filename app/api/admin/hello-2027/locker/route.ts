import { NextRequest } from 'next/server';
import { requireAdminDataAccess } from '@/lib/admin-data-access';
import { memberJson } from '@/lib/member-upload-server';
import { guardMutationRequest,guardReadRequest } from '@/lib/request-security';
import { readLocker } from '@/lib/member-locker-server';
import { mutateLocker,validLockerMember } from '@/lib/member-locker-route';
export async function GET(request:NextRequest){
 const guard=guardReadRequest(request,{requireSameOrigin:true});if(guard)return guard;
 const a=await requireAdminDataAccess();if(!a.ok)return a.response;
 try{
 const id=request.nextUrl.searchParams.get('participant')||'';
 if(!id){const r=await a.service.from('participants').select('id,name').eq('user_id',a.user.id).eq('season_key','4th').order('name');if(r.error)throw r.error;return memberJson({participants:r.data});}
 if(!validLockerMember(id))return memberJson({error:'멤버를 확인해주세요.'},400);
 const p=await a.service.from('participants').select('id').eq('user_id',a.user.id).eq('season_key','4th').eq('id',id).maybeSingle();
 if(p.error)throw p.error;if(!p.data)return memberJson({error:'멤버를 찾을 수 없어요.'},404);
 return memberJson((await readLocker(a.service,a.user.id,id)).snapshot);
 }catch{return memberJson({error:'보관함을 불러오지 못했어요.'},503);}
}
export async function POST(request:NextRequest){
 const guard=guardMutationRequest(request,{maxBodyBytes:8192});if(guard)return guard;
 const a=await requireAdminDataAccess();if(!a.ok)return a.response;
 const id=request.nextUrl.searchParams.get('participant')||'';
 if(!validLockerMember(id))return memberJson({error:'멤버를 확인해주세요.'},400);
 try{
 const p=await a.service.from('participants').select('id').eq('user_id',a.user.id).eq('season_key','4th').eq('id',id).maybeSingle();
 if(p.error)throw p.error;if(!p.data)return memberJson({error:'멤버를 찾을 수 없어요.'},404);
 return await mutateLocker(request,a.service,a.user.id,id,a.user.id,'admin');
 }catch{return memberJson({error:'처리 결과를 확인하지 못했어요. 같은 요청을 다시 눌러 확인해주세요.'},503);}
}
