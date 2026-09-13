"use client";
export function formatKoreanExerciseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "날짜 확인 필요";
  const [y,m,d] = value.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
export function KoreanExerciseDate({value,onChange,min,max,disabled=false}:{value:string;onChange:(value:string)=>void;min:string;max:string;disabled?:boolean}) {
 const [year,month,day]=(value || max).split('-').map(Number);
 const iso=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const update=(y:number,m:number,d:number)=>{const next=iso(y,m,Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate()));onChange(next<min?min:next>max?max:next);};
 const years=Array.from({length:Number(max.slice(0,4))-Number(min.slice(0,4))+1},(_,i)=>Number(min.slice(0,4))+i);
 return <div role="group" aria-label="운동한 날짜" lang="ko" style={{display:'flex',gap:8,width:'100%'}}>
 <select aria-label="운동 연도" value={year} disabled={disabled} onChange={e=>update(Number(e.target.value),month,day)} style={{minWidth:0,flex:1}}>{years.map(y=><option key={y} value={y}>{y}년</option>)}</select>
 <select aria-label="운동 월" value={month} disabled={disabled} onChange={e=>update(year,Number(e.target.value),day)} style={{minWidth:0,flex:1}}>{Array.from({length:12},(_,i)=>i+1).filter(m=>iso(year,m,31)>=min&&iso(year,m,1)<=max).map(m=><option key={m} value={m}>{m}월</option>)}</select>
 <select aria-label="운동 일" value={day} disabled={disabled} onChange={e=>update(year,month,Number(e.target.value))} style={{minWidth:0,flex:1}}>{Array.from({length:new Date(Date.UTC(year,month,0)).getUTCDate()},(_,i)=>i+1).filter(d=>iso(year,month,d)>=min&&iso(year,month,d)<=max).map(d=><option key={d} value={d}>{d}일</option>)}</select>
 </div>;
}
