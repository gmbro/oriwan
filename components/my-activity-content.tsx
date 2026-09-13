"use client";
import { useSupportStatus } from "@/lib/use-support-status";
import { OperatorSupport } from "./operator-support";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonalRecordsPayload } from "@/lib/personal-records";
import type { MyActivityFeatureSeed } from "@/lib/my-activity-feature-seed";
import Records from "./my-activity-records";
import { DEFAULT_HELLO_2027_PROFILE_IMAGE_URL } from "@/lib/hello-2027-profile-image";
import { useOptionalFourthViewer } from "./fourth-viewer-provider";
import { FourthDashboardMemberArea } from "./fourth-dashboard-member-area";
import { DASHBOARD_REFRESH_DOM_EVENT } from "@/lib/dashboard-refresh-contract";
import styles from "./my-activity.module.css";

function SectionLoading() { return <p className={styles.muted} role="status">내용을 준비하고 있어요.</p>; }
// Isolate each chunk's loading state so the three menu buttons stay available.
const Upload = dynamic(() => import("./my-activity-upload"), { loading: SectionLoading });
const Fortune = dynamic(() => import("./daily-fortune").then(m => m.DailyFortune), { loading: SectionLoading });
const Gift = dynamic(() => import("./daily-gift-box").then(m => m.DailyGiftBox), { loading: SectionLoading });
const Corrective = dynamic(() => import("./corrective-exercise-application").then(m => m.CorrectiveExerciseApplication), { loading: SectionLoading });
const TimeMachine = dynamic(() => import("./time-machine-goal-box").then(m => m.TimeMachineGoalBox), { loading: SectionLoading });
type ReadyViews = {
  Upload: typeof import("./my-activity-upload")["default"];
  Fortune: typeof import("./daily-fortune")["DailyFortune"];
  Gift: typeof import("./daily-gift-box")["DailyGiftBox"];
  Corrective: typeof import("./corrective-exercise-application")["CorrectiveExerciseApplication"];
  TimeMachine: typeof import("./time-machine-goal-box")["TimeMachineGoalBox"];
};
export type MyActivitySection = "home" | "profile" | "upload" | "records" | "support" | "fortune" | "gift" | "corrective" | "time-machine";
export type MyActivityData = PersonalRecordsPayload & { profile: { display_name: string; profile_image_url: string | null; connection_status: string; matched_participant: { id: string; name: string } } };

