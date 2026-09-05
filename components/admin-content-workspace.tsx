"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ContentTab = "encouragements" | "banners" | "comments";
type NoticeTone = "success" | "error" | "info";

type Notice = {
  tone: NoticeTone;
  message: string;
};

type Encouragement = {
  id: string;
  message: string;
  display_order: number;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type BannerFocus = "left" | "center" | "right";

type Banner = {
  id: string;
  owner_name: string;
  title: string;
  description: string;
  alt_text: string;
  image_url: string;
  mobile_focus: BannerFocus;
  display_order: number;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type CommentStatus = "visible" | "hidden" | "deleted";

type AdminComment = {
  id: string;
  parent_id: string | null;
  author_name: string;
  author_mode: "random" | "kakao";
  body: string;
  created_at: string;
  status: CommentStatus;
  deleted_at: string | null;
  reactions_count: number;
  replies_count: number;
};

type EncouragementDraft = {
  message: string;
  display_order: string;
  active: boolean;
};

type BannerDraft = {
  owner_name: string;
  title: string;
  description: string;
  alt_text: string;
  image_url: string;
  mobile_focus: BannerFocus;
  display_order: string;
  active: boolean;
};

const EMPTY_ENCOURAGEMENT: EncouragementDraft = {
  message: "",
  display_order: "",
  active: true,
};

const EMPTY_BANNER: BannerDraft = {
  owner_name: "",
  title: "",
  description: "",
  alt_text: "",
  image_url: "",
  mobile_focus: "center",
  display_order: "",
  active: true,
};

const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function parseJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const json = await parseJson<T & { error?: string }>(response);
  if (!response.ok) {
    throw new Error(json.error || "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.");
  }
  return json;
}

function formatAdminTimestamp(value: string | null | undefined) {
  if (!value) return "날짜 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return ADMIN_DATE_TIME_FORMATTER.format(parsed);
}

function normalizeOrder(value: string, fallback: number) {
  if (!value.trim()) return fallback;
  const order = Number(value);
  return Number.isInteger(order) && order >= 0 ? order : fallback;
}

function isSupportedImageLocation(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 2_048 || /[\u0000-\u0020\u007f-\u009f\\\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(normalized)) {
    return false;
  }
  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) return false;
    try {
      let pathname = new URL(normalized, "https://twtt.invalid").pathname;
      for (let index = 0; index < 3; index += 1) {
        const decoded = decodeURIComponent(pathname);
        if (decoded === pathname) break;
        pathname = decoded;
      }
      return !pathname.includes("\\")
        && !pathname.split("/").some((segment) => segment === "." || segment === "..");
    } catch {
      return false;
    }
  }
  try {
    const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configuredSupabaseUrl) return false;
    const candidate = new URL(normalized);
    const allowedOrigin = new URL(configuredSupabaseUrl).origin;
    return candidate.protocol === "https:"
      && candidate.origin === allowedOrigin
      && candidate.pathname.startsWith("/storage/v1/object/public/")
      && !candidate.username
      && !candidate.password;
  } catch {
    return false;
  }
}

