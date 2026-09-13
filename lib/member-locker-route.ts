import 'server-only';
import { after, NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { memberJson, readMemberJson } from './member-upload-server';
import { readLocker, appendLockerEvent } from './member-locker-server';
import { broadcastDashboardRefreshFromServer } from "./dashboard-refresh-server";
import { applyLockerEvent, validateLockerAction, type LockerAction, type LockerEvent } from './member-locker';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validLockerMember=(id:string)=>UUID.test(id);
export async function mutateLocker(request:NextRequest,service:SupabaseClient,owner:string,participant:string,actor:string,role:'admin'|'member') {
 const input=await readMemberJson(request,8192); if(input.response)return input.response;
 const b=input.body!;
 if(typeof b.operationId!=='string'||!UUID.test(b.operationId)||!Number.isSafeInteger(b.revision)||Number(b.revision)<0||typeof b.action!=='string'||typeof b.note!=='string')return memberJson({error:'입력 내용을 확인해주세요.'},400);
 const loaded=await readLocker(service,owner,participant);
 if(loaded.events.some(e=>e.operationId===b.operationId&&e.actor===actor))return memberJson(loaded.snapshot);
 if(b.revision!==loaded.snapshot.revision)return memberJson({error:'보관함이 변경됐어요. 새로고침 후 다시 확인해주세요.'},409);
 const action=b.action as LockerAction; const title=typeof b.title==='string'?b.title.trim():'';
 const itemId=action==='grant'?`admin-${b.operationId}`:typeof b.itemId==='string'?b.itemId:'';
 const reason=validateLockerAction(loaded.snapshot,role,action,itemId,title,b.note);
 if(reason)return memberJson({error:reason},400);
 const event:LockerEvent={revision:loaded.snapshot.revision+1,operationId:b.operationId,itemId,action,at:new Date().toISOString(),actor,role,note:b.note.trim(),...(action==='grant'?{title}:{})};
 if(!await appendLockerEvent(loaded.store,loaded.directory,event))return memberJson({error:'다른 요청이 먼저 처리됐어요. 새로고침 후 다시 확인해주세요.'},409);
 after(()=>broadcastDashboardRefreshFromServer(service));
 return memberJson(applyLockerEvent(loaded.snapshot,event));
}
