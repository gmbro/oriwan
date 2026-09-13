import { NextRequest } from 'next/server';
import { ownedMember,memberJson } from '@/lib/member-upload-server';
import { guardMutationRequest,guardReadRequest } from '@/lib/request-security';
import { readLocker } from '@/lib/member-locker-server';
import { mutateLocker } from '@/lib/member-locker-route';
export async function GET(request:NextRequest){
 const guard=guardReadRequest(request,{requireSameOrigin:true});if(guard)return guard;
 const member=await ownedMember();if(member.response)return member.response;
 try{return memberJson((await readLocker(member.context!.service,member.adminUserId!,member.participantId!)).snapshot);}
 catch{return memberJson({error:'보관함을 불러오지 못했어요. 다시 시도해주세요.'},503);}
}
export async function POST(request:NextRequest){
 const guard=guardMutationRequest(request,{maxBodyBytes:8192,rateLimit:{key:'locker-request',limit:12,windowMs:60000}});if(guard)return guard;
 const member=await ownedMember();if(member.response)return member.response;
 try{return await mutateLocker(request,member.context!.service,member.adminUserId!,member.participantId!,member.context!.authUserId,'member');}
 catch{return memberJson({error:'처리 결과를 확인하지 못했어요. 같은 요청을 다시 눌러 확인해주세요.'},503);}
}
