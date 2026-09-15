"use client";
import {useSupportStatus} from "@/lib/use-support-status";
import {useState} from "react";
import {ActivityIcon} from "./activity-icon";
import styles from "./operator-support.module.css";
export function OperatorSupport({status:initialStatus}:{status?:ReturnType<typeof useSupportStatus>}={}){
 const loadedStatus=useSupportStatus(!initialStatus);
 const status=initialStatus??loadedStatus;
 const [selected,setSelected]=useState<"coffee"|"bank"|null>(null);const [cheered,setCheered]=useState(false);

 return <section className={styles.support} aria-labelledby="support-title"><h2 id="support-title">함께 이어가는 TWTT</h2><p className={styles.intro}>함께 달리는 하루가 오래 이어지도록, 따뜻한 응원을 보태주세요. 작은 마음 하나하나가 스내사를 가꾸는 큰 힘이 됩니다. 후원은 자유이며, 운동 인증이나 서비스 이용에는 영향을 주지 않아요.</p>{status.locked?<p role="status" className={styles.feedback}>감사합니다. 다음 후원은 {new Date(status.nextAt!).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}부터 가능해요.</p>:<fieldset disabled={status.loading||!!status.error} className={styles.choices}>
 <button type="button" onClick={()=>setCheered(true)} className={styles.choice}><span className={`${styles.icon} ${cheered?styles.cheered:''}`}><ActivityIcon kind="heart"/></span><span><strong>마음으로 응원하기</strong></span></button>
 {cheered&&<p role="status" className={styles.feedback}>응원해주셔서 감사합니다! 모두가 동기부여될 수 있도록 고민해서 운영하겠습니다.</p>}
 <button type="button" aria-expanded={selected==='coffee'} onClick={()=>setSelected(selected==='coffee'?null:'coffee')} className={styles.choice}><span className={styles.icon}><ActivityIcon kind="coffee"/></span><span><strong>커피 한잔 응원하기</strong></span></button>
 {selected==='coffee'&&<div className={styles.detail}><p>보내주신 커피 한 잔은 대시보드 운영에 큰 힘이 됩니다.<br/>응원해주시는 마음, 고맙게 받겠습니다.</p><a href="https://gift.kakao.com" target="_blank" rel="noopener noreferrer" className={styles.action}>카카오 선물하기 열기 <span className="sr-only">새 창</span></a></div>}
 <button type="button" aria-expanded={selected==='bank'} onClick={()=>setSelected(selected==='bank'?null:'bank')} className={styles.choice}><span className={styles.icon}><ActivityIcon kind="infrastructure"/></span><span><strong>광고 후원하기</strong></span></button>
 {selected==='bank'&&<div className={styles.detail}>
 <div><span className={styles.price}>월 10,000원</span><h3>우리의 달리기를 응원하고, 내 브랜드를 소개해요</h3></div>
 <p>홈 광고 배너에 브랜드, 서비스, 가게를 소개할 수 있어요. 어떤 광고를 하고 싶은지 운영자에게 먼저 문의해주세요.</p>
 <dl className={styles.guide}>
 <div><dt>노출 위치</dt><dd>홈 상단 광고 배너 · 다른 배너와 순환 노출</dd></div>
 <div><dt>게시 기간</dt><dd>시작일부터 1개월 · 시작일은 운영자와 협의</dd></div>
 <div><dt>이미지</dt><dd>권장 1915 × 821px (약 2.33:1)<br/>JPG·PNG·WebP 1장, 4MB 이하</dd></div>
 <div><dt>준비할 문구</dt><dd>브랜드명 20자 · 제목 30자 · 설명 60자 이내<br/>공백 포함, 이미지와 별도로 보내주세요.</dd></div>
 <div><dt>연결 링크</dt><dd>클릭했을 때 열릴 HTTPS 주소 1개</dd></div>
 </dl>
 <small>사진은 제품이나 공간이 잘 보이는 이미지로 준비해주세요. 모바일에서는 가장자리가 잘릴 수 있어 중요한 피사체는 가운데 배치하고, 문구는 이미지에 넣지 않는 것을 권장해요.</small>
 <p>광고 내용과 희망 시작일을 보내주시면 운영자가 가능 여부와 일정을 안내해드려요. 게시 일정이 확정된 후 후원 방법을 안내합니다.</p>
 <a className={styles.action} href="mailto:gmbro7942@gmail.com?subject=TWTT%20스폰서%20후원%20문의">운영자에게 광고 문의하기 ↗</a>
 <small>gmbro7942@gmail.com · 자동 연장 없이 1개월 단위로 협의해요.</small>
 </div>}
 </fieldset>}<p role="status">{status.error}</p></section>;
}
