import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { hasValidAdminSession } from "@/lib/admin-server";

// Existing verified sessions remain usable; newly issued OTP sessions use a
// separate cookie so member login no longer replaces the administrator session.
export async function createAdminAuthClient() {
  const dedicated=await createClient({cookieName:"twtt-admin-auth"});
  const current=await dedicated.auth.getClaims();
  if(current.data?.claims?.sub)return dedicated;
  const legacy=await createClient();
  const previous=await legacy.auth.getClaims();
  const claims=previous.data?.claims;
  if(claims?.sub && isAdminEmail(claims.email) && await hasValidAdminSession(claims.sub))return legacy;
  return dedicated;
}
