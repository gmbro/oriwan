import "server-only";

import type { JwtPayload } from "@supabase/supabase-js";
import { after } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { broadcastDashboardRefreshFromServer } from "@/lib/dashboard-refresh-server";
import {
  anonymousFourthViewer,
  type FourthViewer,
} from "@/lib/fourth-viewer-contract";
import {
  importNewKakaoProfileImage,
  markKakaoProfileImageImportPendingIfEligible,
} from "@/lib/hello-2027-profile-image-storage";
import { getKakaoDisplayName, getKakaoProfileImageUrl } from "@/lib/kakao-display-name";
import { ensureParticipantAccount, resolveParticipantAccount } from "@/lib/participant-account-server";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

function hasKakaoIdentity(claims: JwtPayload | null) {
  if (!claims) return false;
  const appMetadata = claims.app_metadata || {};
  const providers = new Set([
    typeof appMetadata.provider === "string" ? appMetadata.provider : "",
    ...(Array.isArray(appMetadata.providers)
      ? appMetadata.providers.filter((provider): provider is string => typeof provider === "string")
      : []),
  ]);
  return providers.has("kakao");
}

async function getVerifiedKakaoClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  if (error || !hasKakaoIdentity(claims)) return null;
  return claims;
}

export async function hasAuthenticatedFourthViewer() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
  return Boolean(await getVerifiedKakaoClaims());
}

export async function getFourthViewer(): Promise<FourthViewer> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ...anonymousFourthViewer, auth_available: false };
  }

  // getClaims verifies the access token and, with asymmetric Supabase signing
  // keys, avoids the Auth server round trip that getUser() makes on every RSC
  // refresh. Authorization still relies only on verified JWT app_metadata.
  const claims = await getVerifiedKakaoClaims();
  if (!claims) return { ...anonymousFourthViewer };

  let approvedParticipant = false;
  let displayName: string | null = getKakaoDisplayName({ user_metadata: claims.user_metadata });
  const kakaoProfileImageUrl = getKakaoProfileImageUrl({ user_metadata: claims.user_metadata });
  let connectionStatus = "unlinked";
  const service = getServiceClient();
  if (service) {
    try {
      const connection = await ensureParticipantAccount(service, claims.sub, displayName);
      approvedParticipant = connection.status === "approved";
      connectionStatus = connection.status;
      displayName = approvedParticipant ? connection.displayName : displayName;
      const operatorVerified = approvedParticipant && !connection.automaticallyEnrolled;

      // The OAuth callback is the normal enrollment path. If it could not reach
      // the service database, this viewer request may win first enrollment
      // instead; preserve the same Kakao-image behavior without touching older
      // members or re-importing after an explicit upload/deletion.
      if (
        connection.newlyEnrolled
        && connection.participant
        && kakaoProfileImageUrl
      ) {
        const participantId = connection.participant.id;
        after(async () => {
          try {
            if (!await markKakaoProfileImageImportPendingIfEligible(service, participantId)) {
              return;
            }
            const imported = await importNewKakaoProfileImage(
              service,
              participantId,
              kakaoProfileImageUrl,
            );
            if (!imported) return;
            invalidatePublicDashboardCache();
            await broadcastDashboardRefreshFromServer(service);
          } catch (profileImageError) {
            logServerFailure("Kakao fallback profile image import", profileImageError);
          }
        });
      }

      return {
        authenticated: true,
        provider: "kakao",
        display_name: displayName,
        participant_id: connection.participant?.id ?? null,
        approved_participant: approvedParticipant,
        // A linked member can now edit their display name; Kakao verification
        // confirms the account, not the authenticity of that editable name.
        verified_name: false,
        name_source: operatorVerified && displayName ? "admin" : displayName ? "kakao" : null,
        connection_status: connectionStatus,
        dashboard_member_changed: Boolean(connection.dashboardMemberChanged),
      };
    } catch (error) {
      logServerFailure("Hello 2027 viewer participant lookup", error);
    }
  }

  return {
    authenticated: true,
    provider: "kakao",
    display_name: displayName,
    participant_id: null,
    approved_participant: approvedParticipant,
    verified_name: Boolean(approvedParticipant && displayName),
    name_source: approvedParticipant && displayName ? "admin" : displayName ? "kakao" : null,
    connection_status: connectionStatus,
  };
}

export async function hasApprovedFourthViewer() {
 if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
 try { const claims=await getVerifiedKakaoClaims(); const service=getServiceClient();
 if(!claims?.sub || !service)return false;
 return (await resolveParticipantAccount(service,claims.sub)).status === "approved";
 } catch {return false;}
}
