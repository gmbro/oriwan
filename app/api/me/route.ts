import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { resolveParticipantAccount } from "@/lib/participant-account-server";
import { createClient } from "@/lib/supabase/server";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { logServerFailure } from "@/lib/server-error-log";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function hasKakaoIdentity(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string }> }) {
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !hasKakaoIdentity(user)) {
    return NextResponse.json({ error: "카카오 로그인이 필요해요." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, { status: 503 });

  try {
    const connection = await resolveParticipantAccount(service, user.id);
    const kakaoDisplayName = getKakaoDisplayName(user);
    return NextResponse.json({
      user: { id: user.id },
      display_name: connection.displayName || kakaoDisplayName,
      name_source: connection.displayName ? "admin" : kakaoDisplayName ? "kakao" : null,
      matched_participant: connection.participant,
      connection_status: connection.status,
      connection_message: connection.message,
    }, { headers: privateHeaders });
  } catch (err) {
    logServerFailure("Me profile", err);
    return NextResponse.json({ error: "개인 기능을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function PATCH() {
  return NextResponse.json({
    error: "댓글 표시 이름은 운영자가 어드민에서 확인하고 변경합니다.",
  }, { status: 403 });
}
