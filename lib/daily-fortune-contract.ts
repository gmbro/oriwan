export const DAILY_FORTUNE_REGIONS = [
  { value: "seoul", label: "서울" },
  { value: "capital", label: "경기·인천" },
  { value: "gangwon", label: "강원" },
  { value: "chungcheong", label: "충청" },
  { value: "jeolla", label: "전라" },
  { value: "gyeongsang", label: "경상" },
  { value: "jeju", label: "제주" },
  { value: "overseas", label: "해외" },
] as const;

export type DailyFortuneRegion = (typeof DAILY_FORTUNE_REGIONS)[number]["value"];

export type DailyFortuneInput = {
  name: string;
  birth_date: string;
  birth_time: string;
  residence: DailyFortuneRegion;
  consent: true;
};

export type DailyFortuneResult = {
  title: string;
  message: string;
  keyword: string;
  action: string;
  relationship: string;
  work: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

function isIsoCalendarDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function isAdultOn(birthDate: string, todayIso: string) {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = todayIso.split("-").map(Number);
  const eighteenthBirthday = new Date(Date.UTC(birthYear + 18, birthMonth - 1, birthDay));
  const today = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  return eighteenthBirthday.getTime() <= today.getTime();
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").replace(CONTROL_PATTERN, "").replace(/\s+/g, " ").trim();
  return normalized.length >= 2 && normalized.length <= 40 ? normalized : null;
}

export function isDailyFortuneRegion(value: unknown): value is DailyFortuneRegion {
  return typeof value === "string"
    && DAILY_FORTUNE_REGIONS.some((region) => region.value === value);
}

export function parseDailyFortuneInput(value: unknown, todayIso: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, error: "입력 내용을 다시 확인해주세요." };
  }

  const record = value as Record<string, unknown>;
  const name = normalizeName(record.name);
  if (!name) return { ok: false as const, error: "이름은 2~40자로 입력해주세요." };

  const birthDate = typeof record.birth_date === "string" ? record.birth_date : "";
  if (!isIsoCalendarDate(birthDate) || birthDate < "1900-01-01" || birthDate > todayIso) {
    return { ok: false as const, error: "생년월일을 정확히 입력해주세요." };
  }
  if (!isAdultOn(birthDate, todayIso)) {
    return { ok: false as const, error: "오늘의 운세는 만 18세 이상만 이용할 수 있어요." };
  }

  const birthTime = typeof record.birth_time === "string" ? record.birth_time : "";
  if (!TIME_PATTERN.test(birthTime)) {
    return { ok: false as const, error: "태어난 시간을 정확히 입력해주세요." };
  }

  if (!isDailyFortuneRegion(record.residence)) {
    return { ok: false as const, error: "현재 사는 지역을 선택해주세요." };
  }

  if (record.consent !== true) {
    return { ok: false as const, error: "외부 AI 이용 안내를 확인하고 동의해주세요." };
  }

  return {
    ok: true as const,
    value: {
      name,
      birth_date: birthDate,
      birth_time: birthTime,
      residence: record.residence,
      consent: true,
    } satisfies DailyFortuneInput,
  };
}

const WESTERN_ZODIAC = [
  [120, "염소자리"], [219, "물병자리"], [321, "물고기자리"], [420, "양자리"],
  [521, "황소자리"], [622, "쌍둥이자리"], [723, "게자리"], [823, "사자자리"],
  [923, "처녀자리"], [1023, "천칭자리"], [1123, "전갈자리"], [1222, "사수자리"],
] as const;
const CHINESE_ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;

function westernZodiac(birthDate: string) {
  const monthDay = Number(birthDate.slice(5, 7)) * 100 + Number(birthDate.slice(8, 10));
  const match = WESTERN_ZODIAC.find(([boundary]) => monthDay < boundary);
  return match?.[1] ?? "염소자리";
}

function nameEnergy(name: string) {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 9) + 1;
}

export function deriveAnonymousFortuneProfile(input: DailyFortuneInput) {
  const year = Number(input.birth_date.slice(0, 4));
  const hour = Number(input.birth_time.slice(0, 2));
  const region = DAILY_FORTUNE_REGIONS.find((candidate) => candidate.value === input.residence)?.label ?? "국내";
  const timeBand = hour < 5 ? "깊은 밤" : hour < 9 ? "아침" : hour < 12 ? "오전" : hour < 18 ? "오후" : hour < 22 ? "저녁" : "밤";

  return {
    western_zodiac: westernZodiac(input.birth_date),
    chinese_zodiac: `${CHINESE_ZODIAC[((year - 4) % 12 + 12) % 12]}띠`,
    birth_time_band: timeBand,
    residence_region: region,
    name_energy: nameEnergy(input.name),
  };
}
