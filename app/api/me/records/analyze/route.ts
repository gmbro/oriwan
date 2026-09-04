import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "OCR 인증 등록은 운영자 어드민에서만 사용할 수 있습니다.",
  }, { status: 403 });
}
