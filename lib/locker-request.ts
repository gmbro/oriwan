import {createWarmRequest} from './warm-request';
import type {LockerSnapshot} from './member-locker';
// Each dialog owns its cache; never share private data at module scope.
export function createLockerRequest(url='/api/me/locker'){
 return createWarmRequest<LockerSnapshot>(async()=>{
  const response=await fetch(url,{cache:'no-store'});const data=await response.json();
  if(!response.ok)throw new Error(data.error||'보관함을 불러오지 못했어요.');
  return data;
 },15_000);
}
export type LockerRequest=ReturnType<typeof createLockerRequest>;
