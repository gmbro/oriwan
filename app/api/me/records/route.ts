import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "인증 기록은 운영자가 어드민에서 등록하고 검수합니다.",
  }, { status: 403 });
}
