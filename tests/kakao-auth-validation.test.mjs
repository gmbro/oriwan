import assert from "node:assert/strict";
import test from "node:test";

import {
  KAKAO_PROFILE_SCOPES,
  getOAuthExchangeFailure,
  getOAuthProviderFailure,
  getSingleOAuthCode,
} from "../lib/kakao-auth-validation.ts";

test("Kakao 권한은 닉네임과 이미지만 문서화된 쉼표 형식으로 요청한다", () => {
  assert.equal(KAKAO_PROFILE_SCOPES, "profile_nickname,profile_image");
  assert.equal(KAKAO_PROFILE_SCOPES.includes("account_email"), false);
});

test("OAuth code는 UUID와 base64 계열 문자를 포함한 opaque 값으로 처리한다", () => {
  for (const code of [
    "5a08b719-2bf9-4e4e-b70e-ce2a55a52cbb",
    "opaque+code/with=padding",
    "A_b.c~d-e",
  ]) {
    assert.equal(getSingleOAuthCode(new URLSearchParams({ code })), code);
  }
});

test("OAuth code의 누락·중복·제어문자·과대 입력을 거부한다", () => {
  assert.equal(getSingleOAuthCode(new URLSearchParams()), null);
  assert.equal(getSingleOAuthCode(new URLSearchParams("code=first&code=second")), null);
  assert.equal(getSingleOAuthCode(new URLSearchParams({ code: "bad\ncode" })), null);
  assert.equal(getSingleOAuthCode(new URLSearchParams({ code: "x".repeat(2_049) })), null);
});

test("공급자 취소와 장애는 안전한 화면 코드로만 구분한다", () => {
  assert.deepEqual(
    getOAuthProviderFailure(new URLSearchParams({ error: "access_denied" })),
    { userError: "auth_cancelled", logCode: "access_denied" },
  );
  assert.deepEqual(
    getOAuthProviderFailure(new URLSearchParams({ error: "server_error", error_code: "KOE999" })),
    { userError: "auth_unavailable", logCode: "KOE999" },
  );
  assert.deepEqual(
    getOAuthProviderFailure(new URLSearchParams("error=a&error=b")),
    { userError: "auth_provider_failed", logCode: "duplicate_provider_error" },
  );
});

test("PKCE 만료 오류만 재시도 안내로 분류하고 설명·토큰은 전달하지 않는다", () => {
  assert.deepEqual(getOAuthExchangeFailure({ code: "flow_state_not_found" }), {
    userError: "auth_expired",
    logCode: "flow_state_not_found",
  });
  assert.deepEqual(getOAuthExchangeFailure({ code: "unexpected value", token: "secret" }), {
    userError: "auth_failed",
    logCode: "unexpectedvalue",
  });
});
