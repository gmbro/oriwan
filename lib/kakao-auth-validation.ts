export const KAKAO_PROFILE_SCOPES = "profile_nickname,profile_image";

const OAUTH_CODE_MAX_LENGTH = 2_048;
const OAUTH_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SAFE_ERROR_CODE_CHARACTERS = /[^A-Za-z0-9_.:-]/g;

export type KakaoCallbackError =
  | "auth_cancelled"
  | "auth_expired"
  | "auth_failed"
  | "auth_provider_failed"
  | "auth_unavailable";

type ProviderFailure = {
  userError: KakaoCallbackError;
  logCode: string;
};

function boundedErrorCode(value: string | null | undefined) {
  if (!value) return "unknown";
  return value.replace(SAFE_ERROR_CODE_CHARACTERS, "").slice(0, 64) || "unknown";
}

/** OAuth authorization codes are opaque. Only multiplicity, size, and controls are rejected. */
export function getSingleOAuthCode(searchParams: URLSearchParams) {
  const values = searchParams.getAll("code");
  if (values.length !== 1) return null;

  const code = values[0];
  if (!code || code.length > OAUTH_CODE_MAX_LENGTH || OAUTH_CONTROL_CHARACTERS.test(code)) {
    return null;
  }

  return code;
}

/** Maps provider failures to bounded product states without exposing descriptions or tokens. */
export function getOAuthProviderFailure(searchParams: URLSearchParams): ProviderFailure | null {
  const errors = searchParams.getAll("error");
  const errorCodes = searchParams.getAll("error_code");
  if (errors.length === 0 && errorCodes.length === 0) return null;

  if (errors.length > 1 || errorCodes.length > 1) {
    return { userError: "auth_provider_failed", logCode: "duplicate_provider_error" };
  }

  const logCode = boundedErrorCode(errorCodes[0] || errors[0]);
  const normalizedError = boundedErrorCode(errors[0]).toLowerCase();

  if (normalizedError === "access_denied" || normalizedError === "consent_required") {
    return { userError: "auth_cancelled", logCode };
  }

  if (
    normalizedError === "temporarily_unavailable"
    || normalizedError === "server_error"
  ) {
    return { userError: "auth_unavailable", logCode };
  }

  return { userError: "auth_provider_failed", logCode };
}

export function getOAuthExchangeFailure(error: unknown): ProviderFailure {
  const rawCode = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  const logCode = boundedErrorCode(
    typeof rawCode === "string" || typeof rawCode === "number" ? String(rawCode) : undefined,
  );

  if (
    logCode === "bad_code_verifier"
    || logCode === "flow_state_expired"
    || logCode === "flow_state_not_found"
    || logCode === "invalid_flow_state"
  ) {
    return { userError: "auth_expired", logCode };
  }

  return { userError: "auth_failed", logCode };
}
