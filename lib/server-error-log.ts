import "server-only";

const SAFE_ERROR_CODE_PATTERN = /[^A-Za-z0-9_.:-]/g;

function safeErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";

  const record = error as { code?: unknown; status?: unknown; name?: unknown };
  const value = record.code ?? record.status ?? record.name;
  if (typeof value !== "string" && typeof value !== "number") return "unknown";

  return String(value).replace(SAFE_ERROR_CODE_PATTERN, "").slice(0, 64) || "unknown";
}

/** Logs an operational label and a bounded code without serializing user or row data. */
export function logServerFailure(label: string, error: unknown) {
  console.error(`${label} failed (code: ${safeErrorCode(error)}).`);
}
