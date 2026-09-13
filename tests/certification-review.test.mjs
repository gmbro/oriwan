import assert from "node:assert/strict";
import test from "node:test";
import { readCertificationReview, reviewCertification, visibleCertificationNotes, wasUploadedBeforeDeadline, writeCertificationReview } from "../lib/certification-review.ts";

const base = { recordDate: "2026-10-08", imageUrl: "private-image", review: { version: 1, uploadedAt: "2026-10-07T22:59:59.999Z" }, approval: { confirmed: true, evidenceConfirmed: true, captureDate: "2026-10-08", captureTime: "07:59" }, adminId: "admin", now: "2026-10-08T01:00:00Z" };
test("한국시간 당일 00:00부터 07:59:59.999까지 접수, 08:00과 전날·다음날은 제외", () => {
  for (const time of ["2026-10-07T15:00:00Z", "2026-10-07T22:59:59.999Z", "2026-10-08T07:30:00+09:00"]) assert.equal(wasUploadedBeforeDeadline(base.recordDate, time), true);
  for (const time of ["2026-10-07T14:59:59Z", "2026-10-07T23:00:00Z", "2026-10-08T22:00:00Z", "invalid", null]) assert.equal(wasUploadedBeforeDeadline(base.recordDate, time), false);
});
test("정시 업로드도 운동 시각 증거·관리자 확인과 이미지가 있어야 승인", () => {
  assert.equal(reviewCertification(base).review.basis, "screenshot");
  for (const patch of [{ approval: { confirmed: true } }, { approval: {} }, { imageUrl: null }, { recordDate: "2026-10-09" }, { recordDate: "2026-02-30" }, { recordDate: "bad" }]) assert.equal(reviewCertification({ ...base, ...patch }).ok, false);
});
test("늦은 제출과 기존 기록은 같은 운동일의 8시 이전 캡처를 관리자가 확인하면 승인", () => {
  for (const review of [null, { version: 1, uploadedAt: "2026-10-07T23:00:00Z" }]) {
    const input = { ...base, review, approval: { confirmed: true, evidenceConfirmed: true, captureDate: base.recordDate, captureTime: "07:59" } };
    const result = reviewCertification(input);
    assert.equal(result.ok, true); assert.equal(result.review.basis, "screenshot"); assert.equal(result.review.approvedBy, "admin");
    for (const patch of [{ captureTime: "08:00" }, { captureTime: "19:00" }, { captureTime: "7:99" }, { captureTime: "" }, { captureDate: "2026-10-07" }, { evidenceConfirmed: false }]) assert.equal(reviewCertification({ ...input, approval: { ...input.approval, ...patch } }).ok, false);
  }
});
test("검수 메모는 중복되지 않고 서버 업로드 시각·승인 이력을 유지", () => {
  const first = writeCertificationReview("사용자 메모", base.review);
  const next = writeCertificationReview(first, reviewCertification(base).review);
  assert.equal(visibleCertificationNotes(next), "사용자 메모");
  assert.equal(next.split("[TWTT_REVIEW_V1]").length, 2);
  assert.equal(readCertificationReview(next).uploadedAt, base.review.uploadedAt);
  assert.equal(readCertificationReview("기존 메모"), null);
  assert.equal(readCertificationReview("\n[TWTT_REVIEW_V1]{broken"), null);
});

 test("다음날·한 달 뒤 제출도 같은 운동일의 8시 이전 증거를 확인하면 승인", () => {
   for (const uploadedAt of ["2026-10-09T12:00:00+09:00", "2026-11-08T23:30:00+09:00"]) {
     const result = reviewCertification({ ...base, review: { version: 1, uploadedAt, ocrDate: base.recordDate, ocrTime: "06:15" }, now: "2026-11-09T00:00:00Z" });
     assert.equal(result.ok, true);
     assert.equal(result.review.basis, "screenshot");
     assert.equal(result.review.ocrTime, "06:15");
   }
 });
 test("OCR의 8시 이전 값만으로 최종 승인되지 않음", () => {
   const result = reviewCertification({ ...base, review: { version: 1, uploadedAt: base.review.uploadedAt, ocrDate: base.recordDate, ocrTime: "06:15" }, approval: {} });
   assert.equal(result.ok, false);
 });
