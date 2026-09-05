import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";
import {
  MAX_HELLO_2027_PROFILE_INTRODUCTIONS,
  MAX_PROFILE_INTRO_LENGTH,
  MAX_PROFILE_INTRO_NAME_LENGTH,
  MAX_PROFILE_INTRO_TITLE_LENGTH,
} from "@/lib/hello-2027-profile-introduction-contract";

export {
  MAX_HELLO_2027_PROFILE_INTRODUCTIONS,
  MAX_PROFILE_INTRO_LENGTH,
  MAX_PROFILE_INTRO_NAME_LENGTH,
  MAX_PROFILE_INTRO_TITLE_LENGTH,
} from "@/lib/hello-2027-profile-introduction-contract";

export const HELLO_2027_SEASON_KEY = FOURTH_SEASON_KEY;
export const MAX_HELLO_2027_ENCOURAGEMENTS = 56;
export const MAX_HELLO_2027_BANNERS = 10;
export const MAX_ENCOURAGEMENT_LENGTH = 120;
export const MAX_BANNER_OWNER_LENGTH = 20;
export const MAX_BANNER_TITLE_LENGTH = 40;
export const MAX_BANNER_DESCRIPTION_LENGTH = 100;
export const MAX_BANNER_ALT_LENGTH = 80;
export const MAX_CONTENT_URL_LENGTH = 2_048;

export type Hello2027ContentType = "encouragement" | "banner";
export type Hello2027MobileFocus = "left" | "center" | "right";

export type PublicHello2027Encouragement = {
  id: string;
  message: string;
  displayOrder: number;
};

export type PublicHello2027Banner = {
  id: string;
  ownerName: string;
  title: string;
  description: string;
  alt: string;
  imageSrc: string;
  mobileFocus: Hello2027MobileFocus;
  displayOrder: number;
};

export type PublicHello2027ProfileIntroduction = {
  participantId: string;
  name: string;
  title: string;
  body: string;
};

type ContentSource = "supabase" | "fallback";

export type PublicHello2027Content = {
  encouragements: PublicHello2027Encouragement[];
  banners: PublicHello2027Banner[];
  profileIntroductions: PublicHello2027ProfileIntroduction[];
  source: {
    encouragements: ContentSource;
    banners: ContentSource;
    profileIntroductions: ContentSource;
  };
};

type EncouragementRow = {
  id: string;
  message: string;
  display_order: number;
};

type BannerRow = {
  id: string;
  owner_name: string;
  title: string;
  description: string;
  alt_text: string;
  image_url: string;
  mobile_focus: Hello2027MobileFocus;
  display_order: number;
};

type ProfileRow = {
  participant_id: string;
  title: string;
  body: string;
};

const UNSAFE_INVISIBLE_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const URL_UNSAFE_PATTERN = /[\u0000-\u0020\u007f-\u009f\\\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

function logPublicContentFailure(area: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "unknown")
    : "unknown";
  console.error(`Hello 2027 public ${area} fallback (code: ${code}).`);
}

export function normalizeContentText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || UNSAFE_INVISIBLE_PATTERN.test(value)) return null;
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function isSafeHello2027ImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_CONTENT_URL_LENGTH || URL_UNSAFE_PATTERN.test(normalized)) {
    return false;
  }

  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) return false;
    try {
      let pathname = new URL(normalized, "https://twtt.invalid").pathname;
      for (let index = 0; index < 3; index += 1) {
        const decoded = decodeURIComponent(pathname);
        if (decoded === pathname) break;
        pathname = decoded;
      }
      return !pathname.includes("\\")
        && !pathname.split("/").some((segment) => segment === "." || segment === "..");
    } catch {
      return false;
    }
  }

  try {
    const url = new URL(normalized);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    const allowedOrigin = new URL(supabaseUrl).origin;
    return url.protocol === "https:"
      && url.origin === allowedOrigin
      && url.pathname.startsWith("/storage/v1/object/public/")
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function isHello2027MobileFocus(value: unknown): value is Hello2027MobileFocus {
  return value === "left" || value === "center" || value === "right";
}

export function isHello2027ContentType(value: unknown): value is Hello2027ContentType {
  return value === "encouragement" || value === "banner";
}

async function loadEncouragements(supabase: SupabaseClient, adminUserId: string) {
  const { data, error } = await supabase
    .from("hello_2027_encouragements")
    .select("id, message, display_order")
    .eq("user_id", adminUserId)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_HELLO_2027_ENCOURAGEMENTS);

  if (error) throw error;

  return ((data || []) as EncouragementRow[]).flatMap((row) => {
    const message = normalizeContentText(row.message, MAX_ENCOURAGEMENT_LENGTH);
    if (!message) return [];
    return [{
      id: row.id,
      message,
      displayOrder: Number.isInteger(row.display_order) ? row.display_order : 0,
    }];
  });
}

