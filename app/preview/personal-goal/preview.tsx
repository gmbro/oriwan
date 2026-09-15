"use client";
import { useEffect, useRef, useState } from "react";
import { lockerSnapshot } from "@/lib/member-locker";
import { ActivityIcon } from "@/components/activity-icon";

import { DailyGiftBox, type GiftStatus } from "@/components/daily-gift-box";
import { OperatorSupport } from "@/components/operator-support";
import { DailyFortune } from "@/components/daily-fortune";
import { CorrectiveExerciseApplication } from "@/components/corrective-exercise-application";
import { MemberLocker } from "@/components/member-locker";
import Content from "@/components/my-activity-content";
import { buildPersonalRecordsPayload } from "@/lib/personal-records";
import { usePageScrollLock } from "@/lib/use-page-scroll-lock";
import { Hello2027BannerCarousel } from "@/app/poc/hello-2027/hello-2027-banner-carousel";
import { PublicSiteFooter } from "@/components/public-site-footer";
import site from "@/app/poc/hello-2027/hello-2027-poc.module.css";
import sheet from "@/components/my-activity.module.css";
import styles from "./preview.module.css";
const today="2026-09-15";
const profile={...buildPersonalRecordsPayload([],today),profile:{display_name:"러너",profile_image_url:null,connection_status:"approved",matched_participant:{id:"preview",name:"러너"}}};
type Panel="내 정보"|"오늘 운동 인증하기"|"멤버 기록"|"프로필"|"후원"|"오늘 운세"|"교정운동"|"보관함"|"응원상자"|null;
export default function Preview(){
 const [goal,setGoal]=useState("");const [draft,setDraft]=useState("");const [editing,setEditing]=useState(false);
 const uploadInput=useRef<HTMLInputElement>(null);
 const [uploading,setUploading]=useState(false);const [uploadError,setUploadError]=useState("");
 const [member,setMember]=useState("러너");const [submissionMessage,setSubmissionMessage]=useState("");const [certified,setCertified]=useState(false);const [panel,setPanel]=useState<Panel>(null);
 const [gift,setGift]=useState<GiftStatus>({eligible:true,participant_name:"러너",record_date:today,claim:null});
 const dialog=useRef<HTMLDialogElement>(null);const heading=useRef<HTMLHeadingElement>(null);const lastFocus=useRef<HTMLElement|null>(null);
 usePageScrollLock(Boolean(panel));
 useEffect(()=>{if(panel){dialog.current?.showModal();heading.current?.focus();}else dialog.current?.close();},[panel]);
 const open=(next:Panel)=>{lastFocus.current=document.activeElement as HTMLElement;setPanel(next);};
 const uploadCapture=async(file:File|undefined)=>{if(!file)return;setUploadError("");if(!file.type.startsWith("image/")){setUploadError("이미지 파일을 선택해주세요.");return;}setUploading(true);try{const bitmap=await createImageBitmap(file);bitmap.close();setCertified(true);}catch{setUploadError("사진을 읽지 못했어요. 다른 캡처본을 선택해주세요.");}finally{setUploading(false);if(uploadInput.current)uploadInput.current.value="";}};
 const close=()=>{setPanel(null);requestAnimationFrame(()=>lastFocus.current?.focus());};
 return <div className={site.page}>
 <header className={site.siteHeader}><div className={`${site.headerInner} ${styles.headerInner}`}><a className={site.brand} href="#top" aria-label="TWTT 홈"><img className={site.brandLogo} src="/brand/twtt-logo.png" alt="TWTT"/></a><div className={site.headerMeta}><span className={styles.previewLabel}>로컬 체험 · 저장 안 됨</span><button className={site.headerAccountLink} onClick={()=>open("내 정보")}>내 정보</button></div></div></header>
 <main id="top" className={styles.main}>
 <section className={styles.goal} aria-label="목표 설정">{editing?<form onSubmit={e=>{e.preventDefault();setGoal(draft.trim());setEditing(false);}}><input aria-label="목표 문구" autoFocus maxLength={80} required minLength={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="100일 동안 다짐을 적어주세요"/><button type="submit">저장</button><button type="button" onClick={()=>setEditing(false)}>취소</button></form>:<button className={styles.goalButton} onClick={()=>{setDraft(goal);setEditing(true);}}>{goal||"100일 동안 다짐을 적어주세요"}<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7l-4-4L4 15v5Z"/></svg></button>}</section>
 <Hello2027BannerCarousel ads={[]} dayPhase="morning" completedToday={certified?1:0} participantCount={5} motionDisabled/>
 <section className={styles.members} aria-label="멤버"><h1>멤버 <span>5명</span></h1><div className={styles.memberGrid}>
 <button className={`${styles.memberCard} ${styles.mine}`} onClick={()=>open("오늘 운동 인증하기")} aria-label={certified ? "러너, 나, 오늘 인증 완료. 내 캘린더 보기" : "러너, 나. 오늘 운동 인증하기"}><img src="/images/poc/hello-2027/default-profile-avatar.webp" alt=""/><div><strong>러너 <span className={styles.meBadge}>나</span></strong><span className={styles.memberHint}>{certified ? "오늘 인증 완료" : "오늘 운동 인증하기"}</span></div><span className={styles.cardArrow} aria-hidden="true">{certified ? "✓" : "→"}</span></button>
 {['멤버 A','멤버 B','멤버 C','멤버 D'].map(name=><button key={name} className={styles.memberCard} onClick={()=>{setMember(name);open("멤버 기록");}}><img src="/images/poc/hello-2027/default-profile-avatar.webp" alt=""/><div><strong>{name}</strong><span className={styles.memberHint}>총 인증일 0일</span></div></button>)}
 </div></section>
 </main><PublicSiteFooter/>
 <dialog ref={dialog} aria-labelledby="home-panel-title" className={sheet.dialog} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><div className={sheet.shell}><header className={sheet.heading}>{panel && ["프로필","보관함","교정운동","후원","오늘 운세"].includes(panel) && <button className={sheet.iconButton} aria-label="내 정보로 돌아가기" onClick={()=>setPanel("내 정보")}>‹</button>}<h2 id="home-panel-title" ref={heading} tabIndex={-1}>{panel === "멤버 기록" ? member : panel === "오늘 운동 인증하기" ? "러너의 기록" : panel}</h2><button className={sheet.iconButton} aria-label="닫기" onClick={close}>×</button></header><div className={styles.panel}>
 {panel==="내 정보"&&<>
 <nav className={styles.accountGrid} aria-label="개인 기능">{([['프로필','profile'],['보관함','gift'],['후원','heart']] as const).map(([title,icon])=><button key={title} onClick={()=>open(title)}><span>{icon==='profile'?<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>:<ActivityIcon kind={icon} size={25}/>}</span>{title}</button>)}</nav>
 <section className={styles.toolSection} aria-labelledby="tools-title"><h3 id="tools-title">도구</h3><nav className={styles.toolGrid} aria-label="도구">{([['교정운동','corrective','교정운동 신청'],['오늘 운세','fortune','오늘의 운세보기']] as const).map(([title,icon,label])=><button key={title} onClick={()=>open(title)}><span><ActivityIcon kind={icon} size={25}/></span>{label}</button>)}</nav></section>
 </>}
 {panel==="오늘 운동 인증하기"&&<>
 <input ref={uploadInput} type="file" accept="image/*" hidden aria-label="운동 캡처본 선택" onChange={e=>void uploadCapture(e.target.files?.[0])}/>
 {!certified?<button className={styles.captureButton} disabled={uploading} onClick={()=>uploadInput.current?.click()}>{uploading?"기록하는 중…":"오늘 운동 인증하기"}</button>:<div className={styles.arrival} role="status"><div><strong>{gift.claim?"오늘 인증을 완료했어요":"응원상자가 도착했어요"}</strong><span>{gift.claim?"받은 항목은 내 정보의 보관함에서 확인해요":"캘린더에 오늘의 기록을 남겼어요"}</span></div><button onClick={()=>setPanel("응원상자")}>{gift.claim?"다시 보기":"열어보기"}</button></div>}
 {uploadError&&<p role="alert">{uploadError}</p>}
 <section className={styles.calendar} aria-label="나의 운동 캘린더"><h3>2026년 9월</h3><div className={styles.week}>{['일','월','화','수','목','금','토'].map(day=><span key={day}>{day}</span>)}</div><div className={styles.days}><span/><span/>{Array.from({length:30},(_,i)=>{const day=i+1;return <div key={day} className={day===15?(certified?styles.recorded:styles.currentDay):undefined}><span>{day}</span>{day===15&&certified&&<small>인증 완료</small>}</div>;})}</div></section>
 </>}
 {panel==="멤버 기록"&&<p>아직 등록된 운동 기록이 없어요.</p>}
 {panel==="프로필"&&<Content standalone section="profile" onSection={()=>{}} onFeature={()=>{}} name="러너" preview={profile} active/>}
 {panel==="후원"&&<OperatorSupport status={{locked:false,nextAt:null,loading:false,error:""}}/>}
 {panel==="오늘 운세"&&<DailyFortune preview defaultName="러너"/>}
 {panel==="교정운동"&&<CorrectiveExerciseApplication preview initialStatus={{participant_name:"러너",accepting_applications:true}}/>}
 {panel==="보관함"&&<MemberLocker preview={lockerSnapshot(gift.claim ? [gift.claim] : [],[])}/>}
 {panel==="응원상자"&&<><DailyGiftBox preview initialStatus={gift} onStatusChange={setGift}/>{gift.claim&&<div className={styles.rewardGuide}><p>{gift.claim.message.startsWith('🎁 ') ? "당첨된 항목을 보관함에 넣었어요." : "당첨된 항목이 있으면 보관함에 자동으로 담겨요."}<br/>내 정보 → 보관함에서 확인할 수 있어요.</p><button onClick={()=>setPanel("보관함")}>보관함 보기 →</button></div>}</>}
 </div></div></dialog>
 </div>;
}
