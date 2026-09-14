"use client";
import { useEffect, useState } from "react";
import { PersonalGoalBanner } from "@/components/personal-goal-banner";
import type { TimeMachineStatus } from "@/components/time-machine-goal-box";
import { MyActivityDialog, openMyActivity } from "@/components/my-activity-dialog";
import { buildPersonalRecordsPayload } from "@/lib/personal-records";
import styles from "@/app/poc/hello-2027/hello-2027-poc.module.css";
const sample: TimeMachineStatus = { state: "opened", progress: 0, server_now: "2026-09-15T00:00:00Z", unlock_at: "", goal: { title: "조금 느려도, 나만의 속도로 꾸준히 달리기", detail: "", commitment: "힘든 날에는 10분이라도 움직이고, 어제의 나를 응원할 거예요.", created_at: "2026-09-15T00:00:00Z" } };
const records=buildPersonalRecordsPayload([],"2026-09-15");
export default function Preview() {
 const [status,setStatus] = useState(sample);
 useEffect(()=>{const change=(event:Event)=>setStatus((event as CustomEvent<TimeMachineStatus>).detail);window.addEventListener("twtt:preview-goal",change);return()=>window.removeEventListener("twtt:preview-goal",change);},[]);
 return <div className={styles.page}><header className={styles.siteHeader}><div className={styles.headerInner}><a href="/" className={styles.brand} aria-label="TWTT 홈"><img src="/brand/twtt-logo.png" alt="TWTT" className={styles.brandLogo}/></a><div className={styles.headerMeta}><span className={styles.headerDateTime}>로컬 미리보기</span><button className={styles.headerAccountLink} onClick={()=>openMyActivity()}>내 정보</button></div></div></header><main className={styles.main}><PersonalGoalBanner preview={status} onEdit={()=>openMyActivity("time-machine")}/><div style={{padding:24,borderRadius:24,background:"white",color:"#6b7684",lineHeight:1.8}}><h1 style={{fontSize:22,color:"#191f28",fontWeight:700}}>운영 화면과 같은 내 정보</h1><p>상단의 내 정보를 눌러 아이콘과 팝업을 확인해보세요. 목표 설정과 광고 후원을 실제 운영 컴포넌트로 보여드립니다.</p><p style={{fontSize:12,marginTop:12}}>예시 계정 · 운영 데이터에 저장되지 않아요</p></div><MyActivityDialog showTrigger={false} name="러너" preview={{...records,goal:status,profile:{display_name:"러너",profile_image_url:null,connection_status:"approved",matched_participant:{id:"preview",name:"러너"}}}}/></main></div>;
}
