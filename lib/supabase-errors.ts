export function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "PGRST205" ||
    Boolean(maybeError.message?.includes("Could not find the table"))
  );
}

export function missingSchemaResponse(message = "Supabase 스키마가 아직 적용되지 않았습니다.") {
  return {
    error: message,
    setup_required: true,
    setup_file: "docs/supabase-schema.sql",
  };
}
