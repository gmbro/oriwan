export const GEMINI_OCR_MODEL = process.env.GEMINI_OCR_MODEL || "gemini-2.5-flash";

export function getGeminiErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("NOT_FOUND") || message.includes("404") || message.includes("not found")) {
    return "OCR 모델 연결에 실패했어요. 관리자에게 Gemini 모델 설정 확인을 요청해주세요.";
  }
  if (message.includes("API key") || message.includes("GEMINI_API_KEY")) {
    return "OCR 서버 키가 설정되지 않았어요. 관리자에게 환경변수 확인을 요청해주세요.";
  }
  return "이미지 텍스트를 읽지 못했어요. 화면이 선명한지 확인해주세요.";
}
