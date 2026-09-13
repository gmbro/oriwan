import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_HELLO_2027_PROFILE_IMAGE_URL,
  resolveHello2027ProfileImageUrl,
} from "../lib/hello-2027-profile-image.ts";

test("저장된 프로필 사진은 기본 이미지보다 우선한다", () => {
  assert.equal(
    resolveHello2027ProfileImageUrl(" /api/hello-2027/profile-image/member?v=2 "),
    "/api/hello-2027/profile-image/member?v=2",
  );
  assert.equal(
    resolveHello2027ProfileImageUrl("https://example.supabase.co/storage/profile.webp"),
    "https://example.supabase.co/storage/profile.webp",
  );
});

test("저장된 사진이 없으면 첨부된 기본 프로필 이미지를 사용한다", () => {
  assert.equal(resolveHello2027ProfileImageUrl(null), DEFAULT_HELLO_2027_PROFILE_IMAGE_URL);
  assert.equal(resolveHello2027ProfileImageUrl(undefined), DEFAULT_HELLO_2027_PROFILE_IMAGE_URL);
  assert.equal(resolveHello2027ProfileImageUrl("   "), DEFAULT_HELLO_2027_PROFILE_IMAGE_URL);
  assert.equal(
    DEFAULT_HELLO_2027_PROFILE_IMAGE_URL,
    "/images/poc/hello-2027/default-profile-avatar.webp",
  );
});

test("배포 파일에 실제 기본 프로필 이미지가 포함되어 있다", async () => {
  const asset = await readFile(new URL(`../public${DEFAULT_HELLO_2027_PROFILE_IMAGE_URL}`, import.meta.url));
  assert.equal(asset.toString("ascii", 0, 4), "RIFF");
  assert.equal(asset.toString("ascii", 8, 12), "WEBP");
  assert.ok(asset.byteLength > 100);
});
