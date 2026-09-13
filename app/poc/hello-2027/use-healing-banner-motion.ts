"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { HEALING_RUNNER_ATLASES } from "@/lib/hello-2027-crew-banner";

type ConnectionHint = EventTarget & { saveData?: boolean; effectiveType?: string };

export function useHealingBannerMotion(root: RefObject<HTMLDivElement | null>, active: boolean, disabled: boolean, hasRunners: boolean, backgroundReady: boolean) {
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(false);
  const [restricted, setRestricted] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [limited, setLimited] = useState(false);
  const sampled = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: ConnectionHint }).connection;
    const sync = () => {
      setVisible(!document.hidden);
      setRestricted(query.matches || !!connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? ""));
    };
    sync();
    query.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.12), { threshold: [0, 0.12] });
    if (root.current) observer.observe(root.current);
    const syncDialogs = () => setModalOpen(Array.from(document.querySelectorAll("dialog[open], [role='dialog'][aria-modal='true']"))
      .some(node => node instanceof HTMLElement && !node.hidden && node.getAttribute("aria-hidden") !== "true" && node.getClientRects().length > 0));
    syncDialogs();
    const dialogs = new MutationObserver(records => {
      const relevant = records.some(record => record.type === "attributes"
        ? record.target instanceof Element && record.target.matches("dialog, [role='dialog']")
        : [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches("dialog, [role='dialog']") || node.querySelector("dialog, [role='dialog']"))));
      if (relevant) syncDialogs();
    });
    dialogs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "hidden", "aria-hidden", "aria-modal"] });
    return () => {
      observer.disconnect(); dialogs.disconnect();
      query.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [root]);

  const permitted = active && inView && visible && !restricted && !disabled && !limited && !modalOpen;

  useEffect(() => {
    if (!permitted || !hasRunners || !backgroundReady || enhanced) return;
    let cancelled = false;
    let idle: number | undefined;
    let timeout: number | undefined;
    const load = async () => {
      try {
        await Promise.all(HEALING_RUNNER_ATLASES.map(src => new Promise<void>((resolve, reject) => {
          const image = new window.Image();
          image.decoding = "async"; image.fetchPriority = "low";
          image.onload = () => { image.decode().then(resolve, resolve); };
          image.onerror = () => reject(new Error("Runner atlas unavailable"));
          image.src = src;
        })));
        if (!cancelled) setEnhanced(true);
      } catch { /* Retain small static runners if either optional atlas fails. */ }
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => { void load(); }, { timeout: 2500 });
      else timeout = window.setTimeout(() => { void load(); }, 600);
    };
    // The initial image and page scripts win network/CPU priority over motion.
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true; window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [permitted, hasRunners, backgroundReady, enhanced]);

  useEffect(() => {
    if (!permitted || !enhanced || sampled.current) return;
    let frame = 0, previous = 0, count = 0, slow = 0;
    const sample = (now: number) => {
      if (previous) { count++; if (now - previous > 50) slow++; }
      previous = now;
      if (count < 90) frame = requestAnimationFrame(sample);
      else {
        sampled.current = true;
        // One short sample, no ongoing JS render loop or React frame updates.
        if (slow / count > 0.12) setLimited(true);
      }
    };
    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, [permitted, enhanced]);

  return { enhanced, running: permitted, restricted, limited, modalOpen, inView };
}
