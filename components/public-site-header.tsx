"use client";
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useOptionalFourthViewer} from './fourth-viewer-provider';
import {KakaoLoginButton} from './kakao-login-button';
import {openMyActivity,MyActivityDialog} from './my-activity-dialog';
import styles from '@/app/poc/hello-2027/hello-2027-poc.module.css';
export function PublicSiteHeader({memberFeatures=true,withDialog=false}:{memberFeatures?:boolean;withDialog?:boolean}){
 const viewer=useOptionalFourthViewer();const path=usePathname();const [clock,setClock]=useState('');
 useEffect(()=>{const tick=()=>setClock(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()));tick();const timer=setInterval(tick,60_000);return()=>clearInterval(timer);},[]);
 return <><header className={styles.siteHeader}><div className={styles.headerInner}><Link className={styles.brand} href="/" aria-label="TWTT 홈" onClick={e=>{if(path==='/'){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}}}><Image className={styles.brandLogo} src="/brand/twtt-logo.png" alt="" width={640} height={310} sizes="(max-width:760px) 58px,78px"/></Link><div className={styles.headerMeta}><time className={styles.headerDateTime}><span style={{color:'#3182f6',fontWeight:800}}>TODAY</span><span>{clock||'--:--'}</span></time>{memberFeatures&&<div className={styles.headerAccount}>{viewer?.loading?<span className={styles.headerAuthLoading}/>:viewer?.viewer?.authenticated?<><button className={styles.headerAccountLink} onClick={()=>openMyActivity()}>내 정보</button><button className={styles.headerLogoutButton} disabled={viewer.actionPending} onClick={()=>void viewer.logout()}>로그아웃</button></>:<KakaoLoginButton nextPath="/4th/dashboard" label="로그인" variant="compact" restart/>}</div>}</div></div></header>{withDialog&&viewer?.viewer?.authenticated&&<MyActivityDialog key={viewer.viewer.participant_id??"unlinked"} showTrigger={false} name={viewer.viewer.display_name||'멤버'}/>}</>;
}
