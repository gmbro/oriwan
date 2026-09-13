export type LockerState = 'available' | 'requested' | 'used';
export type LockerAction = 'grant' | 'request' | 'complete' | 'reject';
export type LockerEvent = { revision:number; operationId:string; itemId:string; action:LockerAction; at:string; actor:string; role:'admin'|'member'; title?:string; note:string };
export type LockerItem = { id:string; title:string; receivedAt:string; source:'gift'|'admin'; status:LockerState; history:LockerEvent[] };
export type LockerClaim = { id:string; message:string; claimed_at:string };
export type LockerSnapshot = { revision:number; items:LockerItem[] };
export const LOCKER_LABELS:Record<LockerState,string> = {available:'사용 가능',requested:'요청 중',used:'사용 완료'};
export const LOCKER_ACTIONS:Record<LockerAction,string> = {grant:'지급',request:'사용 요청',complete:'사용 완료',reject:'반려'};
export function lockerSnapshot(claims:LockerClaim[], events:LockerEvent[]):LockerSnapshot {
 const items=new Map<string,LockerItem>();
 for(const c of claims) if(c.message.startsWith('🎁 ')) items.set(`gift-${c.id}`,{id:`gift-${c.id}`,title:c.message.slice(3).trim(),receivedAt:c.claimed_at,source:'gift',status:'available',history:[]});
 const ordered=[...events].sort((a,b)=>a.revision-b.revision);
 for(const e of ordered) {
  if(e.action==='grant') items.set(e.itemId,{id:e.itemId,title:e.title!,receivedAt:e.at,source:'admin',status:'available',history:[]});
  const item=items.get(e.itemId); if(!item) throw new Error('보관함 이력을 확인하지 못했어요.');
  item.history.push(e);
  item.status=e.action==='request'?'requested':e.action==='complete'?'used':'available';
 }
 return {revision:ordered.at(-1)?.revision??0,items:[...items.values()].sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))};
}
export function validateLockerAction(snapshot:LockerSnapshot, role:'admin'|'member', action:LockerAction, itemId:string, title:string, note:string):string|null {
 if(!['grant','request','complete','reject'].includes(action)) return '지원하지 않는 요청이에요.';
 if(!note.trim() || note.length>1000) return '요청 내용 또는 처리 사유를 1~1,000자로 입력해주세요.';
 if(role==='member' && action!=='request') return '운영자만 처리할 수 있어요.';
 const item=snapshot.items.find(i=>i.id===itemId);
 if(action==='grant') return !title.trim()||title.length>160||item?'항목 이름을 확인해주세요.':null;
 if(!item) return '보관함 항목을 찾을 수 없어요.';
 if(action==='request' && item.status!=='available') return '사용 가능한 항목만 요청할 수 있어요.';
 if((action==='complete'||action==='reject')&&item.status!=='requested') return '요청 중인 항목만 처리할 수 있어요.';
 return null;
}
