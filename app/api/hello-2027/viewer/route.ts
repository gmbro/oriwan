import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { resolveParticipantAccount } from "@/lib/participant-account-server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      authenticated: false,
      provider: null,
      display_name: null,
      approved_participant: false,
      verified_name: false,
      connection_status: "unlinked",
      auth_available: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const providers = new Set([
    typeof user?.app_metadata?.provider === "string" ? user.app_metadata.provider : "",
    ...(user?.identities || []).map((identity) => identity.provider),
  ]);
  const isKakao = Boolean(user && providers.has("kakao"));

  if (!user || !isKakao) {
    return NextResponse.json({
      authenticated: false,
      provider: null,
      display_name: null,
      approved_participant: false,
      verified_name: false,
      connection_status: "unlinked",
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  let approvedParticipant = false;
  let displayName: string | null = null;
  let connectionStatus = "unlinked";
  const service = getServiceClient();
  if (service) {
    try {
      const connection = await resolveParticipantAccount(service, user.id);
      approvedParticipant = connection.status === "approved";
      connectionStatus = connection.status;
      displayName = approvedParticipant ? connection.displayName : null;
    } catch (error) {
      console.error("Hello 2027 viewer participant lookup error:", error);
    }
  }

  return NextResponse.json({
    authenticated: true,
    provider: "kakao",
    display_name: displayName,
    approved_participant: approvedParticipant,
    verified_name: Boolean(approvedParticipant && displayName),
    connection_status: connectionStatus,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
