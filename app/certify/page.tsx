"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CertifyPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // 카메라 시작
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

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 촬영
  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhoto(dataUrl);

    // 카메라 끄기
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("카메라를 다시 시작할 수 없습니다.");
    }
  }, []);

  // 인증 완료 (업로드 + DB 저장)
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

      // 2. 운동 데이터 가져오기
      const workoutStr = sessionStorage.getItem("oriwan_workout");
      const workout = workoutStr ? JSON.parse(workoutStr) : { duration: 0 };

      // 3. 기록 저장
      await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: workout.duration,
          photo_url: uploadData.url || null,
        }),
      });

      // 4. 성공 페이지로 이동
      sessionStorage.setItem("oriwan_certified", "true");
      router.push("/success");
    } catch {
      alert("인증 저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }, [photo, uploading, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* 카메라 뷰 */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-white/80 text-sm whitespace-pre-line mb-4">{cameraError}</p>
              <button onClick={() => router.back()} className="text-oriwan-primary text-sm font-semibold">
                뒤로 가기
              </button>
            </div>
          </div>
        ) : photo ? (
          /* 촬영된 사진 미리보기 */
          <img src={photo} alt="인증 사진" className="w-full h-full object-cover" />
        ) : (
          /* 카메라 라이브 뷰 */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <p className="text-white/60 text-sm animate-pulse">카메라 준비 중...</p>
              </div>
            )}
          </>
        )}

        {/* 상단 안내 */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <p className="text-white text-center text-sm font-medium">
            {photo ? "사진을 확인해주세요" : "러닝 인증 사진을 촬영하세요"}
          </p>
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-black px-6 py-6 pb-10 safe-bottom">
        {photo ? (
          <div className="flex gap-3">
            <button
              onClick={retake}
              disabled={uploading}
              className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-semibold text-sm"
            >
              다시 촬영
            </button>
            <button
              onClick={handleComplete}
              disabled={uploading}
              className="flex-1 py-3.5 rounded-2xl bg-oriwan-primary text-white font-bold text-sm shadow-lg shadow-oriwan-primary/30"
            >
              {uploading ? "저장 중..." : "인증 완료 ✓"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={capture}
              disabled={!cameraReady}
              className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/20 active:bg-white/40 transition-all flex items-center justify-center"
            >
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