function NoticeBar({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const toneClass = notice.tone === "error"
    ? "bg-rose-50 text-rose-800 ring-rose-200"
    : notice.tone === "success"
      ? "bg-lime-50 text-lime-900 ring-lime-200"
      : "bg-blue-50 text-blue-800 ring-blue-200";

  return (
    <p className={`rounded-2xl px-4 py-3 text-xs font-bold leading-5 ring-1 ${toneClass}`} role="status" aria-live="polite">
      {notice.message}
    </p>
  );
}

function WorkspaceHeader({
  eyebrow,
  titleId,
  title,
  description,
  countLabel,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  eyebrow: string;
  titleId: string;
  title: string;
  description: string;
  countLabel: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-blue-600">{eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 id={titleId} className="text-2xl font-black tracking-[-0.03em] text-oriwan-text">{title}</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{countLabel}</span>
        </div>
        <p className="mt-2 max-w-3xl break-keep text-sm font-semibold leading-6 text-oriwan-text-muted">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          disabled={actionDisabled}
          onClick={onAction}
          className="min-h-12 shrink-0 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[24px] bg-oriwan-surface-light px-4 text-center ring-1 ring-slate-950/5">
      <div>
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-black text-oriwan-text">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] bg-oriwan-surface-light px-5 py-12 text-center ring-1 ring-slate-950/5">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-xl font-black text-blue-600 shadow-sm" aria-hidden="true">+</span>
      <p className="mt-4 text-base font-black text-oriwan-text">{title}</p>
      <p className="mx-auto mt-1 max-w-sm break-keep text-xs font-semibold leading-5 text-oriwan-text-muted">{description}</p>
    </div>
  );
}

function OrderButtons({
  index,
  length,
  disabled,
  onMove,
}: {
  index: number;
  length: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-oriwan-surface-light" aria-label="게시 순서 변경">
      <button
        type="button"
        aria-label="한 칸 위로"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        className="grid h-11 w-11 place-items-center rounded-xl text-base font-black text-oriwan-text transition hover:bg-white disabled:opacity-25"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="한 칸 아래로"
        disabled={disabled || index === length - 1}
        onClick={() => onMove(1)}
        className="grid h-11 w-11 place-items-center rounded-xl text-base font-black text-oriwan-text transition hover:bg-white disabled:opacity-25"
      >
        ↓
      </button>
    </div>
  );
}

function ActiveSwitch({ active, disabled, onChange }: { active: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onChange}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[11px] font-black transition disabled:opacity-45 ${
        active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span className={`relative h-5 w-9 rounded-full transition ${active ? "bg-blue-600" : "bg-slate-300"}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${active ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {active ? "게시 중" : "게시 중지"}
    </button>
  );
}

function EncouragementForm({
  mode,
  initial,
  submitting,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: EncouragementDraft;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (draft: EncouragementDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const remaining = 120 - draft.message.length;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(draft);
      }}
      className="rounded-[24px] bg-blue-50 p-4 ring-1 ring-blue-100 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-oriwan-text">{mode === "create" ? "새 응원글" : "응원글 수정"}</h3>
        <span className={`text-[11px] font-black ${remaining < 0 ? "text-rose-600" : "text-blue-700"}`}>{draft.message.length}/120</span>
      </div>
      <label className="mt-4 block text-xs font-black text-oriwan-text-muted">
        문구
        <textarea
          required
          autoFocus
          maxLength={120}
          rows={3}
          value={draft.message}
          onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
          placeholder="오늘의 응원이 될 짧은 문장을 적어주세요."
          className="mt-1.5 w-full resize-y rounded-2xl border border-blue-100 bg-white px-4 py-3 text-base font-bold leading-6 text-oriwan-text outline-none transition placeholder:text-slate-400 focus:border-blue-500"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end">
        <label className="text-xs font-black text-oriwan-text-muted">
          표시 순서
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={draft.display_order}
            onChange={(event) => setDraft((current) => ({ ...current, display_order: event.target.value }))}
            placeholder="자동"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-oriwan-text ring-1 ring-blue-100">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
            className="h-4 w-4 accent-blue-600"
          />
          저장하자마자 공개하기
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} disabled={submitting} className="min-h-11 rounded-xl bg-white px-4 text-xs font-black text-oriwan-text-muted ring-1 ring-slate-200 disabled:opacity-50">취소</button>
        <button type="submit" disabled={submitting || !draft.message.trim()} className="min-h-11 rounded-xl bg-blue-600 px-5 text-xs font-black text-white disabled:opacity-45">{submitting ? "저장 중…" : "저장"}</button>
      </div>
    </form>
  );
}

function EncouragementManager() {
  const [items, setItems] = useState<Encouragement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiRequest<{ items?: Encouragement[] }>("/api/admin/hello-2027/content?type=encouragement");
      setItems((json.items || []).slice().sort((a, b) => a.display_order - b.display_order));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "응원글을 불러오지 못했어요." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const save = async (draft: EncouragementDraft, id?: string) => {
    const message = draft.message.trim();
    if (!message) {
      setNotice({ tone: "error", message: "응원글 문구를 입력해주세요." });
      return;
    }
    if (message.length > 120) {
      setNotice({ tone: "error", message: "응원글은 최대 120자까지 입력할 수 있어요." });
      return;
    }
    const busyKey = id || "create";
    setBusyId(busyKey);
    try {
      await apiRequest("/api/admin/hello-2027/content?type=encouragement", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({
          type: "encouragement",
          ...(id ? { id } : {}),
          message,
          active: draft.active,
          display_order: normalizeOrder(
            draft.display_order,
            id ? items.find((item) => item.id === id)?.display_order ?? 0 : items.length,
          ),
        }),
      });
      setShowCreate(false);
      setEditingId("");
      setNotice({ tone: "success", message: id ? "응원글을 수정했어요." : "새 응원글을 등록했어요." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "응원글을 저장하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  const patchItem = async (id: string, fields: Partial<Encouragement>, successMessage: string) => {
    setBusyId(id);
    try {
      await apiRequest("/api/admin/hello-2027/content?type=encouragement", {
        method: "PATCH",
        body: JSON.stringify({ type: "encouragement", id, ...fields }),
      });
      setNotice({ tone: "success", message: successMessage });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "응원글을 변경하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    const current = items[index];
    const target = items[nextIndex];
    if (!current || !target) return;
    setBusyId(current.id);
    try {
      await Promise.all([
        apiRequest("/api/admin/hello-2027/content?type=encouragement", {
          method: "PATCH",
          body: JSON.stringify({ type: "encouragement", id: current.id, display_order: target.display_order }),
        }),
        apiRequest("/api/admin/hello-2027/content?type=encouragement", {
          method: "PATCH",
          body: JSON.stringify({ type: "encouragement", id: target.id, display_order: current.display_order }),
        }),
      ]);
      setNotice({ tone: "success", message: "게시 순서를 바꿨어요." });
      await load();
    } catch (error) {
      await load();
      const detail = error instanceof Error ? error.message : "순서를 바꾸지 못했어요.";
      setNotice({ tone: "error", message: `${detail} 일부 변경이 반영됐을 수 있어 최신 목록을 다시 불러왔어요.` });
    } finally {
      setBusyId("");
    }
  };

  const deleteItem = async (item: Encouragement) => {
    if (!window.confirm("이 응원글을 삭제할까요? 삭제한 문구는 되돌릴 수 없어요.")) return;
    setBusyId(item.id);
    try {
      const query = new URLSearchParams({ type: "encouragement", id: item.id });
      await apiRequest(`/api/admin/hello-2027/content?${query}`, { method: "DELETE" });
      setNotice({ tone: "success", message: "응원글을 삭제했어요." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "응원글을 삭제하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="card mobile-page-card overflow-hidden p-4 sm:p-6" aria-labelledby="encouragement-admin-title">
      <WorkspaceHeader
        eyebrow="Encouragements"
        titleId="encouragement-admin-title"
        title="응원글"
        description="매일 바뀌는 오늘의 응원글을 등록하고 공개 순서를 정해요. 최대 56개까지 보관할 수 있습니다."
        countLabel={`${items.length}/56개`}
        actionLabel={showCreate ? "작성 중" : "응원글 추가"}
        actionDisabled={showCreate || items.length >= 56}
        onAction={() => {
          setEditingId("");
          setShowCreate(true);
        }}
      />
      <div className="mt-5 space-y-3">
        <NoticeBar notice={notice} />
        {items.length >= 56 ? <NoticeBar notice={{ tone: "info", message: "56개가 모두 등록되어 있어요. 새 문구를 추가하려면 기존 문구를 정리해주세요." }} /> : null}
        {showCreate ? (
          <EncouragementForm mode="create" initial={EMPTY_ENCOURAGEMENT} submitting={busyId === "create"} onCancel={() => setShowCreate(false)} onSubmit={(draft) => save(draft)} />
        ) : null}
        {loading ? <LoadingState label="응원글을 불러오는 중…" /> : null}
        {!loading && !items.length && !showCreate ? <EmptyState title="등록된 응원글이 없어요" description="첫 응원글을 등록하면 4기 대시보드에서 순서대로 보여줄 수 있어요." /> : null}
        {!loading ? items.map((item, index) => (
          editingId === item.id ? (
            <EncouragementForm
              key={item.id}
              mode="edit"
              initial={{ message: item.message, display_order: String(item.display_order), active: item.active }}
              submitting={busyId === item.id}
              onCancel={() => setEditingId("")}
              onSubmit={(draft) => save(draft, item.id)}
            />
          ) : (
            <article key={item.id} className="rounded-[22px] bg-white p-4 ring-1 ring-slate-950/5 transition hover:shadow-lg hover:shadow-slate-950/5 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-keep text-sm font-black leading-6 text-oriwan-text">{item.message}</p>
                  <p className="mt-1 text-[11px] font-bold text-oriwan-text-muted">표시 순서 {item.display_order}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <ActiveSwitch active={item.active} disabled={Boolean(busyId)} onChange={() => void patchItem(item.id, { active: !item.active }, item.active ? "응원글 게시를 중지했어요." : "응원글을 공개했어요.")} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <OrderButtons index={index} length={items.length} disabled={Boolean(busyId)} onMove={(direction) => void moveItem(index, direction)} />
                  <button type="button" disabled={Boolean(busyId)} onClick={() => { setShowCreate(false); setEditingId(item.id); }} className="min-h-11 rounded-xl bg-oriwan-surface-light px-3 text-[11px] font-black text-oriwan-text disabled:opacity-40">수정</button>
                  <button type="button" disabled={Boolean(busyId)} onClick={() => void deleteItem(item)} className="min-h-11 rounded-xl bg-rose-50 px-3 text-[11px] font-black text-rose-700 disabled:opacity-40">삭제</button>
                </div>
              </div>
            </article>
          )
        )) : null}
      </div>
    </section>
  );
}

function BannerForm({
  mode,
  initial,
  submitting,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: BannerDraft;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (draft: BannerDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const imagePreviewAllowed = isSupportedImageLocation(draft.image_url);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(draft);
      }}
      className="rounded-[24px] bg-blue-50 p-4 ring-1 ring-blue-100 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-oriwan-text">{mode === "create" ? "새 배너" : "배너 수정"}</h3>
        <span className="text-[11px] font-black text-blue-700">웹·모바일 공통</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-oriwan-text-muted">
          광고주 이름
          <input required autoFocus maxLength={20} value={draft.owner_name} onChange={(event) => setDraft((current) => ({ ...current, owner_name: event.target.value }))} placeholder="예: 러닝 파트너" className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-bold text-oriwan-text outline-none focus:border-blue-500" />
        </label>
        <label className="text-xs font-black text-oriwan-text-muted">
          제목
          <input required maxLength={40} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="배너 제목" className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-bold text-oriwan-text outline-none focus:border-blue-500" />
        </label>
      </div>
      <label className="mt-3 block text-xs font-black text-oriwan-text-muted">
        설명
        <textarea required maxLength={100} rows={2} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="배너에 함께 보일 한 줄 설명" className="mt-1.5 w-full resize-y rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm font-bold leading-5 text-oriwan-text outline-none focus:border-blue-500" />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-oriwan-text-muted">
          이미지 URL
          <input required type="text" inputMode="url" value={draft.image_url} onChange={(event) => setDraft((current) => ({ ...current, image_url: event.target.value }))} placeholder="/banners/image.webp 또는 Supabase URL" className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-bold text-oriwan-text outline-none focus:border-blue-500" />
        </label>
        <label className="text-xs font-black text-oriwan-text-muted">
          이미지 대체 설명
          <input required maxLength={80} value={draft.alt_text} onChange={(event) => setDraft((current) => ({ ...current, alt_text: event.target.value }))} placeholder="이미지 내용을 구체적으로 설명" className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-bold text-oriwan-text outline-none focus:border-blue-500" />
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-black text-oriwan-text-muted">
          모바일 초점
          <select value={draft.mobile_focus} onChange={(event) => setDraft((current) => ({ ...current, mobile_focus: event.target.value as BannerFocus }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500">
            <option value="left">왼쪽</option>
            <option value="center">가운데</option>
            <option value="right">오른쪽</option>
          </select>
        </label>
        <label className="text-xs font-black text-oriwan-text-muted">
          표시 순서
          <input type="number" min={0} step={1} inputMode="numeric" value={draft.display_order} onChange={(event) => setDraft((current) => ({ ...current, display_order: event.target.value }))} placeholder="자동" className="mt-1.5 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl bg-white px-3 text-xs font-black text-oriwan-text ring-1 ring-blue-100">
          <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-blue-600" />
          바로 공개하기
        </label>
      </div>
      {draft.image_url && imagePreviewAllowed ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-950/10">
          <div role="img" aria-label={draft.alt_text || "배너 이미지 미리보기"} className="h-32 bg-cover bg-center sm:h-40" style={{ backgroundImage: `url(${JSON.stringify(draft.image_url)})`, backgroundPosition: draft.mobile_focus }} />
          <p className="bg-slate-950/90 px-3 py-2 text-[11px] font-bold text-white/80">모바일 초점 미리보기 · {draft.mobile_focus === "left" ? "왼쪽" : draft.mobile_focus === "right" ? "오른쪽" : "가운데"}</p>
        </div>
      ) : draft.image_url ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2.5 text-[11px] font-bold leading-5 text-amber-900 ring-1 ring-amber-200" role="status">
          미리보기는 사이트 내부 경로 또는 현재 Supabase 공개 Storage 이미지에만 제공됩니다.
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} disabled={submitting} className="min-h-11 rounded-xl bg-white px-4 text-xs font-black text-oriwan-text-muted ring-1 ring-slate-200 disabled:opacity-50">취소</button>
        <button type="submit" disabled={submitting || !draft.owner_name.trim() || !draft.title.trim() || !draft.description.trim() || !draft.alt_text.trim() || !draft.image_url.trim()} className="min-h-11 rounded-xl bg-blue-600 px-5 text-xs font-black text-white disabled:opacity-45">{submitting ? "저장 중…" : "저장"}</button>
      </div>
    </form>
  );
}

function BannerManager() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiRequest<{ items?: Banner[] }>("/api/admin/hello-2027/content?type=banner");
      setItems((json.items || []).slice().sort((a, b) => a.display_order - b.display_order));
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "배너를 불러오지 못했어요." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const save = async (draft: BannerDraft, id?: string) => {
    const fields = {
      owner_name: draft.owner_name.trim(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      alt_text: draft.alt_text.trim(),
      image_url: draft.image_url.trim(),
      mobile_focus: draft.mobile_focus,
      active: draft.active,
      display_order: normalizeOrder(
        draft.display_order,
        id ? items.find((item) => item.id === id)?.display_order ?? 0 : items.length,
      ),
    };
    if (Object.values(fields).some((value) => typeof value === "string" && !value) || !isSupportedImageLocation(fields.image_url)) {
      setNotice({ tone: "error", message: "모든 문구와 사이트 내부 경로 또는 Supabase 공개 이미지 URL을 확인해주세요." });
      return;
    }
    const busyKey = id || "create";
    setBusyId(busyKey);
    try {
      await apiRequest("/api/admin/hello-2027/content?type=banner", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ type: "banner", ...(id ? { id } : {}), ...fields }),
      });
      setShowCreate(false);
      setEditingId("");
      setNotice({ tone: "success", message: id ? "배너를 수정했어요." : "새 배너를 등록했어요." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "배너를 저장하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  const patchItem = async (id: string, fields: Partial<Banner>, successMessage: string) => {
    setBusyId(id);
    try {
      await apiRequest("/api/admin/hello-2027/content?type=banner", {
        method: "PATCH",
        body: JSON.stringify({ type: "banner", id, ...fields }),
      });
      setNotice({ tone: "success", message: successMessage });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "배너를 변경하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    const current = items[index];
    const target = items[nextIndex];
    if (!current || !target) return;
    setBusyId(current.id);
    try {
      await Promise.all([
        apiRequest("/api/admin/hello-2027/content?type=banner", { method: "PATCH", body: JSON.stringify({ type: "banner", id: current.id, display_order: target.display_order }) }),
        apiRequest("/api/admin/hello-2027/content?type=banner", { method: "PATCH", body: JSON.stringify({ type: "banner", id: target.id, display_order: current.display_order }) }),
      ]);
      setNotice({ tone: "success", message: "배너 순서를 바꿨어요." });
      await load();
    } catch (error) {
      await load();
      const detail = error instanceof Error ? error.message : "배너 순서를 바꾸지 못했어요.";
      setNotice({ tone: "error", message: `${detail} 일부 변경이 반영됐을 수 있어 최신 목록을 다시 불러왔어요.` });
    } finally {
      setBusyId("");
    }
  };

  const deleteItem = async (item: Banner) => {
    if (!window.confirm(`“${item.title}” 배너를 삭제할까요?`)) return;
    setBusyId(item.id);
    try {
      const query = new URLSearchParams({ type: "banner", id: item.id });
      await apiRequest(`/api/admin/hello-2027/content?${query}`, { method: "DELETE" });
      setNotice({ tone: "success", message: "배너를 삭제했어요." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "배너를 삭제하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="card mobile-page-card overflow-hidden p-4 sm:p-6" aria-labelledby="banner-admin-title">
      <WorkspaceHeader
        eyebrow="Banners"
        titleId="banner-admin-title"
        title="배너"
        description="첫 현황 배너를 제외한 광고 이미지를 등록하고 모바일에서 보일 이미지 초점을 정해요. 최대 10개까지 운영할 수 있습니다."
        countLabel={`${items.length}/10개`}
        actionLabel={showCreate ? "작성 중" : "배너 추가"}
        actionDisabled={showCreate || items.length >= 10}
        onAction={() => {
          setEditingId("");
          setShowCreate(true);
        }}
      />
      <div className="mt-5 space-y-3">
        <NoticeBar notice={notice} />
        {items.length >= 10 ? <NoticeBar notice={{ tone: "info", message: "배너 10개가 모두 등록되어 있어요. 새 배너를 추가하려면 기존 배너를 정리해주세요." }} /> : null}
        {showCreate ? <BannerForm mode="create" initial={EMPTY_BANNER} submitting={busyId === "create"} onCancel={() => setShowCreate(false)} onSubmit={(draft) => save(draft)} /> : null}
        {loading ? <LoadingState label="배너를 불러오는 중…" /> : null}
        {!loading && !items.length && !showCreate ? <EmptyState title="등록된 광고 배너가 없어요" description="첫 광고 배너를 등록하면 5초 간격 캐러셀에 순서대로 노출할 수 있어요." /> : null}
        {!loading ? items.map((item, index) => (
          editingId === item.id ? (
            <BannerForm
              key={item.id}
              mode="edit"
              initial={{
                owner_name: item.owner_name,
                title: item.title,
                description: item.description,
                alt_text: item.alt_text,
                image_url: item.image_url,
                mobile_focus: item.mobile_focus || "center",
                display_order: String(item.display_order),
                active: item.active,
              }}
              submitting={busyId === item.id}
              onCancel={() => setEditingId("")}
              onSubmit={(draft) => save(draft, item.id)}
            />
          ) : (
            <article key={item.id} className="overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-950/5 transition hover:shadow-lg hover:shadow-slate-950/5">
              <div className="grid sm:grid-cols-[13rem_minmax(0,1fr)]">
                <div role="img" aria-label={item.alt_text} className="min-h-36 bg-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(item.image_url)})`, backgroundPosition: item.mobile_focus || "center" }} />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-blue-700">{item.owner_name}</p>
                      <h3 className="mt-1 truncate text-lg font-black text-oriwan-text">{item.title}</h3>
                      <p className="mt-1 break-keep text-xs font-semibold leading-5 text-oriwan-text-muted">{item.description}</p>
                    </div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-[11px] font-black text-blue-700">{index + 1}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[11px] font-bold leading-5 text-oriwan-text-muted">대체 설명: {item.alt_text}</p>
                  <p className="mt-1 text-[11px] font-bold text-oriwan-text-muted">모바일 초점 · {item.mobile_focus === "left" ? "왼쪽" : item.mobile_focus === "right" ? "오른쪽" : "가운데"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
                <ActiveSwitch active={item.active} disabled={Boolean(busyId)} onChange={() => void patchItem(item.id, { active: !item.active }, item.active ? "배너 게시를 중지했어요." : "배너를 공개했어요.")} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <OrderButtons index={index} length={items.length} disabled={Boolean(busyId)} onMove={(direction) => void moveItem(index, direction)} />
                  <button type="button" disabled={Boolean(busyId)} onClick={() => { setShowCreate(false); setEditingId(item.id); }} className="min-h-11 rounded-xl bg-oriwan-surface-light px-3 text-[11px] font-black text-oriwan-text disabled:opacity-40">수정</button>
                  <button type="button" disabled={Boolean(busyId)} onClick={() => void deleteItem(item)} className="min-h-11 rounded-xl bg-rose-50 px-3 text-[11px] font-black text-rose-700 disabled:opacity-40">삭제</button>
                </div>
              </div>
            </article>
          )
        )) : null}
      </div>
    </section>
  );
}

