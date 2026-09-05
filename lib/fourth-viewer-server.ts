import "server-only";

import { getServiceClient } from "@/lib/admin-data";
import {
  anonymousFourthViewer,
  type FourthViewer,
} from "@/lib/fourth-viewer-contract";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { resolveParticipantAccount } from "@/lib/participant-account-server";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

export async function getFourthViewer(): Promise<FourthViewer> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ...anonymousFourthViewer, auth_available: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const providers = new Set([
    typeof user?.app_metadata?.provider === "string" ? user.app_metadata.provider : "",
    ...(user?.identities || []).map((identity) => identity.provider),
  ]);
  const isKakao = Boolean(user && providers.has("kakao"));

  if (!user || !isKakao) return { ...anonymousFourthViewer };

  let approvedParticipant = false;
  let displayName: string | null = getKakaoDisplayName(user);
  let connectionStatus = "unlinked";
  const service = getServiceClient();
  if (service) {
    try {
      const connection = await resolveParticipantAccount(service, user.id);
      approvedParticipant = connection.status === "approved";
      connectionStatus = connection.status;
      displayName = approvedParticipant ? connection.displayName : displayName;
    } catch (error) {
      logServerFailure("Hello 2027 viewer participant lookup", error);
    }
  }

  return {
    authenticated: true,
    provider: "kakao",
    display_name: displayName,
    approved_participant: approvedParticipant,
    verified_name: Boolean(approvedParticipant && displayName),
    name_source: approvedParticipant && displayName ? "admin" : displayName ? "kakao" : null,
    connection_status: connectionStatus,
  };
}
