"use client";
import {useEffect,useRef} from "react";
import styles from "./my-activity.module.css";

export function CertificationGuide({message,onClose,onConfirm,information=false}:{message:string;onClose:()=>void;onConfirm?:()=>void;information?:boolean}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const current=dialog.current;if(current&&!current.open)current.showModal();return()=>{current?.close();};},[]);
 return <dialog ref={dialog} className={styles.certificationGuide} aria-labelledby="certification-guide-title" onCancel={event=>{event.preventDefault();onClose();}}>
   <h3 id="certification-guide-title">{onConfirm ? "개인 기록으로 저장할까요?" : information ? "기록을 저장했어요" : "인증 내용을 확인해주세요"}</h3>
   <p style={{whiteSpace:"pre-line"}}>{message}</p>
   {!onConfirm && !information && <p className={styles.muted}>운동 거리 3km 이상 · 시작 시각 오전 8시 이전<br/>두 정보가 함께 보이는 사진을 선택해주세요. 인식이 어렵거나 예외 등록이 필요하면 운영자에게 문의해주세요.</p>}
   {onConfirm && <button type="button" className={styles.primary} onClick={onConfirm}>개인 기록으로 저장</button>}
   <button type="button" autoFocus className={styles.primary} onClick={onClose}>{onConfirm ? "취소" : "확인"}</button>
 </dialog>;
}
