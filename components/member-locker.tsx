'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { LOCKER_LABELS,LOCKER_ACTIONS,type LockerSnapshot,type LockerAction,type LockerState } from '@/lib/member-locker';
import styles from './member-locker.module.css';
const date=(v:string)=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'});
export function MemberLocker({admin=false,participantId,preview}:{admin?:boolean;participantId?:string;preview?:LockerSnapshot}){
 const url=admin?`/api/admin/hello-2027/locker?participant=${participantId}`:'/api/me/locker';
 const [data,setData]=useState<LockerSnapshot|null>(preview??null);const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [filter,setFilter]=useState<LockerState>('available');const [title,setTitle]=useState('');const [grantNote,setGrantNote]=useState('');const [notes,setNotes]=useState<Record<string,string>>({});
 const operation=useRef<{signature:string;id:string}|null>(null);
 const load=useCallback(async()=>{if(preview)return;setError('');try{const r=await fetch(url,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);}catch(e){setError(e instanceof Error?e.message:'불러오지 못했어요.');}},[url,preview]);
 useEffect(()=>{void load();},[load]);
 async function mutate(action:LockerAction,itemId:string,note:string){
  if(preview){setMessage('미리보기에서는 실제 지급·요청을 하지 않아요.');return;}
  if(!data||busy)return;setBusy(true);setError('');setMessage('');
  const signature=JSON.stringify([action,itemId,title,note]);
  if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()};
  try{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,itemId,title,note,revision:data.revision,operationId:operation.current.id})});const j=await r.json();
   if(!r.ok)throw new Error(j.error||'처리하지 못했어요.');
   setData(j);operation.current=null;setNotes(n=>({...n,[itemId]:''}));if(action==='grant'){setTitle('');setGrantNote('');}
   setMessage(action==='request'?'사용 요청을 보냈어요. 운영자가 확인 후 처리해요.':action==='grant'?'보관함에 지급했어요.':'처리 내용을 저장했어요.');
   setFilter(action==='request'?'requested':action==='complete'?'used':'available');
  }catch(e){setError(e instanceof Error?e.message:'처리하지 못했어요.');}finally{setBusy(false);}
 }
 return <section className={styles.locker} aria-label={admin?'멤버 보관함':'내 보관함'}>
  <p className={styles.help}>인증박스에서 받은 상품과 운영자가 지급한 항목을 모았어요. 사용을 요청하면 운영자가 확인 후 처리해요.</p>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status" className={styles.notice}>{message}</p>}
  <button className={styles.refresh} disabled={busy} onClick={()=>void load()}>새로고침</button>
  {admin&&<details className={styles.grant}><summary>항목 직접 지급</summary><form onSubmit={e=>{e.preventDefault();void mutate('grant','',grantNote);}}>
   <label>항목 이름<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 크루 재능기부 1회권"/></label>
   <label>지급 사유 · 사용 방법<textarea required maxLength={1000} value={grantNote} onChange={e=>setGrantNote(e.target.value)} placeholder="제공 내용과 사용 방법을 적어주세요."/></label>
   <button disabled={busy||!data} className={styles.primary}>{busy?'처리 중…':'이 멤버에게 지급'}</button>
  </form></details>}
  {!data&&!error&&<p role="status">보관함을 불러오고 있어요.</p>}
  {data&&<><div className={styles.filters} role="group" aria-label="보관함 상태">{(['available','requested','used'] as const).map(s=><button key={s} aria-pressed={filter===s} onClick={()=>setFilter(s)}>{LOCKER_LABELS[s]}<span>{data.items.filter(i=>i.status===s).length}</span></button>)}</div>
   {!data.items.some(i=>i.status===filter)&&<div className={styles.empty}>{filter==='available'?'사용 가능한 항목이 없어요.':filter==='requested'?'요청 중인 항목이 없어요.':'사용 완료한 항목이 없어요.'}</div>}
   {data.items.filter(i=>i.status===filter).map(item=><article key={item.id} className={styles.item}>
    <span className={styles.badge}>{LOCKER_LABELS[item.status]}</span><h3>{item.title}</h3><p className={styles.help}>{item.source==='gift'?'인증박스 당첨':'운영자 지급'} · {date(item.receivedAt)}</p>
    {item.history.at(-1)?.note&&<p className={styles.note}>{item.history.at(-1)?.note}</p>}
    {((!admin&&item.status==='available')||(admin&&item.status==='requested'))&&<form onSubmit={e=>{e.preventDefault();void mutate(admin?'complete':'request',item.id,notes[item.id]||'');}}>
     <label>{admin?'처리 결과 · 반려 사유':'사용 요청 내용'}<textarea required maxLength={1000} value={notes[item.id]||''} onChange={e=>setNotes(n=>({...n,[item.id]:e.target.value}))} placeholder={admin?'적용 날짜와 처리 결과, 또는 반려 사유를 적어주세요.':'원하는 날짜와 내용을 적어주세요. 흑기사는 복사할 멤버, 3일 휴식권은 날짜 3개를 알려주세요.'}/></label>
     {admin&&<p className={styles.help}>실제 기록 반영이나 혜택 제공을 마친 뒤 완료 처리해주세요. 이 버튼이 운동 기록을 자동으로 변경하지는 않아요.</p>}
     <div className={styles.actions}><button className={styles.primary} disabled={busy}>{busy?'처리 중…':admin?'제공 완료 처리':'사용 요청'}</button>{admin&&<button type="button" disabled={busy||!notes[item.id]?.trim()} onClick={()=>void mutate('reject',item.id,notes[item.id]||'')}>반려 · 사용 가능으로 돌리기</button>}</div>
    </form>}
    <details className={styles.history}><summary>받은 내역 · 처리 이력</summary><ol><li><strong>{item.source==='gift'?'인증박스에서 받음':'운영자가 지급'}</strong><time>{date(item.receivedAt)}</time></li>{item.history.map(e=><li key={e.operationId}><strong>{LOCKER_ACTIONS[e.action]} · {e.role==='admin'?'운영자':'멤버'}</strong><time>{date(e.at)}</time><p>{e.note}</p></li>)}</ol></details>
   </article>)}
  </>}
 </section>;
}
export function AdminMemberLocker(){
 const [members,setMembers]=useState<{id:string;name:string}[]>([]);const [id,setId]=useState('');const [error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch('/api/admin/hello-2027/locker',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);setMembers(j.participants);setError('');}catch(e){setError(e instanceof Error?e.message:'멤버를 불러오지 못했어요.');}},[]);
 useEffect(()=>{void load();},[load]);
 return <section className={styles.admin}><h2>멤버 보관함</h2><p className={styles.help}>멤버별 보유 항목과 사용 요청을 확인하고 지급·완료·반려를 처리합니다.</p>{error&&<p role="alert">{error}<button onClick={()=>void load()}>다시 불러오기</button></p>}<label>멤버 선택<select value={id} onChange={e=>setId(e.target.value)}><option value="">멤버를 선택해주세요</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{id&&<MemberLocker key={id} admin participantId={id}/>}</section>;
}

export function LockerEntry({onOpen,active,disabled=false,preview=false}:{onOpen:()=>void;active:boolean;disabled?:boolean;preview?:boolean}){
 const [counts,setCounts]=useState<{available:number;requested:number}|null>(null);
 useEffect(()=>{
  if(!active||disabled||preview)return;
  let alive=true;
  fetch('/api/me/locker',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then((s:LockerSnapshot)=>{if(alive)setCounts({available:s.items.filter(i=>i.status==='available').length,requested:s.items.filter(i=>i.status==='requested').length});}).catch(()=>{if(alive)setCounts(null);});
  return()=>{alive=false;};
 },[active,disabled,preview]);
 return <button type="button" className={styles.entry} disabled={disabled} onClick={onOpen}><span><strong>{counts?`사용 가능한 항목 ${counts.available}개`:'내 보관함'}</strong><small>{counts?.requested?`요청 중 ${counts.requested}개 · 받은 항목과 사용 내역`:'받은 항목 · 사용 요청 · 사용 내역'}</small></span><span aria-hidden="true">→</span></button>;
}
