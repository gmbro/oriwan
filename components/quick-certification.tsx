"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {reduceScreenshot} from "./my-activity-upload";
import {validateCertificationDate, type MemberUploadDraft} from "@/lib/member-upload-contract";
import {openMyActivity} from "./my-activity-dialog";
import {certificationDay,untilNextCertificationDay,hasCertification,certificationFailure} from "@/lib/certification-ui";
import {DASHBOARD_REFRESH_DOM_EVENT} from "@/lib/dashboard-refresh-contract";
import styles from "./my-activity.module.css";
class CertificationError extends Error { constructor(readonly status:number, message:string){super(message);} }
export function QuickCertification({today,onSaved}:{today:string;onSaved:()=>void}){
 const input=useRef<HTMLInputElement>(null);const busy=useRef(false);const generation=useRef(0);const alive=useRef(true);
 const [day,setDay]=useState(today);const [selectedDate,setSelectedDate]=useState(today);const submittedDate=useRef(today);
 const [records,setRecords]=useState<{date:string;status:string}[]>([]);const completed=hasCertification(records,selectedDate);
 const [checking,setChecking]=useState(true);const [available,setAvailable]=useState(false);
 const [pending,setPending]=useState(false);const [arrival,setArrival]=useState("");const [draft,setDraft]=useState<MemberUploadDraft|null>(null);
 const draftRef=useRef<MemberUploadDraft|null>(null);useEffect(()=>{draftRef.current=draft;},[draft]);
 const refresh=useCallback(async(date=certificationDay())=>{const request=++generation.current;setChecking(true);try{
  const response=await fetch("/api/me/records",{cache:"no-store"});const data=await response.json();
  if(!response.ok||!Array.isArray(data.records)||!data.season?.today)throw new CertificationError(response.status,"인증 상태 조회 실패");
  const done=hasCertification(data.records,date);
  if(alive.current&&request===generation.current){setDay(data.season.today);setRecords(data.records);setAvailable(true);}
  return done;
 }catch(e){if(alive.current&&request===generation.current)setAvailable(false);throw e;}finally{if(alive.current&&request===generation.current)setChecking(false);}},[]);
 useEffect(()=>{alive.current=true;let timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{const previous=certificationDay();timer=setTimeout(()=>{const next=certificationDay();setDay(next);if(!busy.current&&!draftRef.current)setSelectedDate(current=>current===previous?next:current);setArrival("");void refresh().catch(()=>{});schedule();},untilNextCertificationDay()+50);};
  const check=()=>{if(document.visibilityState==="visible")void refresh().catch(()=>{});};
  void refresh().catch(()=>{});schedule();window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT,check);
  return()=>{alive.current=false;generation.current++;clearTimeout(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT,check);};
 },[refresh]);
 const save=async(value:MemberUploadDraft)=>{
  const response=await fetch("/api/me/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draftId:value.id,date:submittedDate.current})});
  const data=await response.json();if(!response.ok||!data.record?.id)throw new CertificationError(response.status,data.error||"");
  const date=data.record.date;
  if(alive.current){setDraft(null);setRecords(current=>[...current,{date,status:"certified"}]);if(date===certificationDay())setArrival(date);onSaved();void refresh().catch(()=>{});}
 };
 const run=async(file?:File)=>{if(busy.current)return;busy.current=true;setPending(true);try{
  if(await refresh(submittedDate.current)){setDraft(null);return;}
  let value=draft;
  if(file){setDraft(null);const prepared=await reduceScreenshot(file);const form=new FormData();form.set("file",prepared);const response=await fetch("/api/me/records/analyze",{method:"POST",body:form});const data=await response.json();if(!response.ok||!data.draft)throw new CertificationError(response.status,data.error||"");value=data.draft;setDraft(value);}
  if(value)await save(value);
 }catch(e){if(e instanceof CertificationError&&e.status===422)setDraft(null);if(e instanceof CertificationError&&e.status===409)await refresh(submittedDate.current).catch(()=>false);if(alive.current)window.alert(certificationFailure(e instanceof CertificationError?e.status:0,e instanceof Error?e.message:""));}finally{busy.current=false;if(alive.current)setPending(false);if(input.current)input.current.value="";}};
 const choose=()=>{if(!available){void refresh().catch(e=>window.alert(certificationFailure(e instanceof CertificationError?e.status:0)));return;}const valid=validateCertificationDate(selectedDate,certificationDay());if(!valid.ok){window.alert(valid.error);return;}if(!window.confirm(`${selectedDate}${selectedDate===certificationDay()?" (오늘)":""}의 운동으로 인증할까요?`))return;submittedDate.current=selectedDate;input.current?.click();};
 return <div className={styles.quickCertification}>
 <label className={styles.certificationDate}>인증 날짜<input aria-label="인증 날짜" type="date" min="2026-08-13" max={day<"2026-12-31"?day:"2026-12-31"} value={selectedDate} disabled={pending||Boolean(draft)} onChange={e=>setSelectedDate(e.target.value)}/></label>
 <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void run(e.target.files?.[0])}/>
 <button className={styles.primary} disabled={completed||pending||checking||Boolean(draft)} onClick={choose}>{completed?(selectedDate===day?"오늘 인증완료!":"선택한 날짜 인증완료!"):pending?"기록하는 중…":checking?"인증 확인 중…":!available?"인증 상태 다시 확인":"운동 인증하기"}</button>
 {arrival===day&&<div className={styles.arrival}><strong>응원상자가 도착했어요</strong><button className={styles.primary} onClick={()=>{setArrival("");openMyActivity("gift");}}>열어보기</button></div>}
 {draft&&!completed&&!pending&&<button className={styles.secondary} onClick={()=>void run()}>저장 다시 시도</button>}
 {draft&&!pending&&<button className={styles.secondary} onClick={()=>setDraft(null)}>다른 사진 선택</button>}
 </div>;
}
