"use client";

import { useCallback, useEffect, useState } from "react";
import { NextSeasonNoticeModal } from "@/components/next-season-notice-modal";
import { useFourthViewer } from "@/components/fourth-viewer-provider";

const DISMISS_STORAGE_KEY = "twtt:4th:preopen:2026-09:v2";

function seoulDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function FourthSeasonOpeningNotice() {
  const { viewer, loading } = useFourthViewer();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      // 로그인 직후에는 개인 영역이 먼저 보여야 하므로 오픈 안내가 가리지 않습니다.
      if (viewer?.authenticated && window.location.hash === "#member-features") return;
      const today = seoulDateKey();
      let dismissedToday = false;
      try {
        dismissedToday = window.localStorage.getItem(DISMISS_STORAGE_KEY) === today;
      } catch {
        // 저장소를 사용할 수 없어도 확인 버튼으로 현재 방문에서는 닫을 수 있습니다.
      }
      void fetch("/api/hello-2027/preopen-notice", { cache: "no-store" })
        .then((response) => response.ok ? response.json() as Promise<{ dismissed?: boolean }> : null)
        .then((result) => {
          if (active && !dismissedToday && !result?.dismissed) setOpen(true);
        })
        .catch(() => {
          if (active && !dismissedToday) setOpen(true);
        });
    });
    return () => {
      active = false;
    };
  }, [loading, viewer?.authenticated]);

  const close = useCallback(() => setOpen(false), []);
  const closeToday = useCallback(async () => {
    const today = seoulDateKey();
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, today);
    } catch {
      // 기기 저장소가 차단된 경우 현재 방문에서만 닫습니다.
    }
    await fetch("/api/hello-2027/preopen-notice", { method: "POST" }).catch(() => undefined);
    setOpen(false);
  }, []);

  if (!open) return null;
  return <NextSeasonNoticeModal onClose={close} onCloseToday={closeToday} />;
}
