"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/hello-2027/viewer", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await response.json();
      if (!response.ok) throw new Error("viewer_failed");
      setViewer(json);
      setError("");
    } catch {
      // A transient viewer refresh failure must not replace a trusted
      // server-rendered session with the public dummy preview.
      setViewer((current) => current ?? anonymousFourthViewer);
      setError("로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);

  const logout = useCallback(async () => {
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
