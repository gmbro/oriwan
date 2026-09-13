export function ActivityIcon({kind,size=24}:{kind:"time-machine"|"gift"|"fortune"|"corrective"|"heart"|"coffee"|"infrastructure";size?:number}){
 const paths={
  'time-machine':<><path d="M7 3h10M7 21h10M8 3v4l4 5-4 5v4m8-18v4l-4 5 4 5v4"/><path d="M10 18h4"/></>,
  gift:<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/></>,
  fortune:<><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/><path d="M20 3v4m-2-2h4"/></>,
  corrective:<><circle cx="13" cy="4" r="2"/><path d="m6 11 5-3 5 3h5M11 8l-2 7-5 5m5-5 6 1 2 5"/></>,
  heart:<path d="M20 5a5 5 0 0 0-7 0l-1 1-1-1a5 5 0 0 0-7 7l8 8 8-8a5 5 0 0 0 0-7Z"/>,
  coffee:<><path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8Zm12 1h2a3 3 0 0 1 0 6h-2M8 3v2m5-2v2M3 22h17"/></>,
  infrastructure:<><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M12 7.5h5M12 16.5h5"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
