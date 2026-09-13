"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePageScrollLock } from "@/lib/use-page-scroll-lock";
import Content from "./my-activity-content";
import type { MyActivityData, MyActivitySection } from "@/components/my-activity-content";
import type { MyActivityFeatureSeed } from "@/lib/my-activity-feature-seed";
import styles from "./my-activity.module.css";

const titles: Record<MyActivitySection, string> = { locker: "보관함", support: "후원", home: "내 정보", profile: "내 정보", upload: "내 정보", records: "내 정보", fortune: "오늘 운세", gift: "인증박스", corrective: "교정운동", "time-machine": "타임머신" };
export function openMyActivity(section: MyActivitySection = "home", seed?: MyActivityFeatureSeed) { window.dispatchEvent(new CustomEvent("twtt:my-activity", { detail: { section, seed } })); }

function consumeActivityHash() {
  if (!["#my-activity", "#member-features"].includes(window.location.hash)) return false;
  // A dialog is temporary UI, not the destination to restore on refresh.
  // Preserve Next's history state and any unrelated query parameters.
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  return true;
}

export function MyActivityDialog({ name, imageUrl, className, onChanged, preview, showTrigger = true }: {
  name: string; imageUrl?: string | null; className?: string;
  onChanged?: (patch: { displayName?: string; profileImageUrl?: string | null }) => void;
  preview?: MyActivityData;
  showTrigger?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [seed, setSeed] = useState<MyActivityFeatureSeed>();
  const [section, setSection] = useState<MyActivitySection>("home");
  const [opened, setOpened] = useState(false);
  useLayoutEffect(() => {
    const open = (event?: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : "home";
      const target = typeof detail === "string" ? detail : detail?.section;
      setSection(Object.hasOwn(titles, target) ? target : "home");
      setSeed(typeof detail === "object" ? detail?.seed : undefined);
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpened(true);
      if (!dialog.current?.open) dialog.current?.showModal();
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    };
    const hash = () => { if (consumeActivityHash()) open(); };
    window.addEventListener("twtt:my-activity", open);
    window.addEventListener("hashchange", hash);
    const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // Explicit deep links still work once; reloading an old bookmarked hash
    // lands on the dashboard instead of reopening the dialog.
    if (consumeActivityHash() && navigation?.type !== "reload") open();
    return () => { window.removeEventListener("twtt:my-activity", open); window.removeEventListener("hashchange", hash); };
  }, []);
  usePageScrollLock(opened);
  useEffect(() => {
    if (!opened) return;
    shell.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [section, opened]);
  const close = () => {
    dialog.current?.close(); setOpened(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  return <>
    {showTrigger && <button className={className} type="button" aria-haspopup="dialog" onPointerEnter={() => void import("./my-activity-content")} onFocus={() => void import("./my-activity-content")} onClick={() => openMyActivity()}>내 정보</button>}
    <dialog ref={dialog} className={styles.dialog} data-view={section} aria-labelledby="my-activity-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }} onClose={() => setOpened(false)}>
      <div ref={shell} className={styles.shell}>
        <header className={styles.heading}>
          {section !== "home" && <button className={styles.iconButton} type="button" aria-label="내 정보 처음으로" onClick={() => setSection("home")}>‹</button>}
          <h2 id="my-activity-title" ref={heading} tabIndex={-1}>{titles[section]}</h2>
          <button type="button" className={styles.iconButton} aria-label="내 정보 닫기" onClick={close}>×</button>
        </header>
        {/* The lightweight home/menu is already mounted before a tap. Heavy sections stay split. */}
        <Content section={section} onSection={setSection} onFeature={(target, nextSeed) => { setSeed(nextSeed); setSection(target); }} name={name} imageUrl={imageUrl} onChanged={onChanged} preview={preview} active={opened} featureSeed={seed} />
      </div>
    </dialog>
  </>;
}
