import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "@/lib/admin";
import { normalizeRunnerName } from "@/lib/challenge";

type AdminUser = {
  id: string;
  email?: string;
};

type ParticipantRow = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
  created_at: string;
};

type AdminUserIdCache = {
  email: string;
  value: string | null;
  expiresAt: number;
  promise?: Promise<string | null>;
};

const ADMIN_USER_ID_CACHE_TTL_MS = 10 * 60 * 1000;
const ADMIN_USER_ID_MISS_TTL_MS = 60 * 1000;
let adminUserIdCache: AdminUserIdCache | null = null;

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAdminUserIdUncached(supabase: SupabaseClient) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const admin = data.users.find(
      (user: AdminUser) => user.email?.toLowerCase() === ADMIN_EMAIL
    );
    if (admin) return admin.id;
    if (data.users.length < 100) break;
    page += 1;
  }

  return null;
}

export async function findAdminUserId(supabase: SupabaseClient) {
  const email = ADMIN_EMAIL.toLowerCase();
  const now = Date.now();

  if (adminUserIdCache?.email === email) {
    if (adminUserIdCache.expiresAt > now) return adminUserIdCache.value;
    if (adminUserIdCache.promise) return adminUserIdCache.promise;
  }

  const promise = findAdminUserIdUncached(supabase)
    .then((value) => {
      adminUserIdCache = {
        email,
        value,
        expiresAt: Date.now() + (value ? ADMIN_USER_ID_CACHE_TTL_MS : ADMIN_USER_ID_MISS_TTL_MS),
      };
      return value;
    })
    .catch((error) => {
      adminUserIdCache = null;
      throw error;
    });

  adminUserIdCache = { email, value: null, expiresAt: 0, promise };
  return promise;
}

export async function getAdminParticipants(supabase: SupabaseClient, adminUserId: string) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, active, display_order, created_at")
    .eq("user_id", adminUserId)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as ParticipantRow[];
}

export async function findParticipantByRunnerName(supabase: SupabaseClient, adminUserId: string, runnerName: string) {
  const normalized = normalizeRunnerName(runnerName);
  if (!normalized) return null;

  const participants = await getAdminParticipants(supabase, adminUserId);
  return participants.find((participant) => normalizeRunnerName(participant.name) === normalized) || null;
}
