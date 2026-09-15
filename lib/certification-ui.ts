const KST_OFFSET = 9 * 60 * 60 * 1000;
export function certificationDay(now = Date.now()) {
  return new Date(now + KST_OFFSET).toISOString().slice(0, 10);
}
export function untilNextCertificationDay(now = Date.now()) {
  const shifted = new Date(now + KST_OFFSET);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - KST_OFFSET - now;
}
export function hasCertification(records: {date: string; status: string}[], day: string) {
  return records.some(record => record.date === day && record.status === "certified");
}
export function certificationFailure(status: number, detail = "") {
  if(status===401) return "로그인이 만료됐어요. 다시 로그인해주세요.";
  if(status===409) return "해당 날짜는 이미 기록되어 있어요. 캘린더를 확인해주세요.";
  if(status===429) return "요청이 많아 잠시 후 다시 시도해주세요.";
  if(status>=500) return "인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.";
  if(status===403) return "인증 권한 또는 활동 기간을 확인해주세요.";
  if(/용량|20MB|3MB|JPG|PNG|WebP/.test(detail)) return "20MB 이하의 JPG·PNG·WebP 캡처본을 선택해주세요.";
  if(/날짜|거리|시간|인식|사진/.test(detail)) return "날짜·거리·시간이 잘 보이는 캡처본을 다시 올려주세요.";
  return "인증을 완료하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.";
}
