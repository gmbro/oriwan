"use client";
import { AdminPersonalGoal } from "./admin-personal-goal";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { broadcastDashboardRefresh } from "@/lib/dashboard-refresh";
import { resolveHello2027ProfileImageUrl } from "@/lib/hello-2027-profile-image";
import { MAX_PROFILE_INTRO_LENGTH, normalizeProfileIntroduction } from "@/lib/hello-2027-profile-introduction-contract";

type ProfileIntroduction = {
  participant_id: string;
  name: string;
  title: string;
  body: string;
  active: boolean;
  profile_image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileDraft = Pick<ProfileIntroduction, "body" | "active">;

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

type ProfileImageApiPayload = {
  error?: string;
  participant_id?: string;
  profile_image_url?: string | null;
};

type TimeMachineGoal = {
  id: string;
  participant_id: string;
  goal_title: string;
  goal_detail: string;
  commitment: string;
  created_at: string;
  unlock_at: string;
  status: "sealed" | "opened";
};

type TimeMachineApiPayload = {
  error?: string;
  setup_required?: boolean;
  items?: TimeMachineGoal[];
  reset?: { goal_id: string; participant_id: string };
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시간 확인 필요" : DATE_TIME_FORMATTER.format(date);
}

function toDraft(item: ProfileIntroduction): ProfileDraft {
  return {
    body: item.body,
    active: item.active,
  };
}

function isSameDraft(item: ProfileIntroduction, draft: ProfileDraft) {
  return item.body === draft.body
    && item.active === draft.active;
}

export function AdminProfileIntroductions({
  active = true,
  refreshKey = "",
}: {
  active?: boolean;
  refreshKey?: string;
}) {
  const [items, setItems] = useState<ProfileIntroduction[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProfileDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [imageBusyId, setImageBusyId] = useState("");
  const [loadError, setLoadError] = useState<Feedback | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [feedbackById, setFeedbackById] = useState<Record<string, Feedback>>({});
  const [imageFeedbackById, setImageFeedbackById] = useState<Record<string, Feedback>>({});
  const [timeMachineGoals, setTimeMachineGoals] = useState<TimeMachineGoal[]>([]);
  const [timeMachineLoading, setTimeMachineLoading] = useState(true);
  const [timeMachineLoadError, setTimeMachineLoadError] = useState<Feedback | null>(null);
  const [timeMachineSetupRequired, setTimeMachineSetupRequired] = useState(false);
  const [confirmingResetId, setConfirmingResetId] = useState("");
  const [resettingId, setResettingId] = useState("");
  const [timeMachineFeedbackById, setTimeMachineFeedbackById] = useState<Record<string, Feedback>>({});

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
      setImageFeedbackById({});
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

  const loadTimeMachineGoals = useCallback(async () => {
    setTimeMachineLoading(true);
    setTimeMachineLoadError(null);
    try {
      const response = await fetch("/api/admin/hello-2027/time-machine", { cache: "no-store" });
      const json = await response.json().catch(() => ({})) as TimeMachineApiPayload;
      if (!response.ok) {
        setTimeMachineSetupRequired(Boolean(json.setup_required));
        throw new Error(json.error || "목표 타임머신을 불러오지 못했어요.");
      }
      setTimeMachineGoals(Array.isArray(json.items) ? json.items : []);
      setTimeMachineSetupRequired(false);
      setTimeMachineFeedbackById({});
    } catch (error) {
      setTimeMachineLoadError({
        tone: "error",
        message: error instanceof Error ? error.message : "목표 타임머신을 불러오지 못했어요.",
      });
    } finally {
      setTimeMachineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    queueMicrotask(() => {
      void load();

    });
  }, [active, load, loadTimeMachineGoals, refreshKey]);

  const publicCount = useMemo(() => items.filter((item) => item.active).length, [items]);
  const timeMachineGoalByParticipant = useMemo(
    () => new Map(timeMachineGoals.map((goal) => [goal.participant_id, goal])),
    [timeMachineGoals],
  );

  const updateDraft = (participantId: string, patch: Partial<ProfileDraft>) => {
    setDrafts((current) => ({
      ...current,
      [participantId]: {
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

  const save = async (item: ProfileIntroduction, clear = false) => {
    const draft = clear ? { ...toDraft(item), body: "", active: false } : drafts[item.participant_id] || toDraft(item);
    const body = normalizeProfileIntroduction(draft.body) ?? "";

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
        currentItem.participant_id === saved.participant_id
          ? { ...saved, profile_image_url: currentItem.profile_image_url }
          : currentItem
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
      void broadcastDashboardRefresh();
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

  const updateProfileImage = async (item: ProfileIntroduction, file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageFeedbackById((current) => ({
        ...current,
        [item.participant_id]: { tone: "error", message: "JPG, PNG, WebP 이미지를 선택해주세요." },
      }));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setImageFeedbackById((current) => ({
        ...current,
        [item.participant_id]: { tone: "error", message: "프로필 사진은 4MB 이하로 올려주세요." },
      }));
      return;
    }

    setImageBusyId(item.participant_id);
    setImageFeedbackById((current) => {
      const next = { ...current };
      delete next[item.participant_id];
      return next;
    });
    try {
      const formData = new FormData();
      formData.set("participant_id", item.participant_id);
      formData.set("file", file);
      const response = await fetch("/api/admin/hello-2027/profile-image", {
        method: "POST",
        body: formData,
      });
      const json = await response.json().catch(() => ({})) as ProfileImageApiPayload;
      if (!response.ok || typeof json.profile_image_url !== "string") {
        throw new Error(json.error || "프로필 사진을 저장하지 못했어요.");
      }
      setItems((current) => current.map((currentItem) => (
        currentItem.participant_id === item.participant_id
          ? { ...currentItem, profile_image_url: json.profile_image_url || null }
          : currentItem
      )));
      setImageFeedbackById((current) => ({
        ...current,
        [item.participant_id]: { tone: "success", message: "프로필 사진을 변경했어요." },
      }));
      void broadcastDashboardRefresh();
    } catch (error) {
      setImageFeedbackById((current) => ({
        ...current,
        [item.participant_id]: {
          tone: "error",
          message: error instanceof Error ? error.message : "프로필 사진을 저장하지 못했어요.",
        },
      }));
    } finally {
      setImageBusyId("");
    }
  };

  const removeProfileImage = async (item: ProfileIntroduction) => {
    if (!window.confirm(`${item.name}님의 프로필 사진을 기본 이미지로 바꿀까요?`)) return;
    setImageBusyId(item.participant_id);
    setImageFeedbackById((current) => {
      const next = { ...current };
      delete next[item.participant_id];
      return next;
    });
    try {
      const response = await fetch("/api/admin/hello-2027/profile-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: item.participant_id }),
      });
      const json = await response.json().catch(() => ({})) as ProfileImageApiPayload;
      if (!response.ok) throw new Error(json.error || "프로필 사진을 삭제하지 못했어요.");
      setItems((current) => current.map((currentItem) => (
        currentItem.participant_id === item.participant_id
          ? { ...currentItem, profile_image_url: null }
          : currentItem
      )));
      setImageFeedbackById((current) => ({
        ...current,
        [item.participant_id]: { tone: "success", message: "기본 프로필 이미지로 바꿨어요." },
      }));
      void broadcastDashboardRefresh();
    } catch (error) {
      setImageFeedbackById((current) => ({
        ...current,
        [item.participant_id]: {
          tone: "error",
          message: error instanceof Error ? error.message : "프로필 사진을 삭제하지 못했어요.",
        },
      }));
    } finally {
      setImageBusyId("");
    }
  };

  const resetTimeMachine = async (participantId: string, goal: TimeMachineGoal) => {
    setResettingId(goal.id);
    setTimeMachineFeedbackById((current) => {
      const next = { ...current };
      delete next[participantId];
      return next;
    });
    try {
      const response = await fetch("/api/admin/hello-2027/time-machine", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goal.id }),
      });
      const json = await response.json().catch(() => ({})) as TimeMachineApiPayload;
      if (!response.ok || !json.reset) {
        if (json.setup_required) setTimeMachineSetupRequired(true);
        throw new Error(json.error || "목표 타임머신을 재설정하지 못했어요.");
      }

      setTimeMachineGoals((current) => current.filter((item) => item.id !== goal.id));
      setConfirmingResetId("");
      setTimeMachineFeedbackById((current) => ({
        ...current,
        [participantId]: {
          tone: "success",
          message: "기존 목표를 삭제했어요. 멤버가 새 목표 타임머신을 설정할 수 있습니다.",
        },
      }));
    } catch (error) {
      setTimeMachineFeedbackById((current) => ({
        ...current,
        [participantId]: {
          tone: "error",
          message: error instanceof Error ? error.message : "목표 타임머신을 재설정하지 못했어요.",
        },
      }));
    } finally {
      setResettingId("");
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

      {timeMachineLoadError ? (
        <div className={`mt-4 rounded-2xl px-4 py-3 ring-1 ${timeMachineSetupRequired ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-rose-50 text-rose-800 ring-rose-200"}`} role="alert">
          <p className="text-sm font-black">{timeMachineSetupRequired ? "타임머신 운영 DB 준비가 필요해요" : "타임머신을 불러오지 못했어요"}</p>
          <p className="mt-1 break-keep text-xs font-semibold leading-5">{timeMachineLoadError.message}</p>
          <button type="button" onClick={() => void loadTimeMachineGoals()} className="mt-3 min-h-11 rounded-xl bg-white px-4 text-xs font-black text-oriwan-text ring-1 ring-slate-200">
            다시 불러오기
          </button>
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
        <div className="mt-4 grid gap-3">
          {items.map((item) => {
            const draft = drafts[item.participant_id] || toDraft(item);
            const feedback = feedbackById[item.participant_id];
            const imageFeedback = imageFeedbackById[item.participant_id];
            const dirty = !isSameDraft(item, draft);
            const bodyId = `profile-body-${item.participant_id}`;
            const feedbackId = `profile-feedback-${item.participant_id}`;
            const saving = savingId === item.participant_id;
            const imageBusy = imageBusyId === item.participant_id;
            const timeMachineGoal = timeMachineGoalByParticipant.get(item.participant_id);
            const timeMachineFeedback = timeMachineFeedbackById[item.participant_id];
            const confirmingReset = Boolean(timeMachineGoal && confirmingResetId === timeMachineGoal.id);
            const resetting = Boolean(timeMachineGoal && resettingId === timeMachineGoal.id);
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
                className="w-full rounded-[22px] bg-white p-4 ring-1 ring-slate-950/5 sm:p-5"
                aria-label={`${item.name} 공개 자기소개`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-50 text-xl font-black text-blue-700 ring-1 ring-blue-100">
                      <Image
                        src={resolveHello2027ProfileImageUrl(item.profile_image_url)}
                        alt={`${item.name} 프로필 사진`}
                        fill
                        unoptimized={Boolean(item.profile_image_url)}
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate text-base font-black text-oriwan-text">{item.name}</strong>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${draft.active ? "bg-lime-100 text-lime-900" : "bg-slate-100 text-slate-600"}`}>
                        {visibilityLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <label className={`inline-flex min-h-11 items-center rounded-xl bg-blue-50 px-3 text-xs font-black text-blue-700 ring-1 ring-blue-100 ${imageBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-blue-100"}`}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={imageBusy}
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void updateProfileImage(item, file);
                        }}
                      />
                      {imageBusy ? "처리 중…" : item.profile_image_url ? "사진 변경" : "사진 등록"}
                    </label>
                    {item.profile_image_url ? (
                      <button
                        type="button"
                        disabled={imageBusy}
                        onClick={() => void removeProfileImage(item)}
                        className="min-h-11 rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        사진 삭제
                      </button>
                    ) : null}
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
                </div>

                {imageFeedback ? (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold leading-5 ${imageFeedback.tone === "success" ? "bg-lime-50 text-lime-900" : "bg-rose-50 text-rose-800"}`} role="status">
                    {imageFeedback.message}
                  </p>
                ) : null}

                <label htmlFor={bodyId} className="mt-4 block text-sm font-black text-oriwan-text">
                  자기소개
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
                  <span className="shrink-0">{(normalizeProfileIntroduction(draft.body) ?? "").length}/{MAX_PROFILE_INTRO_LENGTH}</span>
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


                <button type="button" disabled={Boolean(savingId)||!item.body} onClick={()=>{if(window.confirm("자기소개를 삭제할까요?"))void save(item,true);}} className="mt-2 min-h-11 rounded-xl bg-rose-50 px-4 text-sm font-bold text-rose-700 disabled:opacity-40">자기소개 삭제</button>
                <AdminPersonalGoal participantId={item.participant_id} />
              </form>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
