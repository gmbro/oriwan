"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {reduceScreenshot} from "./my-activity-upload";
import type {MemberUploadDraft} from "@/lib/member-upload-contract";
import {openMyActivity} from "./my-activity-dialog";
import {certificationDay,untilNextCertificationDay,hasCertification,certificationFailure} from "@/lib/certification-ui";
import {DASHBOARD_REFRESH_DOM_EVENT} from "@/lib/dashboard-refresh-contract";
import styles from "./my-activity.module.css";
class CertificationError extends Error { constructor(readonly status:number, message:string){super(message);} }
export function QuickCertification({today,onSaved}:{today:string;onSaved:()=>void}){
 const input=useRef<HTMLInputElement>(null);const busy=useRef(false);const generation=useRef(0);const alive=useRef(true);
 const [day,setDay]=useState(today);const [completed,setCompleted]=useState(false);const [checking,setChecking]=useState(true);const [available,setAvailable]=useState(false);
 const [pending,setPending]=useState(false);const [arrival,setArrival]=useState("");const [draft,setDraft]=useState<MemberUploadDraft|null>(null);
 const refresh=useCallback(async()=>{const request=++generation.current;setChecking(true);try{
  const response=await fetch("/api/me/records",{cache:"no-store"});const data=await response.json();
  if(!response.ok||!Array.isArray(data.records)||!data.season?.today)throw new CertificationError(response.status,"인증 상태 조회 실패");
  const done=hasCertification(data.records,data.season.today);
  if(alive.current&&request===generation.current){setDay(data.season.today);setCompleted(done);setAvailable(true);}
  return done;
 }catch(e){if(alive.current&&request===generation.current)setAvailable(false);throw e;}finally{if(alive.current&&request===generation.current)setChecking(false);}},[]);
 useEffect(()=>{alive.current=true;let timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{timer=setTimeout(()=>{setDay(certificationDay());setCompleted(false);setArrival("");setDraft(null);void refresh().catch(()=>{});schedule();},untilNextCertificationDay()+50);};
  const check=()=>{if(document.visibilityState==="visible")void refresh().catch(()=>{});};
  void refresh().catch(()=>{});schedule();window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT,check);
  return()=>{alive.current=false;generation.current++;clearTimeout(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT,check);};
 },[refresh]);
 const save=async(value:MemberUploadDraft)=>{
  const response=await fetch("/api/me/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draftId:value.id})});
  const data=await response.json();if(!response.ok||!data.record?.id)throw new CertificationError(response.status,data.error||"");
  const date=data.record.date;
  if(alive.current){setDraft(null);if(date===certificationDay()){setCompleted(true);setArrival(date);}onSaved();void refresh().catch(()=>{});}
 };
 const run=async(file?:File)=>{if(busy.current)return;busy.current=true;setPending(true);try{
  if(await refresh())return;
  let value=draft;
  if(file){setDraft(null);const prepared=await reduceScreenshot(file);const form=new FormData();form.set("file",prepared);const response=await fetch("/api/me/records/analyze",{method:"POST",body:form});const data=await response.json();if(!response.ok||!data.draft)throw new CertificationError(response.status,data.error||"");value=data.draft;setDraft(value);}
  if(value)await save(value);
 }catch(e){if(e instanceof CertificationError&&e.status===422)setDraft(null);let done=false;if(e instanceof CertificationError&&e.status===409)done=await refresh().catch(()=>false);if(alive.current&&!done)window.alert(certificationFailure(e instanceof CertificationError?e.status:0,e instanceof Error?e.message:""));}finally{busy.current=false;if(alive.current)setPending(false);if(input.current)input.current.value="";}};
 const choose=()=>{if(!available){void refresh().catch(e=>window.alert(certificationFailure(e instanceof CertificationError?e.status:0)));return;}input.current?.click();};
 return <div className={styles.quickCertification}>
 <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void run(e.target.files?.[0])}/>
 <button className={styles.primary} disabled={completed||pending||checking} onClick={choose}>{completed?"오늘 인증완료!":pending?"기록하는 중…":checking?"인증 확인 중…":!available?"인증 상태 다시 확인":"오늘 운동 인증하기"}</button>
 {arrival===day&&<div className={styles.arrival}><strong>응원상자가 도착했어요</strong><button className={styles.primary} onClick={()=>{setArrival("");openMyActivity("gift");}}>열어보기</button></div>}
 {draft&&!completed&&!pending&&<button className={styles.secondary} onClick={()=>void run()}>저장 다시 시도</button>}
 </div>;
}
