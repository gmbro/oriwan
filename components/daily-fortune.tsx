"use client";

import { useState, type FormEvent } from "react";

import {
  DAILY_FORTUNE_REGIONS,
  type DailyFortuneRegion,
  type DailyFortuneResult,
} from "@/lib/daily-fortune-contract";

type FortuneResponse = {
  date: string;
  fortune: DailyFortuneResult;
  provider: string;
  disclaimer: string;
};

type DailyFortuneProps = {
  defaultName?: string;
};

export function DailyFortune({ defaultName = "" }: DailyFortuneProps) {
  const [name, setName] = useState(defaultName);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [residence, setResidence] = useState<DailyFortuneRegion | "">("");
  const [consent, setConsent] = useState(false);
  const [data, setData] = useState<FortuneResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/me/fortune", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          birth_date: birthDate,
          birth_time: birthTime,
          residence,
          consent,
        }),
      });
      const payload = await response.json().catch(() => ({})) as Partial<FortuneResponse> & { error?: string };
      if (!response.ok || !payload.fortune || !payload.date || !payload.provider || !payload.disclaimer) {
        throw new Error(payload.error || "오늘의 운세를 만들지 못했어요.");
      }
      setData(payload as FortuneResponse);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "오늘의 운세를 만들지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (data) {
    return (
      <section className="rounded-[24px] bg-slate-50 p-4 sm:p-5" aria-labelledby="daily-fortune-result-title">
        <p className="text-sm font-bold text-blue-600">{name}님의 오늘</p>
        <h3 id="daily-fortune-result-title" className="mt-2 text-2xl font-black leading-tight tracking-[-0.03em] text-slate-950">
          {data.fortune.title}
        </h3>
        <p className="mt-3 text-base font-semibold leading-7 text-slate-700">{data.fortune.message}</p>

        <dl className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <dt className="text-xs font-bold text-slate-500">관계</dt>
            <dd className="mt-1 text-sm font-bold leading-6 text-slate-800">{data.fortune.relationship}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <dt className="text-xs font-bold text-slate-500">일과 흐름</dt>
            <dd className="mt-1 text-sm font-bold leading-6 text-slate-800">{data.fortune.work}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <dt className="text-xs font-bold text-slate-500">오늘의 키워드</dt>
            <dd className="mt-1 text-base font-black text-slate-950">{data.fortune.keyword}</dd>
          </div>
          <div className="rounded-2xl bg-blue-600 p-4 text-white">
            <dt className="text-xs font-bold text-blue-100">오늘 해볼 일</dt>
            <dd className="mt-1 text-sm font-black leading-6">{data.fortune.action}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">{data.disclaimer}</p>
        <button
          type="button"
          onClick={() => setData(null)}
          className="mt-4 min-h-12 w-full rounded-2xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
        >
          입력 정보 수정하기
        </button>
      </section>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit} aria-describedby="daily-fortune-privacy daily-fortune-error">
      <div>
        <label htmlFor="daily-fortune-name" className="mb-2 block text-sm font-bold text-slate-700">이름</label>
        <input
          id="daily-fortune-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={40}
          required
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          placeholder="이름을 입력해주세요"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="daily-fortune-birth-date" className="mb-2 block text-sm font-bold text-slate-700">생년월일</label>
          <input
            id="daily-fortune-birth-date"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            min="1900-01-01"
            required
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <div>
          <label htmlFor="daily-fortune-birth-time" className="mb-2 block text-sm font-bold text-slate-700">태어난 시간</label>
          <input
            id="daily-fortune-birth-time"
            type="time"
            value={birthTime}
            onChange={(event) => setBirthTime(event.target.value)}
            required
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="daily-fortune-residence" className="mb-2 block text-sm font-bold text-slate-700">사는 지역</label>
        <select
          id="daily-fortune-residence"
          value={residence}
          onChange={(event) => setResidence(event.target.value as DailyFortuneRegion | "")}
          required
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        >
          <option value="">정확한 주소 대신 권역을 선택해주세요</option>
          {DAILY_FORTUNE_REGIONS.map((region) => <option key={region.value} value={region.value}>{region.label}</option>)}
        </select>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
        />
        <span id="daily-fortune-privacy">
          만 18세 이상이며 외부 AI 이용 안내를 확인했어요. 입력 원문은 저장하거나 외부로 보내지 않고, 비식별화한 운세 조건만 Google Gemini에 전송해요.
        </span>
      </label>

      {error ? <p id="daily-fortune-error" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700" role="status">{error}</p> : <span id="daily-fortune-error" />}

      <button
        type="submit"
        disabled={loading}
        className="min-h-14 w-full rounded-2xl bg-blue-600 px-5 text-base font-black text-white shadow-[0_8px_22px_rgba(49,130,246,0.22)] transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "오늘의 운세를 만드는 중" : "오늘의 운세 보기"}
      </button>
    </form>
  );
}
