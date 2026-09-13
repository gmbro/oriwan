"use client";
import { useEffect, useState } from "react";
export function useSupportStatus(enabled=true){
 const [state,setState]=useState<{locked:boolean;nextAt:string|null;loading:boolean;error:string}>({locked:false,nextAt:null,loading:true,error:""});
 useEffect(()=>{
  if(!enabled)return;
  let active=true;
  const refresh=async()=>{try{const r=await fetch('/api/support',{cache:'no-store'});if(!r.ok)throw new Error();const v=await r.json();if(active)setState({...v,loading:false,error:""});}catch{if(active)setState(s=>({...s,loading:false,error:"후원 상태를 확인하지 못했어요."}));}};
  void refresh();window.addEventListener('twtt:support-updated',refresh);window.addEventListener('focus',refresh);
  const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},60_000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('twtt:support-updated',refresh);window.removeEventListener('focus',refresh);};
 },[enabled]);
 return state;
}
