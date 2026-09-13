import "server-only";

import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js";

import { getServiceClient } from "@/lib/admin-data";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import {
  ensureParticipantAccount,
  type ParticipantAccountResolution,
} from "@/lib/participant-account-server";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { createClient } from "@/lib/supabase/server";

type PersonalContextFailureReason =
  | "configuration_unavailable"
  | "unauthenticated"
  | "service_unavailable";

export type PersonalKakaoIdentityResolution =
  | {
      ok: true;
      authUserId: string;
      claims: JwtPayload;
      displayName: string | null;
    }
  | {
      ok: false;
      reason: Exclude<PersonalContextFailureReason, "service_unavailable">;
    };

export type PersonalMemberContextResolution =
  | {
      ok: true;
      authUserId: string;
      claims: JwtPayload;
      displayName: string | null;
      service: SupabaseClient;
      connection: ParticipantAccountResolution;
    }
  | {
      ok: false;
      reason: PersonalContextFailureReason;
    };

function hasKakaoIdentity(claims: JwtPayload | null): claims is JwtPayload {
  if (!claims || typeof claims.sub !== "string" || !claims.sub) return false;
  const appMetadata = claims.app_metadata || {};
  const providers = new Set([
    typeof appMetadata.provider === "string" ? appMetadata.provider : "",
    ...(Array.isArray(appMetadata.providers)
      ? appMetadata.providers.filter((provider): provider is string => typeof provider === "string")
      : []),
  ]);
  return providers.has("kakao");
}

/** Verifies the session locally when Supabase uses asymmetric signing keys. */
export async function resolvePersonalKakaoIdentity(): Promise<PersonalKakaoIdentityResolution> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: "configuration_unavailable" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  if (error || !hasKakaoIdentity(claims)) {
    return { ok: false, reason: "unauthenticated" };
  }

  return {
    ok: true,
    authUserId: claims.sub,
    claims,
    displayName: getKakaoDisplayName({ user_metadata: claims.user_metadata }),
  };
}

/** Resolves verified identity, service client, and participant linkage once per request. */
export async function resolvePersonalMemberContext(): Promise<PersonalMemberContextResolution> {
  const identity = await resolvePersonalKakaoIdentity();
  if (!identity.ok) return identity;

  const service = getServiceClient();
  if (!service) return { ok: false, reason: "service_unavailable" };

  const connection = await ensureParticipantAccount(
    service,
    identity.authUserId,
    identity.displayName,
  );
  // Every current caller is a Route Handler, so a fallback enrollment can
  // safely expire the shared public projection before returning its payload.
  if (connection.dashboardMemberChanged) invalidatePublicDashboardCache();
  return { ...identity, service, connection };
}
