"use client";
import { useEffect, useState } from "react";
type Goal = { goal_title: string; goal_detail: string; commitment: string };
export function AdminPersonalGoal({ participantId }: { participantId: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const endpoint = "/api/admin/hello-2027/time-machine";
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setMessage("");
    fetch(`${endpoint}?participant_id=${encodeURIComponent(participantId)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGoal(data.goal);setTitle(data.goal?.goal_title ?? "");
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message || "목표를 불러오지 못했어요."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [participantId, retry]);
  async function save(method: "PATCH" | "DELETE") {
    if (busy || !goal) return;
    if (method === "DELETE" && !window.confirm("이 멤버의 100일 목표를 삭제할까요?")) return;
    setBusy(true);setMessage("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participant_id: participantId, goal_title: title, goal_detail: goal.goal_detail, commitment: goal.commitment }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGoal(data.goal);setTitle(data.goal?.goal_title ?? "");setMessage(method === "DELETE" ? "목표를 삭제했어요." : "목표를 수정했어요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했어요."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 border-t border-slate-200 pt-4">
    <label className="block text-sm font-bold">100일 목표<input aria-label="100일 목표" value={title} onChange={event => setTitle(event.target.value)} maxLength={80} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.stopPropagation();}}} disabled={loading || busy || !goal} placeholder={loading ? "불러오는 중…" : "설정한 목표가 없어요"} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-base disabled:bg-slate-50" /></label>
    {goal && <div className="mt-2 flex gap-2"><button type="button" disabled={busy || title.trim().length<2 || title===goal.goal_title} onClick={()=>void save("PATCH")} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm text-white disabled:opacity-40">목표 수정</button><button type="button" disabled={busy} onClick={()=>void save("DELETE")} className="min-h-11 rounded-xl bg-rose-50 px-4 text-sm text-rose-700">목표 삭제</button></div>}
    {message && <p role="status" className="mt-2 text-sm text-slate-600">{message}<button type="button" onClick={()=>setRetry(n=>n+1)} className="ml-3 min-h-11 text-blue-600">새로고침</button></p>}
  </div>;
}
