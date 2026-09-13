"use client";
import {useSupportStatus} from "@/lib/use-support-status";
import {useState} from "react";
import {ActivityIcon} from "./activity-icon";
import styles from "./operator-support.module.css";
export function OperatorSupport(){
 const status=useSupportStatus();
 const [selected,setSelected]=useState<"coffee"|"bank"|null>(null);const [cheered,setCheered]=useState(false);const [copyStatus,setCopyStatus]=useState("");
 const copy=async()=>{try{await navigator.clipboard.writeText('110489915994');setCopyStatus('계좌번호를 복사했어요. 은행 앱에서 예금주 이경민을 확인해주세요.');}catch{setCopyStatus('복사하지 못했어요. 아래 계좌번호를 길게 눌러 복사해주세요.');}};
 return <section className={styles.support} aria-labelledby="support-title"><h2 id="support-title">함께 이어가는 TWTT</h2><p className={styles.intro}>후원은 자유롭게 선택할 수 있어요. 후원 여부는 인증 승인과 서비스 이용에 영향을 주지 않아요. 보내주신 응원은 서버 운영과 인증 관리, 커뮤니티 운영에 보탬이 됩니다.</p>{status.locked?<p role="status" className={styles.feedback}>감사합니다. 다음 후원은 {new Date(status.nextAt!).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}부터 가능해요.</p>:<fieldset disabled={status.loading||!!status.error} className={styles.choices}>
 <button type="button" onClick={()=>setCheered(true)} className={styles.choice}><span className={`${styles.icon} ${cheered?styles.cheered:''}`}><ActivityIcon kind="heart"/></span><span><strong>마음으로 응원하기</strong><small>따뜻한 마음만으로도 힘이 돼요</small></span></button>
 {cheered&&<p role="status" className={styles.feedback}>응원해주셔서 감사합니다! 모두가 동기부여될 수 있도록 고민해서 운영하겠습니다.</p>}
 <button type="button" aria-expanded={selected==='coffee'} onClick={()=>setSelected(selected==='coffee'?null:'coffee')} className={styles.choice}><span className={styles.icon}><ActivityIcon kind="coffee"/></span><span><strong>커피 쿠폰 선물하기</strong><small>카카오 선물하기로 마음 전하기</small></span></button>
 {selected==='coffee'&&<div className={styles.detail}><h3>커피 한 잔으로 응원해주세요</h3><p>받을 사람 : 이경민</p><a href="https://gift.kakao.com" target="_blank" rel="noopener noreferrer" className={styles.action}>카카오 선물하기 열기 <span className="sr-only">새 창</span></a></div>}
 <button type="button" aria-expanded={selected==='bank'} onClick={()=>setSelected(selected==='bank'?null:'bank')} className={styles.choice}><span className={styles.icon}><ActivityIcon kind="infrastructure"/></span><span><strong>인프라 비용 지원하기</strong><small>최대 1만원까지만 자율 후원</small></span></button>
 {selected==='bank'&&<div className={styles.detail}><h3>1회 자율 후원</h3><dl><div><dt>은행</dt><dd>신한은행</dd></div><div><dt>계좌번호</dt><dd className={styles.account}>110-489-915994</dd></div><div><dt>예금주</dt><dd>이경민</dd></div></dl><button type="button" className={styles.action} onClick={()=>void copy()}>계좌번호 복사</button><p role="status">{copyStatus}</p><small>은행 앱에서 직접 이체해주세요. 자동결제나 자동 출금은 없으며 계좌 복사만으로 송금되지 않아요.</small></div>}
 </fieldset>}<p role="status">{status.error}</p></section>;
}
