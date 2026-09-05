import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { FOURTH_SEASON_KEY, ensureParticipantAccount } from "@/lib/participant-account-server";
import { guardMutationRequest } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

const GIFT_MESSAGES = [
  "부럽네요!",
  "참 잘했어요!",
  "오늘도 화이팅!",
  "고생하셨어요 :)",
] as const;
const FOURTH_SEASON_START_DATE = "2026-09-23";
const FOURTH_SEASON_END_DATE = "2026-12-31";
const FOURTH_GIFT_BOX_LIVE = process.env.FOURTH_GIFT_BOX_LIVE === "true";

export const dynamic = "force-dynamic";

type GiftContext = {
  authUserId: string;
  adminUserId: string;
  participantId: string;
  participantName: string;
  recordDate: string;
  seasonActive: boolean;
  eligible: boolean;
};

function hasKakaoIdentity(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string }> }) {
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

async function resolveGiftContext(): Promise<GiftContext | NextResponse> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !hasKakaoIdentity(user)) {
    return NextResponse.json({ error: "카카오 로그인이 필요해요." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, { status: 503 });
  }

  const connection = await ensureParticipantAccount(service, user.id, getKakaoDisplayName(user));
  if (connection.status !== "approved" || !connection.adminUserId || !connection.participant) {
    return NextResponse.json({
      error: "개인 계정 연결을 완료하지 못했어요. 잠시 후 다시 시도해주세요.",
      connection_status: connection.status,
    }, { status: 403 });
  }

  const recordDate = toKstIsoDate(new Date());
  const seasonActive = FOURTH_GIFT_BOX_LIVE
    && recordDate >= FOURTH_SEASON_START_DATE
    && recordDate <= FOURTH_SEASON_END_DATE;
  if (!seasonActive) {
    return {
      authUserId: user.id,
      adminUserId: connection.adminUserId,
      participantId: connection.participant.id,
      participantName: connection.participant.name,
      recordDate,
      seasonActive: false,
      eligible: false,
    };
  }
  const { data: certification, error: certificationError } = await service
    .from("daily_run_records")
    .select("id")
    .eq("user_id", connection.adminUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("participant_id", connection.participant.id)
    .eq("record_date", recordDate)
    .eq("status", "certified")
    .maybeSingle();

  if (certificationError) throw certificationError;

  return {
    authUserId: user.id,
    adminUserId: connection.adminUserId,
    participantId: connection.participant.id,
    participantName: connection.participant.name,
    recordDate,
    seasonActive,
    eligible: Boolean(certification),
  };
}

async function readClaim(context: GiftContext) {
  const service = getServiceClient();
  if (!service) return { data: null, error: new Error("service_missing") };

  return service
    .from("daily_gift_claims")
    .select("id, record_date, message, claimed_at")
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("user_id", context.adminUserId)
    .eq("participant_id", context.participantId)
    .eq("record_date", context.recordDate)
    .maybeSingle();
}

export async function GET() {
  try {
    const context = await resolveGiftContext();
    if (context instanceof NextResponse) return context;

    const { data, error } = await readClaim(context);
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(missingSchemaResponse("오늘의 응원 상자 저장소가 아직 준비되지 않았어요."), { status: 503 });
      }
      throw error;
    }

    return NextResponse.json({
      eligible: context.eligible,
      season_active: context.seasonActive,
      season_starts_on: FOURTH_SEASON_START_DATE,
      participant_name: context.participantName,
      record_date: context.recordDate,
      claim: data || null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
  } catch (error) {
    logServerFailure("Gift box status", error);
    return NextResponse.json({ error: "응원 상자 상태를 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 1024,
    rateLimit: {
      key: "daily-gift-box",
      limit: 8,
      windowMs: 60_000,
      message: "상자를 여는 요청이 잠시 몰렸어요. 잠시 후 다시 눌러주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolveGiftContext();
    if (context instanceof NextResponse) return context;
    if (!context.seasonActive) {
      return NextResponse.json({ error: "4기 운영 오픈 후 응원 상자를 열 수 있어요." }, { status: 403 });
    }
    if (!context.eligible) {
      return NextResponse.json({ error: "오늘 인증을 완료하면 응원 상자가 열려요." }, { status: 403 });
    }

    const existing = await readClaim(context);
    if (existing.error && !isMissingTableError(existing.error)) throw existing.error;
    if (existing.error && isMissingTableError(existing.error)) {
      return NextResponse.json(missingSchemaResponse("오늘의 응원 상자 저장소가 아직 준비되지 않았어요."), { status: 503 });
    }
    if (existing.data) {
      return NextResponse.json({ claim: existing.data, already_claimed: true });
    }

    const service = getServiceClient();
    if (!service) return NextResponse.json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, { status: 503 });

    const message = GIFT_MESSAGES[randomInt(GIFT_MESSAGES.length)];
    const { data, error } = await service
      .from("daily_gift_claims")
      .insert({
        season_key: FOURTH_SEASON_KEY,
        user_id: context.adminUserId,
        participant_id: context.participantId,
        auth_user_id: context.authUserId,
        record_date: context.recordDate,
        message,
      })
      .select("id, record_date, message, claimed_at")
      .single();

    if (error?.code === "23505") {
      const racedClaim = await readClaim(context);
      if (racedClaim.data) return NextResponse.json({ claim: racedClaim.data, already_claimed: true });
    }
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(missingSchemaResponse("오늘의 응원 상자 저장소가 아직 준비되지 않았어요."), { status: 503 });
      }
      throw error;
    }

    return NextResponse.json({ claim: data, already_claimed: false });
  } catch (error) {
    logServerFailure("Gift box claim", error);
    return NextResponse.json({ error: "응원 상자를 열지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
