"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type FourthViewer = {
  authenticated: boolean;
  auth_available?: boolean;
  provider: "kakao" | null;
  display_name: string | null;
  approved_participant: boolean;
  verified_name?: boolean;
  name_source?: "admin" | "kakao" | null;
  connection_status?: string;
};

type FourthViewerContextValue = {
  viewer: FourthViewer | null;
  loading: boolean;
  actionPending: boolean;
  error: string;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const anonymousViewer: FourthViewer = {
  authenticated: false,
  provider: null,
  display_name: null,
  approved_participant: false,
  verified_name: false,
  name_source: null,
  connection_status: "unlinked",
};

const FourthViewerContext = createContext<FourthViewerContextValue | null>(null);

export function FourthViewerProvider({ children }: { children: React.ReactNode }) {
  const [viewer, setViewer] = useState<FourthViewer | null>(null);
  const [loading, setLoading] = useState(true);
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
      setViewer(anonymousViewer);
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
      setViewer(anonymousViewer);
    } catch {
      setError("로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setActionPending(false);
    }
  }, []);

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
