import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/upload
 * 인증 사진을 Supabase Storage(Private)에 업로드합니다.
 * → Signed URL(1시간 유효)을 반환합니다.
 */
export async function POST(request: NextRequest) {
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "이미지가 필요합니다." }, { status: 400 });
    }

    // base64 → Buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // 파일명: user_id/날짜_시간.jpg
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const filePath = `certifications/${user.id}/${dateStr}_${timeStr}.jpg`;

    // Service Role 클라이언트로 업로드 (RLS 우회)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error: uploadError } = await supabaseAdmin.storage
      .from("photos")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
    }

    // Private 버킷 → Signed URL 생성 (1시간 유효, DB에는 경로만 저장)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("photos")
      .createSignedUrl(filePath, 3600);

    if (signError) {
      console.error("Signed URL error:", signError);
    }

    return NextResponse.json({
      url: signedData?.signedUrl || "",
      path: filePath, // DB에 저장할 경로 (영구)
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "업로드 중 오류" }, { status: 500 });
  }
}
