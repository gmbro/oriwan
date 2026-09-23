"use client";
import {useSupportStatus} from "@/lib/use-support-status";
import {useState} from "react";
import {ActivityIcon} from "./activity-icon";
import styles from "./operator-support.module.css";
export function OperatorSupport({status:initialStatus}:{status?:ReturnType<typeof useSupportStatus>}={}){
 const loadedStatus=useSupportStatus(!initialStatus);
 const status=initialStatus??loadedStatus;
 const [selected,setSelected]=useState<"bank"|null>(null);const [cheered,setCheered]=useState(false);

 return <section className={styles.support} aria-label="후원">{status.locked?<p role="status" className={styles.feedback}>감사합니다. 다음 후원은 {new Date(status.nextAt!).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}부터 가능해요.</p>:<fieldset disabled={status.loading||!!status.error} className={styles.choices}>
 <button type="button" onClick={()=>setCheered(true)} className={styles.choice}><span className={`${styles.icon} ${cheered?styles.cheered:''}`}><ActivityIcon kind="heart"/></span><span><strong>마음으로 응원하기</strong></span></button>
 {cheered&&<p role="status" className={styles.feedback}>응원해주셔서 감사합니다! 모두가 동기부여될 수 있도록 고민해서 운영하겠습니다.</p>}
 <button type="button" aria-expanded={selected==='bank'} onClick={()=>setSelected(selected==='bank'?null:'bank')} className={styles.choice}><span className={styles.icon}><ActivityIcon kind="infrastructure"/></span><span><strong>광고 후원하기</strong></span></button>
 {selected==='bank'&&<div className={styles.detail}>
 <div><span className={styles.price}>비용 10,000원</span><h3>홈 광고 배너에 브랜드를 소개합니다</h3></div>
 <p>운영자에게 갠톡으로 문의부탁드립니다.</p>
 <dl className={styles.guide}>
 <div><dt>기간</dt><dd>~12월 31일까지</dd></div>
 <div><dt>이미지</dt><dd>1915X821 PNG</dd></div>
 <div><dt>문구</dt><dd>브랜드명 20자 설명 50자 이내</dd></div>
 <div><dt>링크</dt><dd>연결URL</dd></div>
 </dl>
 </div>}
 </fieldset>}<p role="status">{status.error}</p></section>;
}
