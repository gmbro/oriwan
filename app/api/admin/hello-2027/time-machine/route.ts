import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
function unavailable() {
  return NextResponse.json({ error: "목표는 작성한 본인만 확인하고 수정할 수 있어요." }, { status: 410, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export const GET = unavailable;
export const DELETE = unavailable;
