"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  MAX_PROFILE_INTRO_LENGTH,
  MAX_PROFILE_INTRO_TITLE_LENGTH,
} from "@/lib/hello-2027-profile-introduction-contract";

type ProfileIntroduction = {
  participant_id: string;
  name: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileDraft = Pick<ProfileIntroduction, "title" | "body" | "active">;

type Feedback = {
  tone: "success" | "error";
  message: string;
};

type ApiPayload = {
  error?: string;
  setup_required?: boolean;
  items?: ProfileIntroduction[];
  item?: ProfileIntroduction;
};

function toDraft(item: ProfileIntroduction): ProfileDraft {
  return {
    title: item.title,
    body: item.body,
    active: item.active,
  };
}

function isSameDraft(item: ProfileIntroduction, draft: ProfileDraft) {
  return item.title === draft.title
    && item.body === draft.body
    && item.active === draft.active;
}

export function AdminProfileIntroductions() {
  const [items, setItems] = useState<ProfileIntroduction[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProfileDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [loadError, setLoadError] = useState<Feedback | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [feedbackById, setFeedbackById] = useState<Record<string, Feedback>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/hello-2027/profile-introductions", { cache: "no-store" });
      const json = await response.json().catch(() => ({})) as ApiPayload;
      if (!response.ok) {
        setSetupRequired(Boolean(json.setup_required));
        throw new Error(json.error || "4기 공개 자기소개를 불러오지 못했어요.");
      }
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);
      setDrafts(Object.fromEntries(nextItems.map((item) => [item.participant_id, toDraft(item)])));
      setFeedbackById({});
      setSetupRequired(false);
    } catch (error) {
      setLoadError({
        tone: "error",
        message: error instanceof Error ? error.message : "4기 공개 자기소개를 불러오지 못했어요.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const publicCount = useMemo(() => items.filter((item) => item.active).length, [items]);

  const updateDraft = (participantId: string, patch: Partial<ProfileDraft>) => {
    setDrafts((current) => ({
      ...current,
      [participantId]: {
        title: current[participantId]?.title || "",
        body: current[participantId]?.body || "",
        active: current[participantId]?.active || false,
        ...patch,
      },
    }));
    setFeedbackById((current) => {
      if (!current[participantId]) return current;
      const next = { ...current };
      delete next[participantId];
      return next;
    });
  };

  const save = async (item: ProfileIntroduction) => {
    const draft = drafts[item.participant_id] || toDraft(item);
    const title = draft.title.replace(/\s+/gu, " ").trim();
    const body = draft.body
      .replace(/\r\n?/gu, "\n")
      .replace(/[\t ]+/gu, " ")
      .trim();

    if (!title || title.length > MAX_PROFILE_INTRO_TITLE_LENGTH) {
      setFeedbackById((current) => ({
        ...current,
        [item.participant_id]: { tone: "error", message: `제목은 1~${MAX_PROFILE_INTRO_TITLE_LENGTH}자로 입력해주세요.` },
      }));
      return;
    }
    if (body.length > MAX_PROFILE_INTRO_LENGTH || (draft.active && !body)) {
      setFeedbackById((current) => ({
        ...current,
        [item.participant_id]: {
          tone: "error",
          message: draft.active
            ? `공개하려면 ${MAX_PROFILE_INTRO_LENGTH}자 이내의 자기소개를 입력해주세요.`
            : `자기소개는 최대 ${MAX_PROFILE_INTRO_LENGTH}자까지 입력할 수 있어요.`,
        },
      }));
      return;
    }

    setSavingId(item.participant_id);
    setFeedbackById((current) => {
      const next = { ...current };
      delete next[item.participant_id];
      return next;
    });
    try {
      const response = await fetch("/api/admin/hello-2027/profile-introductions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: item.participant_id,
          title,
          body,
          active: draft.active,
        }),
      });
      const json = await response.json().catch(() => ({})) as ApiPayload;
      if (!response.ok || !json.item) {
        if (json.setup_required) setSetupRequired(true);
        throw new Error(json.error || "공개 자기소개를 저장하지 못했어요.");
      }

      const saved = json.item;
      setItems((current) => current.map((currentItem) => (
        currentItem.participant_id === saved.participant_id ? saved : currentItem
      )));
      setDrafts((current) => ({ ...current, [saved.participant_id]: toDraft(saved) }));
      setFeedbackById((current) => ({
        ...current,
        [saved.participant_id]: {
          tone: "success",
          message: saved.active ? "4기 대시보드에 공개했어요." : "비공개 상태로 저장했어요.",
        },
      }));
      setSetupRequired(false);
    } catch (error) {
      setFeedbackById((current) => ({
        ...current,
        [item.participant_id]: {
          tone: "error",
          message: error instanceof Error ? error.message : "공개 자기소개를 저장하지 못했어요.",
        },
      }));
    } finally {
      setSavingId("");
    }
  };

  return (
    <section className="mt-6 rounded-[24px] bg-blue-50 p-4 ring-1 ring-blue-100 sm:p-5" aria-labelledby="public-profile-introduction-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase text-blue-700">4th public profile</p>
          <h3 id="public-profile-introduction-title" className="mt-1 text-xl font-black tracking-[-0.03em] text-oriwan-text">4기 공개 자기소개</h3>
          <p className="mt-2 max-w-3xl break-keep text-sm font-semibold leading-6 text-oriwan-text-muted">
            크루 카드를 눌렀을 때 보이는 소개의 원본입니다. 아래 내용만 공개 대시보드에 연결되며, 기존 참가자 메모와 분리해 관리합니다.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
          공개 {publicCount}/{items.length}명
        </span>
      </div>

      {loadError ? (
        <div className={`mt-4 rounded-2xl px-4 py-3 ring-1 ${setupRequired ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-rose-50 text-rose-800 ring-rose-200"}`} role="alert">
          <p className="text-sm font-black">{setupRequired ? "운영 DB 준비가 필요해요" : "자기소개를 불러오지 못했어요"}</p>
          <p className="mt-1 break-keep text-xs font-semibold leading-5">{loadError.message}</p>
          {setupRequired ? (
            <p className="mt-1 text-xs font-semibold leading-5">Supabase SQL Editor에서 최신 `docs/supabase-schema.sql`을 먼저 적용해주세요.</p>
          ) : null}
          <button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-xl bg-white px-4 text-xs font-black text-oriwan-text ring-1 ring-slate-200">다시 불러오기</button>
        </div>
      ) : null}

      {setupRequired && !loadError ? (
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950 ring-1 ring-amber-200" role="alert">
          <p className="text-sm font-black">운영 DB 준비가 필요해요</p>
          <p className="mt-1 break-keep text-xs font-semibold leading-5">
            공개 자기소개 테이블을 찾을 수 없습니다. Supabase SQL Editor에서 최신 `docs/supabase-schema.sql`을 적용한 뒤 다시 저장해주세요.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 grid min-h-36 place-items-center rounded-[22px] bg-white/80 text-center ring-1 ring-blue-100" role="status">
          <div>
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-black text-oriwan-text">자기소개를 불러오는 중…</p>
          </div>
        </div>
      ) : null}

      {!loading && !loadError && !items.length ? (
        <p className="mt-4 rounded-[22px] bg-white px-4 py-8 text-center text-sm font-bold text-oriwan-text-muted ring-1 ring-blue-100">
          먼저 활성 크루를 등록해주세요.
        </p>
      ) : null}

      {!loading && items.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const draft = drafts[item.participant_id] || toDraft(item);
            const feedback = feedbackById[item.participant_id];
            const dirty = !isSameDraft(item, draft);
            const titleId = `profile-title-${item.participant_id}`;
            const bodyId = `profile-body-${item.participant_id}`;
            const feedbackId = `profile-feedback-${item.participant_id}`;
            const saving = savingId === item.participant_id;
            const visibilityChanged = item.active !== draft.active;
            const visibilityLabel = draft.active
              ? (visibilityChanged ? "저장 후 공개" : "공개 중")
              : (visibilityChanged ? "저장 후 비공개" : "비공개");

            return (
              <form
                key={item.participant_id}
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(item);
                }}
                className="rounded-[22px] bg-white p-4 ring-1 ring-slate-950/5 sm:p-5"
                aria-label={`${item.name} 공개 자기소개`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-base font-black text-oriwan-text">{item.name}</strong>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${draft.active ? "bg-lime-100 text-lime-900" : "bg-slate-100 text-slate-600"}`}>
                      {visibilityLabel}
                    </span>
                  </div>
                  <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-oriwan-surface-light px-3 text-[11px] font-black text-oriwan-text">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      disabled={saving}
                      onChange={(event) => updateDraft(item.participant_id, { active: event.target.checked })}
                      className="h-4 w-4 accent-blue-600"
                    />
                    공개
                  </label>
                </div>

                <label htmlFor={titleId} className="mt-4 block text-xs font-black text-oriwan-text-muted">
                  소개 제목
                </label>
                <input
                  id={titleId}
                  required
                  maxLength={MAX_PROFILE_INTRO_TITLE_LENGTH}
                  value={draft.title}
                  disabled={saving}
                  onChange={(event) => updateDraft(item.participant_id, { title: event.target.value })}
                  aria-describedby={feedback ? feedbackId : undefined}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-oriwan-border bg-white px-3 text-base font-black text-oriwan-text outline-none focus:border-blue-500"
                />
                <div className="mt-1 flex justify-end text-[11px] font-bold text-oriwan-text-muted">
                  {draft.title.length}/{MAX_PROFILE_INTRO_TITLE_LENGTH}
                </div>

                <label htmlFor={bodyId} className="mt-2 block text-xs font-black text-oriwan-text-muted">
                  공개 자기소개
                </label>
                <textarea
                  id={bodyId}
                  rows={4}
                  maxLength={MAX_PROFILE_INTRO_LENGTH}
                  value={draft.body}
                  disabled={saving}
                  onChange={(event) => updateDraft(item.participant_id, { body: event.target.value })}
                  aria-required={draft.active}
                  aria-describedby={feedback ? feedbackId : undefined}
                  placeholder="4기 대시보드에 보여줄 자기소개를 적어주세요."
                  className="mt-1.5 w-full resize-y rounded-xl border border-oriwan-border bg-white px-3 py-3 text-base font-semibold leading-6 text-oriwan-text outline-none placeholder:text-slate-400 focus:border-blue-500"
                />
                <div className="mt-1 flex items-start justify-between gap-3 text-[11px] font-bold text-oriwan-text-muted">
                  <span>{draft.active && !draft.body.trim() ? "공개하려면 자기소개가 필요해요." : "불필요한 공백은 정리해 저장됩니다."}</span>
                  <span className="shrink-0">{draft.body.length}/{MAX_PROFILE_INTRO_LENGTH}</span>
                </div>

                {feedback ? (
                  <p id={feedbackId} className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold leading-5 ${feedback.tone === "success" ? "bg-lime-50 text-lime-900" : "bg-rose-50 text-rose-800"}`} role="status">
                    {feedback.message}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={Boolean(savingId) || !dirty}
                  className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-md shadow-blue-600/10 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                >
                  {saving ? "저장 중…" : dirty ? "변경 내용 저장" : "저장됨"}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