async function loadBanners(supabase: SupabaseClient, adminUserId: string) {
  const { data, error } = await supabase
    .from("hello_2027_banners")
    .select("id, owner_name, title, description, alt_text, image_url, mobile_focus, display_order")
    .eq("user_id", adminUserId)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_HELLO_2027_BANNERS);

  if (error) throw error;

  return ((data || []) as BannerRow[]).flatMap((row) => {
    const ownerName = normalizeContentText(row.owner_name, MAX_BANNER_OWNER_LENGTH);
    const title = normalizeContentText(row.title, MAX_BANNER_TITLE_LENGTH);
    const description = normalizeContentText(row.description, MAX_BANNER_DESCRIPTION_LENGTH);
    const alt = normalizeContentText(row.alt_text, MAX_BANNER_ALT_LENGTH);
    if (!ownerName || !title || !description || !alt || !isSafeHello2027ImageUrl(row.image_url)) return [];
    return [{
      id: row.id,
      ownerName,
      title,
      description,
      alt,
      imageSrc: row.image_url.trim(),
      mobileFocus: isHello2027MobileFocus(row.mobile_focus) ? row.mobile_focus : "center",
      displayOrder: Number.isInteger(row.display_order) ? row.display_order : 0,
    }];
  });
}

async function loadProfileIntroductions(supabase: SupabaseClient, adminUserId: string) {
  const { data, error } = await supabase
    .from("hello_2027_profile_introductions")
    .select("participant_id, title, body")
    .eq("user_id", adminUserId)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(MAX_HELLO_2027_PROFILE_INTRODUCTIONS);

  if (error) throw error;

  const rows = (data || []) as ProfileRow[];
  if (rows.length === 0) return [];

  // An introduction must stop being public when its participant is disabled. The current
  // participant name avoids publishing a stale name snapshot after an operator renames them;
  // legacy nickname/profile text is never queried.
  const { data: activeParticipants, error: participantError } = await supabase
    .from("participants")
    .select("id, name")
    .eq("user_id", adminUserId)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .eq("active", true)
    .in("id", rows.map((row) => row.participant_id));
  if (participantError) throw participantError;
  const activeParticipantNames = new Map(
    (activeParticipants || []).map((row) => [
      row.id,
      normalizeContentText(row.name, MAX_PROFILE_INTRO_NAME_LENGTH),
    ]),
  );

  return rows.flatMap((row) => {
    const name = activeParticipantNames.get(row.participant_id);
    const title = normalizeContentText(row.title, MAX_PROFILE_INTRO_TITLE_LENGTH);
    const body = normalizeContentText(row.body, MAX_PROFILE_INTRO_LENGTH);
    if (!name || !title || !body) return [];
    return [{
      participantId: row.participant_id,
      name,
      title,
      body,
    }];
  });
}

export async function getPublicHello2027Content(): Promise<PublicHello2027Content> {
  const fallback = {
    encouragements: [] as PublicHello2027Encouragement[],
    banners: [] as PublicHello2027Banner[],
    profileIntroductions: [] as PublicHello2027ProfileIntroduction[],
  };
  let supabase: SupabaseClient | null = null;
  try {
    supabase = getServiceClient();
  } catch (error) {
    logPublicContentFailure("service configuration", error);
  }
  if (!supabase) {
    return {
      ...fallback,
      source: {
        encouragements: "fallback",
        banners: "fallback",
        profileIntroductions: "fallback",
      },
    };
  }

  let adminUserId: string | null = null;
  try {
    adminUserId = await findAdminUserId(supabase);
  } catch (error) {
    logPublicContentFailure("admin lookup", error);
  }

  if (!adminUserId) {
    return {
      ...fallback,
      source: {
        encouragements: "fallback",
        banners: "fallback",
        profileIntroductions: "fallback",
      },
    };
  }

  const [encouragementResult, bannerResult, profileResult] = await Promise.allSettled([
    loadEncouragements(supabase, adminUserId),
    loadBanners(supabase, adminUserId),
    loadProfileIntroductions(supabase, adminUserId),
  ]);

  if (encouragementResult.status === "rejected") {
    logPublicContentFailure("encouragements", encouragementResult.reason);
  }
  if (bannerResult.status === "rejected") {
    logPublicContentFailure("banners", bannerResult.reason);
  }
  if (profileResult.status === "rejected") {
    logPublicContentFailure("profile introductions", profileResult.reason);
  }

  return {
    encouragements: encouragementResult.status === "fulfilled"
      ? encouragementResult.value
      : fallback.encouragements,
    banners: bannerResult.status === "fulfilled"
      ? bannerResult.value
      : fallback.banners,
    profileIntroductions: profileResult.status === "fulfilled"
      ? profileResult.value
      : fallback.profileIntroductions,
    source: {
      encouragements: encouragementResult.status === "fulfilled" ? "supabase" : "fallback",
      banners: bannerResult.status === "fulfilled" ? "supabase" : "fallback",
      profileIntroductions: profileResult.status === "fulfilled" ? "supabase" : "fallback",
    },
  };
}
