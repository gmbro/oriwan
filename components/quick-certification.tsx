"use client";
import {useRef,useState} from "react";
import {reduceScreenshot} from "./my-activity-upload";
import type {MemberUploadDraft} from "@/lib/member-upload-contract";
import {openMyActivity} from "./my-activity-dialog";
import styles from "./my-activity.module.css";
export function QuickCertification({today,onSaved}:{today:string;onSaved:()=>void}){
 const input=useRef<HTMLInputElement>(null);const busy=useRef(false);
 const [pending,setPending]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState("");const [draft,setDraft]=useState<MemberUploadDraft|null>(null);
 const save=async(value:MemberUploadDraft)=>{
  const date=value.activityDate||value.date;
  if(!date||value.distanceKm===null||value.durationSeconds===null)throw new Error("날짜·거리·시간이 잘 보이는 캡처본을 다시 올려주세요.");
  const response=await fetch("/api/me/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draftId:value.id,date,distanceKm:value.distanceKm,durationSeconds:value.durationSeconds})});
  const data=await response.json();if(!response.ok||!data.record?.id)throw new Error(data.error||"저장하지 못했어요. 다시 시도해주세요.");
  setSaved(date);setDraft(null);onSaved();
 };
 const run=async(file?:File)=>{if(busy.current)return;busy.current=true;setPending(true);setError("");try{
  let value=draft;
  if(file){setDraft(null);const prepared=await reduceScreenshot(file);const form=new FormData();form.set("file",prepared);const response=await fetch("/api/me/records/analyze",{method:"POST",body:form});const data=await response.json();if(!response.ok||!data.draft)throw new Error(data.error||"사진을 읽지 못했어요.");value=data.draft;setDraft(value);}
  if(value)await save(value);
 }catch(e){setError(e instanceof Error?e.message:"다시 시도해주세요.");}finally{busy.current=false;setPending(false);if(input.current)input.current.value="";}};
 return <div className={styles.quickCertification}>
 <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void run(e.target.files?.[0])}/>
 {saved===today?<div className={styles.arrival}><strong>응원상자가 도착했어요</strong><button className={styles.primary} onClick={()=>openMyActivity("gift")}>열어보기</button></div>:<><button className={styles.primary} disabled={pending} onClick={()=>input.current?.click()}>{pending?"기록하는 중…":"오늘 운동 인증하기"}</button>{saved&&<p role="status">{saved} 기록을 저장했어요.</p>}</>}
 {error&&<div role="alert"><p>{error}</p>{draft&&<button className={styles.secondary} disabled={pending} onClick={()=>void run()}>저장 다시 시도</button>}</div>}
 </div>;
}