export default function MyActivityContent({ section, onSection, onFeature, name, imageUrl, onChanged, preview, active, featureSeed }: {
  section: MyActivitySection; onSection: (section: MyActivitySection) => void; name: string; imageUrl?: string | null;
  onChanged?: (patch: { displayName?: string; profileImageUrl?: string | null }) => void; preview?: MyActivityData; active: boolean;
  featureSeed?: MyActivityFeatureSeed;
  onFeature: (section: "fortune" | "gift" | "corrective" | "time-machine", seed?: MyActivityFeatureSeed) => void;
}) {
  const supportStatus = useSupportStatus(active);
  const viewer = useOptionalFourthViewer();
  const [data, setData] = useState<MyActivityData | null>(preview ?? null);
  const [error, setError] = useState("");
  const [readyViews, setReadyViews] = useState<Partial<ReadyViews>>({});
  useEffect(() => {
    let alive = true;
    // A warmed import alone still makes React.lazy suspend on its first render.
    // Retain resolved component references too, avoiding that first-tap flash.
    const ready = <Key extends keyof ReadyViews>(key: Key, view: ReadyViews[Key]) => {
      if (alive) setReadyViews(current => ({ ...current, [key]: view }));
    };
    void import("./my-activity-upload").then(m => ready("Upload", m.default)).catch(() => undefined);
    if (preview) return () => { alive = false; };
    void import("./daily-fortune").then(m => ready("Fortune", m.DailyFortune)).catch(() => undefined);
    void import("./daily-gift-box").then(m => ready("Gift", m.DailyGiftBox)).catch(() => undefined);
    void import("./corrective-exercise-application").then(m => ready("Corrective", m.CorrectiveExerciseApplication)).catch(() => undefined);
    void import("./time-machine-goal-box").then(m => ready("TimeMachine", m.TimeMachineGoalBox)).catch(() => undefined);
    return () => { alive = false; };
  }, [preview]);
  const FortuneView = readyViews.Fortune ?? Fortune;
  const UploadView = readyViews.Upload ?? Upload;
  const GiftView = readyViews.Gift ?? Gift;
  const CorrectiveView = readyViews.Corrective ?? Corrective;
  const TimeMachineView = readyViews.TimeMachine ?? TimeMachine;
  const [uploadVisited, setUploadVisited] = useState(false);
  const [profileVisited, setProfileVisited] = useState(false);
  const [todayFallback] = useState(() => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10));
  const generation = useRef(0);
  const loadedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const load = useCallback((force = false): Promise<void> => {
    if (preview) return Promise.resolve();
    if (force) { generation.current += 1; inFlight.current = null; }
    if (inFlight.current) return inFlight.current;
    if (!force && Date.now() - loadedAt.current < 30_000) return Promise.resolve();
    const current = ++generation.current;
    const request = (async () => {
    try {
      const response = await fetch("/api/me/records", { cache: "no-store" });
      const result = await response.json();
      if (current !== generation.current) return;
      if (!response.ok || !result.profile || !result.records) throw new Error(result.error || "내 활동을 불러오지 못했어요.");
      setData(result); setError(""); loadedAt.current = Date.now();
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : "내 활동을 불러오지 못했어요."); }
    })();
    inFlight.current = request;
    void request.finally(() => { if (inFlight.current === request) inFlight.current = null; });
    return request;
  }, [preview]);
  useEffect(() => {
    let subscribed = true;
    queueMicrotask(() => { if (subscribed) void load(); });
    return () => { subscribed = false; };
  }, [load]);
  useEffect(() => {
    if (active && section === "records") queueMicrotask(() => void load());
    const refresh = () => {
      loadedAt.current = 0;
      // Invalidate an older GET before refreshing after a mutation/realtime event.
      generation.current += 1;
      inFlight.current = null;
      if (active && section === "records") void load(true);
    };
    window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT, refresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT, refresh);
  }, [active, section, load]);
  if (section === "upload" && !uploadVisited) setUploadVisited(true);
  if (section === "profile" && !profileVisited) setProfileVisited(true);
  const changed = (patch: { displayName?: string; profileImageUrl?: string | null }) => {
    generation.current += 1;
    inFlight.current = null;
    loadedAt.current = 0;
    setData(current => current ? { ...current, profile: { ...current.profile, ...(patch.displayName === undefined ? {} : { display_name: patch.displayName }), ...(patch.profileImageUrl === undefined ? {} : { profile_image_url: patch.profileImageUrl }) } } : current);
    onChanged?.(patch);
    if (!preview) {
      void viewer?.reload();
      void import("@/lib/dashboard-refresh").then(m => m.broadcastDashboardRefresh()).catch(() => undefined);
    }
  };
  const displayName = data?.profile.display_name || name;
  const avatar = (data ? data.profile.profile_image_url : imageUrl) || DEFAULT_HELLO_2027_PROFILE_IMAGE_URL;
  const connected = preview || viewer?.viewer?.approved_participant;
  const primarySection = ["home", "profile", "upload", "records", "support"].includes(section);
  return <div className={styles.body}>
    {preview && <span className={styles.status}>예시 화면 · 실제 회원 정보 변경 없음</span>}
    {error && section === "records" && <div className={`${styles.feedback} ${styles.error}`} role="alert">{error} <button className={styles.secondary} onClick={() => void load(true)}>다시 확인</button></div>}
    {section === "home" && <div className={styles.identity}><Image unoptimized width={56} height={56} className={styles.avatar} src={avatar} alt="내 프로필" /><strong>{displayName}</strong></div>}
    {primarySection && <>
      <div className={styles.menuList} role="group" aria-label="내 정보 메뉴" data-compact={section !== "home"}>
        {([{ key: "profile", title: "프로필", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></> }, { key: "upload", title: "인증", icon: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 17V7m-4 4 4-4 4 4" /></> }, { key: "records", title: "기록", icon: <><path d="M4 20h17M6 16v-4m6 4V7m6 9V3" /></> }, { key: "support", title: "후원", icon: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /> }] as const).map(item => <button type="button" className={styles.menu} key={item.key} aria-pressed={section === item.key} disabled={!connected || (item.key === "support" && (supportStatus.locked || supportStatus.loading))} title={item.key === "support" && supportStatus.locked ? `다음 후원: ${new Date(supportStatus.nextAt!).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}` : undefined} onClick={() => onSection(item.key)}><span className={styles.menuIcon}><svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg></span><strong>{item.title}</strong></button>)}
      </div>
      {supportStatus.locked&&<p className={styles.muted}>다음 후원은 {new Date(supportStatus.nextAt!).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}부터 가능해요.</p>}
    </>}
    {profileVisited && <div hidden={section !== "profile"} className={styles.form}><ProfileEditor name={displayName} avatar={avatar} onChanged={changed} preview={Boolean(preview)} /></div>}
    {/* Keep an in-flight upload/draft alive when navigating or closing the sheet.
        The entire tree is destroyed on logout/account change by its owner key. */}
    {uploadVisited && <div hidden={section !== "upload"} className={styles.form}><UploadView today={data?.season.today ?? todayFallback} onSubmitted={() => { void load(true); if (!preview) void import("@/lib/dashboard-refresh").then(m => m.broadcastDashboardRefresh()).catch(() => undefined); }} preview={Boolean(preview)} /></div>}
    {section === "support" && <OperatorSupport />}
    {section === "records" && (data ? <Records data={data} /> : <p role="status">누적 기록을 불러오는 중이에요.</p>)}
    {section === "fortune" && !preview && <FortuneView defaultName={displayName} />}
    {section === "gift" && !preview && <GiftView initialStatus={featureSeed?.giftStatus} onStatusChange={featureSeed?.onGiftChange} />}
    {section === "corrective" && !preview && <CorrectiveView initialRequest={featureSeed?.correctiveRequest} initialStatus={featureSeed?.correctiveStatus} />}
    {section === "time-machine" && !preview && <TimeMachineView active={active} initialRequest={featureSeed?.timeMachineRequest} initialStatus={featureSeed?.timeMachineStatus} onStatusChange={featureSeed?.onTimeMachineChange} />}
    {preview && !primarySection && <p className={styles.feedback}>미리보기예요. 개인 기능의 실제 조회·신청은 실행하지 않아요.</p>}
    {/* Keep read-only warm data alive while navigating inside the same sheet. */}
    <div hidden={section !== "home"} className={styles.featureSection}>
      <FourthDashboardMemberArea embedded preview={Boolean(preview)} onOpenActivity={onFeature} />
    </div>
  </div>;
}

function ProfileEditor({ name, avatar, onChanged, preview }: { name: string; avatar: string; onChanged: (patch: { displayName?: string; profileImageUrl?: string | null }) => void; preview: boolean }) {
  const [draftName, setDraftName] = useState(name);
  const [file, setFile] = useState<File | null>(null);
  const [localImage, setLocalImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (localImage) URL.revokeObjectURL(localImage); }, [localImage]);
  const save = async (kind: "profile" | "remove") => {
    if (busy) return; setBusy(true); setFeedback(""); setFailure(false);
    let imageSaved = false;
    try {
      if (!preview && (kind === "remove" || file)) {
        const form = new FormData(); if (file && kind !== "remove") form.set("file", file);
        const response = await fetch("/api/me/profile-image", { method: kind === "remove" ? "DELETE" : "POST", ...(kind === "remove" ? {} : { body: form }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "사진을 저장하지 못했어요.");
        onChanged({ profileImageUrl: result.profile_image_url ?? null });
        imageSaved = true; setFile(null); setLocalImage("");
      }
      if (!preview && kind === "profile" && draftName.trim() !== name) {
        const response = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: draftName.trim() }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "이름을 저장하지 못했어요.");
        onChanged({ displayName: result.display_name }); setDraftName(result.display_name);
      }
      setFeedback(preview ? "미리보기예요. 실제 프로필은 변경하지 않았어요." : "저장했어요.");
    } catch (e) { setFailure(true); setFeedback(`${imageSaved ? "사진은 저장했어요. " : ""}${e instanceof Error ? e.message : "저장하지 못했어요."}`); }
    finally { setBusy(false); }
  };
  return <>
    <input type="file" ref={input} hidden accept="image/jpeg,image/png,image/webp" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ""; if (!selected) return; if (selected.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setFailure(true); setFeedback("4MB 이하의 JPG, PNG, WebP 사진을 선택해주세요."); return; } setFile(selected); setLocalImage(URL.createObjectURL(selected)); setFeedback(""); }} />
    <form className={styles.profileCard} onSubmit={e => { e.preventDefault(); void save("profile"); }}>
      <div className={styles.profileFields}>
        <button type="button" className={styles.avatarPicker} disabled={busy} aria-label="프로필 사진 변경" onClick={() => input.current?.click()}>
          <Image unoptimized width={104} height={104} className={styles.largeAvatar} src={localImage || avatar} alt="내 프로필 사진 미리보기" />
          <span className={styles.cameraBadge} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5 6 8H3v12h18V8h-3l-2-3Z" /><circle cx="12" cy="13" r="3" /></svg></span>
        </button>
        <div className={styles.profileDetails}>
          <label className={styles.field}>표시 이름<input required minLength={2} maxLength={40} autoComplete="nickname" value={draftName} onChange={e => setDraftName(e.target.value)} disabled={busy} /></label>
          <button type="button" className={styles.textButton} disabled={busy} onClick={() => void save("remove")}>기본 사진으로 변경</button>
        </div>
      </div>
      <button className={styles.primary} disabled={busy} type="submit">{busy ? "저장 중…" : "저장"}</button>
    </form>
    {feedback && <p className={`${styles.feedback} ${failure ? styles.error : ""}`} role={failure ? "alert" : "status"}>{feedback}</p>}
  </>;
}
