import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { guardReadRequest } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DAILY_FORTUNES = [
  {
    title: "작은 시작이 술술 풀리는 날",
    message: "미뤄둔 일은 완벽하게 준비하기보다 가볍게 첫발을 떼보세요. 생각보다 좋은 흐름이 빠르게 따라올 거예요.",
    keyword: "첫걸음",
    action: "가장 쉬운 일 하나를 10분만 시작하기",
    color: "맑은 파랑",
  },
  {
    title: "반가운 연결이 생기는 날",
    message: "짧은 안부 한마디가 예상보다 따뜻한 대화로 이어질 수 있어요. 먼저 마음을 건네도 좋은 하루예요.",
    keyword: "안부",
    action: "생각난 사람에게 짧게 연락하기",
    color: "포근한 노랑",
  },
  {
    title: "내 리듬을 찾기 좋은 날",
    message: "주변의 속도보다 내 호흡에 집중하면 해야 할 일이 선명해져요. 천천히 가도 방향이 맞으면 충분해요.",
    keyword: "리듬",
    action: "알림을 끄고 20분 집중하기",
    color: "차분한 남색",
  },
  {
    title: "뜻밖의 칭찬을 만나는 날",
    message: "평소처럼 해온 일이 누군가에게는 믿음직한 장점으로 보일 수 있어요. 오늘은 스스로도 그 꾸준함을 인정해주세요.",
    keyword: "꾸준함",
    action: "오늘 잘한 일 한 줄 적기",
    color: "싱그러운 초록",
  },
  {
    title: "가벼운 선택이 행운이 되는 날",
    message: "복잡하게 고민하던 일은 가장 편안한 쪽을 골라도 괜찮아요. 여유가 생긴 자리에 좋은 아이디어가 들어올 거예요.",
    keyword: "여유",
    action: "일정 사이에 빈 시간 15분 만들기",
    color: "부드러운 하늘색",
  },
  {
    title: "몸을 움직일수록 맑아지는 날",
    message: "짧은 산책이나 스트레칭만으로도 막혔던 생각이 풀릴 수 있어요. 기록보다 기분 좋은 움직임에 집중해보세요.",
    keyword: "움직임",
    action: "햇빛 아래에서 10분 걷기",
    color: "산뜻한 주황",
  },
  {
    title: "좋은 우연을 발견하는 날",
    message: "늘 지나던 길과 익숙한 대화 속에 작은 힌트가 숨어 있어요. 오늘은 평소보다 한 번 더 천천히 둘러보세요.",
    keyword: "발견",
    action: "익숙한 길에서 새로운 것 하나 찾기",
    color: "은은한 보라",
  },
  {
    title: "마음의 정리가 쉬워지는 날",
    message: "해야 할 것과 내려놓을 것을 구분하면 하루가 훨씬 가벼워져요. 모두 해내려는 마음을 잠시 쉬게 해주세요.",
    keyword: "정리",
    action: "오늘 하지 않아도 되는 일 하나 지우기",
    color: "깨끗한 흰색",
  },
  {
    title: "작은 친절이 돌아오는 날",
    message: "별뜻 없이 건넨 배려가 기분 좋은 방식으로 되돌아올 수 있어요. 다정함을 아끼지 않아도 좋은 날이에요.",
    keyword: "다정함",
    action: "고마운 사람에게 구체적으로 칭찬하기",
    color: "따뜻한 분홍",
  },
  {
    title: "선택에 자신감이 붙는 날",
    message: "이미 충분히 고민했다면 이제는 내 판단을 믿어보세요. 오늘의 결정은 다음 장면을 여는 단단한 출발이 될 거예요.",
    keyword: "결정",
    action: "고민 하나에 마감 시간을 정하기",
    color: "선명한 파랑",
  },
  {
    title: "쉬어갈수록 멀리 가는 날",
    message: "잠깐의 휴식은 흐름을 끊는 일이 아니라 다음 힘을 만드는 일이에요. 잘 쉬는 것도 오늘의 중요한 일정이에요.",
    keyword: "회복",
    action: "따뜻한 음료와 함께 15분 쉬기",
    color: "포근한 베이지",
  },
  {
    title: "기분 좋은 성취가 쌓이는 날",
    message: "큰 목표보다 금방 끝낼 수 있는 일을 차례로 마쳐보세요. 작은 완료가 하루 전체의 자신감을 키워줄 거예요.",
    keyword: "완료",
    action: "5분 안에 끝나는 일부터 처리하기",
    color: "활기찬 라임",
  },
] as const;

function hasKakaoIdentity(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string }> }) {
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

function fortuneSecret() {
  const secret = process.env.DAILY_FORTUNE_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;

  const mustBeIndependent = [
    process.env.ADMIN_SESSION_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.KAKAO_CLIENT_SECRET,
  ].filter(Boolean);
  return mustBeIndependent.includes(secret) ? null : secret;
}

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: {
      key: "daily-fortune",
      limit: 30,
      windowMs: 60_000,
      message: "운세 요청이 잠시 몰렸어요. 잠시 후 다시 확인해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." },
      { status: 503, headers: privateHeaders },
    );
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !hasKakaoIdentity(user)) {
    return NextResponse.json(
      { error: "오늘의 운세는 카카오 로그인 후 확인할 수 있어요." },
      { status: 401, headers: privateHeaders },
    );
  }

  const secret = fortuneSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "오늘의 운세 서버 설정이 아직 준비되지 않았어요." },
      { status: 503, headers: privateHeaders },
    );
  }

  const date = toKstIsoDate(new Date());
  const digest = createHmac("sha256", secret)
    .update(`fortune:v1|4th|${date}|${user.id}`)
    .digest();
  const fortune = DAILY_FORTUNES[digest.readUInt32BE(0) % DAILY_FORTUNES.length];

  return NextResponse.json({
    date,
    fortune,
    disclaimer: "재미로 가볍게 즐기는 오늘의 메시지예요.",
  }, { headers: privateHeaders });
}
