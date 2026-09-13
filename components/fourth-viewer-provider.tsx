"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  anonymousFourthViewer,
  type FourthViewer,
} from "@/lib/fourth-viewer-contract";

export type { FourthViewer } from "@/lib/fourth-viewer-contract";

type FourthViewerContextValue = {
  viewer: FourthViewer | null;
  loading: boolean;
  actionPending: boolean;
  error: string;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const FourthViewerContext = createContext<FourthViewerContextValue | null>(null);

export function FourthViewerProvider({
  children,
  initialViewer,
}: {
  children: React.ReactNode;
  initialViewer?: FourthViewer;
}) {
  const router = useRouter();
  const [viewer, setViewer] = useState<FourthViewer | null>(initialViewer ?? null);
  const [loading, setLoading] = useState(initialViewer === undefined);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState("");
  const enrollmentRefreshSentRef = useRef(false);
  const requestGeneration = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const response = await fetch("/api/hello-2027/viewer", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await response.json();
      if (generation !== requestGeneration.current) return;
      if (!response.ok) throw new Error("viewer_failed");
      setViewer(json);
      setError("");
    } catch {
      if (generation !== requestGeneration.current) return;
      // Keep the last server-verified viewer during a transient network error.
      setViewer((current) => current ?? anonymousFourthViewer);
      setError("로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialViewer !== undefined) return;
    queueMicrotask(() => void reload());
  }, [initialViewer, reload]);

  useEffect(() => {
    if (!viewer?.dashboard_member_changed || enrollmentRefreshSentRef.current) return;
    enrollmentRefreshSentRef.current = true;

    // Let other already-open public dashboards fetch the new member. Loading
    // the broadcaster only for the one enrollment response keeps repeat visits
    // and anonymous sessions lightweight.
    void import("@/lib/dashboard-refresh")
      .then(({ broadcastDashboardRefresh }) => broadcastDashboardRefresh())
      .catch(() => undefined);
  }, [viewer?.dashboard_member_changed]);

  const logout = useCallback(async () => {
    ++requestGeneration.current;
    setActionPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("logout_failed");
      setViewer(anonymousFourthViewer);
      setLoading(false);
      router.replace("/4th/dashboard");
    } catch {
      setError("로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setActionPending(false);
    }
  }, [router]);

  const value = useMemo<FourthViewerContextValue>(() => ({
    viewer,
    loading,
    actionPending,
    error,
    reload,
    logout,
  }), [actionPending, error, loading, logout, reload, viewer]);

  return <FourthViewerContext.Provider value={value}>{children}</FourthViewerContext.Provider>;
}

export function useFourthViewer() {
  const context = useContext(FourthViewerContext);
  if (!context) throw new Error("useFourthViewer must be used within FourthViewerProvider");
  return context;
}

export function useOptionalFourthViewer() {
  return useContext(FourthViewerContext);
}
