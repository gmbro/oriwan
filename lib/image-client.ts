"use client";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export async function imageFileToOptimizedDataUrl(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale >= 1 && file.size <= 900_000) return readFileAsDataUrl(file);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) return readFileAsDataUrl(file);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지를 최적화하지 못했습니다."));
            return;
          }
          const optimized = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
          readFileAsDataUrl(optimized).then(resolve, reject);
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
