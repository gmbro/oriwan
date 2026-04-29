"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CertifyPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [missionGuide, setMissionGuide] = useState("러닝 인증 사진을 촬영하세요");

  // 미션 가이드 로드
  useEffect(() => {
    const missionStr = sessionStorage.getItem("oriwan_mission");
    if (missionStr) {
      const m = JSON.parse(missionStr);
      setMissionGuide(m.guide || "러닝 인증 사진을 촬영하세요");
    }
  }, []);

  // 오리 로고 프리로드
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/oriwan-logo-v2.png";
    img.onload = () => { logoRef.current = img; };
  }, []);

  // 카메라 시작 (후면 = 거울 셀카)
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      } catch {
        setCameraError("카메라에 접근할 수 없습니다.\n브라우저 설정에서 카메라 권한을 허용해주세요.");
      }
    };
    startCamera();
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // 촬영 + 워터마크 합성
  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. 사진 그리기
    ctx.drawImage(video, 0, 0);

    // 2. 오리 로고 워터마크 (우하단, 반투명)
    if (logoRef.current) {
      const logoSize = Math.min(w, h) * 0.12; // 화면의 12%
      const margin = logoSize * 0.4;
      ctx.globalAlpha = 0.25; // 희미하게
      ctx.drawImage(logoRef.current, w - logoSize - margin, h - logoSize - margin, logoSize, logoSize);
      ctx.globalAlpha = 1.0;
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhoto(dataUrl);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // 다시 촬영
  const retake = useCallback(async () => {
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("카메라를 다시 시작할 수 없습니다.");
    }
  }, []);

  // 인증 완료
  const handleComplete = useCallback(async () => {
    if (!photo || uploading) return;
    setUploading(true);
    try {
      // 1. 사진 업로드
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo }),
      });
      const uploadData = await uploadRes.json();

      // 2. Strava 러닝 데이터
      const runStr = sessionStorage.getItem("oriwan_run_data");
      const run = runStr ? JSON.parse(runStr) : {};

      // 3. DB 저장 (Strava 데이터 + 사진 경로)
      await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance: run.distance || null,
          moving_time: run.moving_time || null,
          average_cadence: run.average_cadence || null,
          average_heartrate: run.average_heartrate || null,
          strava_activity_id: run.id || null,
          photo_url: uploadData.path || null,
          certified: true,
        }),
      });

      router.push("/success");
    } catch {
      alert("인증 저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }, [photo, uploading, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-white/80 text-sm whitespace-pre-line mb-4">{cameraError}</p>
              <button onClick={() => router.back()} className="text-oriwan-primary text-sm font-semibold">뒤로 가기</button>
            </div>
          </div>
        ) : photo ? (
          <img src={photo} alt="인증 사진" className="w-full h-full object-cover" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <p className="text-white/60 text-sm animate-pulse">카메라 준비 중...</p>
              </div>
            )}
          </>
        )}

        {/* 미션 가이드 오버레이 */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-6 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
          <p className="text-white text-center text-[13px] font-medium leading-relaxed px-4">
            {photo ? "사진을 확인해주세요" : missionGuide}
          </p>
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-black px-6 py-6 pb-10">
        {photo ? (
          <div className="flex gap-3">
            <button onClick={retake} disabled={uploading} className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-semibold text-sm">다시 촬영</button>
            <button onClick={handleComplete} disabled={uploading} className="flex-1 py-3.5 rounded-2xl bg-oriwan-primary text-white font-bold text-sm shadow-lg shadow-oriwan-primary/30">
              {uploading ? "저장 중..." : "인증 완료 ✓"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button onClick={capture} disabled={!cameraReady} className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/20 active:bg-white/40 transition-all flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