const COMMENT_FILTERS: ReadonlyArray<{ key: "all" | CommentStatus; label: string }> = [
  { key: "all", label: "전체" },
  { key: "visible", label: "공개" },
  { key: "hidden", label: "숨김" },
  { key: "deleted", label: "삭제" },
];

function CommentManager() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | CommentStatus>("all");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiRequest<{ comments?: AdminComment[] }>("/api/admin/hello-2027/comments");
      setComments(json.comments || []);
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "댓글을 불러오지 못했어요." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const counts = useMemo(() => ({
    all: comments.length,
    visible: comments.filter((comment) => comment.status === "visible").length,
    hidden: comments.filter((comment) => comment.status === "hidden").length,
    deleted: comments.filter((comment) => comment.status === "deleted").length,
  }), [comments]);

  const filteredComments = useMemo(() => (
    filter === "all" ? comments : comments.filter((comment) => comment.status === filter)
  ), [comments, filter]);

  const updateStatus = async (comment: AdminComment, status: "visible" | "hidden") => {
    setBusyId(comment.id);
    try {
      await apiRequest("/api/admin/hello-2027/comments", {
        method: "PATCH",
        body: JSON.stringify({ id: comment.id, status }),
      });
      setNotice({ tone: "success", message: status === "visible" ? "댓글을 다시 공개했어요." : "댓글을 숨겼어요." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "댓글 상태를 변경하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  const deleteComment = async (comment: AdminComment) => {
    if (!window.confirm("이 댓글을 비식별 삭제할까요? 작성자와 본문은 공개 화면에서 복구할 수 없게 처리됩니다.")) return;
    setBusyId(comment.id);
    try {
      await apiRequest("/api/admin/hello-2027/comments", {
        method: "DELETE",
        body: JSON.stringify({ id: comment.id }),
      });
      setNotice({ tone: "success", message: "댓글을 비식별 삭제했어요." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "댓글을 삭제하지 못했어요." });
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="card mobile-page-card overflow-hidden p-4 sm:p-6" aria-labelledby="comment-admin-title">
      <WorkspaceHeader eyebrow="Comment moderation" titleId="comment-admin-title" title="댓글" description="익명과 카카오 댓글을 함께 확인하고 공개, 숨김, 비식별 삭제 상태를 관리해요." countLabel={`${comments.length}개`} />
      <div className="mt-5 space-y-3">
        <NoticeBar notice={notice} />
        <div className="overflow-x-auto rounded-2xl bg-oriwan-surface-light p-1.5" role="group" aria-label="댓글 상태 필터">
          <div className="flex min-w-max gap-1 sm:min-w-0">
            {COMMENT_FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={`min-h-11 rounded-xl px-3 text-[11px] font-black transition sm:flex-1 ${filter === option.key ? "bg-white text-oriwan-text shadow-sm" : "text-oriwan-text-muted"}`}
              >
                {option.label} {counts[option.key]}
              </button>
            ))}
          </div>
        </div>
        {loading ? <LoadingState label="댓글을 불러오는 중…" /> : null}
        {!loading && !filteredComments.length ? <EmptyState title="이 상태의 댓글이 없어요" description="새 댓글이나 상태 변경이 생기면 이곳에 바로 표시됩니다." /> : null}
        {!loading ? filteredComments.map((comment) => {
          const statusLabel = comment.status === "visible" ? "공개" : comment.status === "hidden" ? "숨김" : "비식별 삭제";
          const statusClass = comment.status === "visible" ? "bg-lime-50 text-lime-800" : comment.status === "hidden" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500";
          return (
            <article key={comment.id} className={`rounded-[22px] p-4 ring-1 ring-slate-950/5 sm:p-5 ${comment.status === "deleted" ? "bg-slate-50" : "bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm font-black text-oriwan-text">{comment.status === "deleted" ? "삭제된 작성자" : comment.author_name}</strong>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${statusClass}`}>{statusLabel}</span>
                    {comment.parent_id ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">답글</span> : null}
                  </div>
                </div>
                <time className="shrink-0 text-right text-[11px] font-bold leading-5 text-oriwan-text-muted" dateTime={comment.created_at}>{formatAdminTimestamp(comment.created_at)}</time>
              </div>
              <p className={`mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-6 ${comment.status === "deleted" ? "text-oriwan-text-muted" : "text-oriwan-text"}`}>
                {comment.status === "deleted" ? "비식별 삭제된 댓글입니다." : comment.body}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-black text-oriwan-text-muted">
                  <span className="rounded-full bg-oriwan-surface-light px-2.5 py-1.5">반응 {comment.reactions_count || 0}</span>
                  <span className="rounded-full bg-oriwan-surface-light px-2.5 py-1.5">답글 {comment.replies_count || 0}</span>
                </div>
                {comment.status !== "deleted" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {comment.status === "visible" ? (
                      <button type="button" disabled={Boolean(busyId)} onClick={() => void updateStatus(comment, "hidden")} className="min-h-11 rounded-xl bg-amber-50 px-3 text-[11px] font-black text-amber-800 disabled:opacity-40">숨기기</button>
                    ) : (
                      <button type="button" disabled={Boolean(busyId)} onClick={() => void updateStatus(comment, "visible")} className="min-h-11 rounded-xl bg-blue-50 px-3 text-[11px] font-black text-blue-700 disabled:opacity-40">복구·공개</button>
                    )}
                    <button type="button" disabled={Boolean(busyId)} onClick={() => void deleteComment(comment)} className="min-h-11 rounded-xl bg-rose-50 px-3 text-[11px] font-black text-rose-700 disabled:opacity-40">비식별 삭제</button>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-oriwan-text-muted">개인정보와 본문을 복구하지 않습니다.</span>
                )}
              </div>
            </article>
          );
        }) : null}
      </div>
    </section>
  );
}

export function AdminContentWorkspace({ tab }: { tab: ContentTab }) {
  if (tab === "encouragements") return <EncouragementManager />;
  if (tab === "banners") return <BannerManager />;
  return <CommentManager />;
}
