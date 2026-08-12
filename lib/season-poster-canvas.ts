import {
  formatSeasonDuration,
  selectRecentSeasonBadges,
  type SeasonMemberReport,
} from "@/lib/season-report";

const FONT_STACK = '"Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif';
const INK = "#0f172a";
const MUTED = "#94a3b8";
const SKY = "#38bdf8";

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function setFont(context: CanvasRenderingContext2D, size: number, weight = 800) {
  context.font = `${weight} ${size}px ${FONT_STACK}`;
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number, startSize: number, minSize = 24) {
  let size = startSize;
  setFont(context, size, 900);
  while (size > minSize && context.measureText(value).width > maxWidth) {
    size -= 2;
    setFont(context, size, 900);
  }
  return size;
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 800,
  align: CanvasTextAlign = "left"
) {
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = "alphabetic";
  setFont(context, size, weight);
  context.fillText(value, x, y);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  size: number,
  color: string
) {
  setFont(context, size, 800);
  const words = value.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      return;
    }
    if (currentLine) lines.push(currentLine);
    currentLine = word;
  });
  if (currentLine) lines.push(currentLine);

  lines.slice(0, maxLines).forEach((line, index) => {
    const isTruncated = index === maxLines - 1 && lines.length > maxLines;
    drawText(context, isTruncated ? `${line}…` : line, x, y + index * lineHeight, size, color, 800);
  });
}

async function loadSvg(svgMarkup: string) {
  if (!svgMarkup) return null;
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function drawStat(
  context: CanvasRenderingContext2D,
  x: number,
  width: number,
  label: string,
  value: string
) {
  drawText(context, label, x, 354, 20, MUTED, 800);
  const size = fitText(context, value, width, 42, 28);
  drawText(context, value, x, 412, size, INK, 900);
}

function drawMonthlyDistanceChart(context: CanvasRenderingContext2D, member: Pick<SeasonMemberReport, "months">) {
  const left = 72;
  const right = 1008;
  const top = 548;
  const bottom = 914;
  const chartHeight = bottom - top;
  const gap = 38;
  const barWidth = (right - left - gap * 3) / 4;
  const maxDistance = Math.max(...member.months.map((month) => month.distanceKm), 1);

  [0, 0.5, 1].forEach((ratio) => {
    const y = bottom - chartHeight * ratio;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 2;
    context.stroke();
  });

  member.months.forEach((month, index) => {
    const height = Math.max((month.distanceKm / maxDistance) * chartHeight, 10);
    const x = left + index * (barWidth + gap);
    const y = bottom - height;
    fillRoundedRect(context, x, y, barWidth, height, 12, SKY);
    drawText(context, month.distanceKm.toFixed(0), x + barWidth / 2, y - 12, 19, "#475569", 900, "center");
    drawText(context, month.label, x + barWidth / 2, bottom + 34, 18, MUTED, 900, "center");
  });
}

export async function renderSeasonPosterBlob(
  member: Pick<SeasonMemberReport, "name" | "cheerMessage" | "certifiedDays" | "durationSeconds" | "months" | "badges">,
  characterSvgMarkup = "",
) {
  const width = 1080;
  const height = 1080;
  const outputScale = 2;
  const margin = 72;
  const canvas = document.createElement("canvas");
  canvas.width = width * outputScale;
  canvas.height = height * outputScale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 만들 수 없는 브라우저입니다.");
  context.scale(outputScale, outputScale);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  drawText(context, "@thosewhothrowthemselvesin", margin, 70, 20, "#64748b", 900);
  drawText(context, "2026.05.05 — 08.12", width - margin, 70, 18, MUTED, 800, "right");

  const character = await loadSvg(characterSvgMarkup);
  const characterSize = 190;
  const characterX = width - margin - characterSize;
  const characterY = 98;
  const bubbleX = 432;
  const bubbleY = 118;
  const bubbleWidth = 338;
  const bubbleHeight = 112;
  fillRoundedRect(context, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 28, "#f0f9ff");
  context.fillStyle = "#f0f9ff";
  context.beginPath();
  context.moveTo(bubbleX + bubbleWidth - 2, bubbleY + 42);
  context.lineTo(bubbleX + bubbleWidth + 24, bubbleY + 56);
  context.lineTo(bubbleX + bubbleWidth - 2, bubbleY + 72);
  context.closePath();
  context.fill();
  drawWrappedText(context, member.cheerMessage, bubbleX + 24, bubbleY + 38, bubbleWidth - 48, 28, 3, 18, "#0c4a6e");
  if (character) context.drawImage(character, characterX, characterY, characterSize, characterSize);

  const nameSize = fitText(context, member.name, 320, 82, 48);
  drawText(context, member.name, margin, 180, nameSize, INK, 900);

  context.beginPath();
  context.moveTo(margin, 316);
  context.lineTo(width - margin, 316);
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 2;
  context.stroke();

  const statGap = 48;
  const statWidth = (width - margin * 2 - statGap) / 2;
  drawStat(context, margin, statWidth, "총 인증일", `${member.certifiedDays}일`);
  drawStat(context, margin + statWidth + statGap, statWidth, "누적 시간", formatSeasonDuration(member.durationSeconds));

  drawText(context, "MONTH DISTANCE", margin, 502, 26, INK, 900);
  drawText(context, "단위 km", width - margin, 502, 16, MUTED, 800, "right");
  drawMonthlyDistanceChart(context, member);

  drawText(context, "PERSONAL TITLE", margin, 980, 18, "#64748b", 900);
  drawText(context, "획득일 기준 최신 4개", width - margin, 980, 15, MUTED, 800, "right");
  const recentBadges = selectRecentSeasonBadges(member.badges, 4);
  const badgeGap = 12;
  const badgeWidth = (width - margin * 2 - badgeGap * 3) / 4;
  recentBadges.forEach((badge, index) => {
    const x = margin + index * (badgeWidth + badgeGap);
    const isHundredDay = badge.key === "hundred-day-streak";
    fillRoundedRect(context, x, 994, badgeWidth, 54, 16, isHundredDay ? "#e0f2fe" : "#f8fafc");
    const label = `${isHundredDay ? "👑 " : ""}${badge.label}`;
    const labelSize = fitText(context, label, badgeWidth - 20, 16, 11);
    drawText(context, label, x + badgeWidth / 2, 1028, labelSize, isHundredDay ? "#1e3a8a" : "#475569", 900, "center");
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("포스터 이미지 생성에 실패했습니다.")), "image/png", 1);
  });
}
