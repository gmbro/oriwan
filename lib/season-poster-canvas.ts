import type { SeasonMemberReport } from "@/lib/season-report";

export type SeasonPosterFormat = "story" | "feed";

const FONT_STACK = '"Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif';

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string
) {
  roundedRect(context, x, y, width, height, radius);
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

function drawThemeDecoration(context: CanvasRenderingContext2D, member: SeasonMemberReport, width: number, height: number) {
  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = member.theme.accent;
  context.lineWidth = 3;

  if (member.theme.key === "explorer" || member.theme.key === "long-run") {
    for (let index = 0; index < 7; index += 1) {
      context.beginPath();
      context.arc(width * 0.82, height * 0.12, 120 + index * 48, Math.PI * 0.65, Math.PI * 1.55);
      context.stroke();
    }
  } else if (member.theme.key === "recovery") {
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.moveTo(-40, 190 + index * 36);
      context.bezierCurveTo(width * 0.25, 120 + index * 42, width * 0.62, 280 + index * 20, width + 40, 180 + index * 40);
      context.stroke();
    }
  } else {
    for (let index = 0; index < 22; index += 1) {
      const x = (index * 193) % width;
      const y = (index * 317) % Math.round(height * 0.45);
      context.fillStyle = member.theme.accent;
      context.beginPath();
      context.arc(x, y, index % 3 === 0 ? 5 : 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
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

function drawStatCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  accent: string,
  compact: boolean
) {
  fillRoundedRect(context, x, y, width, height, compact ? 24 : 30, "rgba(255,255,255,0.09)");
  drawText(context, label, x + 24, y + (compact ? 30 : 38), compact ? 16 : 18, "rgba(255,255,255,0.48)", 800);
  const size = fitText(context, value, width - 48, compact ? 38 : 48, compact ? 24 : 28);
  drawText(context, value, x + 24, y + height - (compact ? 24 : 30), size, accent, 900);
}

function drawCalendar(
  context: CanvasRenderingContext2D,
  member: SeasonMemberReport,
  top: number,
  margin: number,
  compact: boolean
) {
  const usableWidth = 1080 - margin * 2;
  const columnGap = compact ? 16 : 20;
  const monthWidth = (usableWidth - columnGap * 3) / 4;
  const cellSize = compact ? 18 : 24;
  const cellGap = compact ? 4 : 5;
  const gridWidth = cellSize * 7 + cellGap * 6;
  const offsetX = (monthWidth - gridWidth) / 2;

  member.calendarMonths.forEach((month, monthIndex) => {
    const x = margin + monthIndex * (monthWidth + columnGap);
    drawText(context, month.label, x, top, compact ? 18 : 21, "rgba(255,255,255,0.68)", 900);
    const startY = top + (compact ? 18 : 24);
    month.cells.forEach((cell, index) => {
      const position = month.leadingBlankCount + index;
      const column = position % 7;
      const row = Math.floor(position / 7);
      const cellX = x + offsetX + column * (cellSize + cellGap);
      const cellY = startY + row * (cellSize + cellGap);
      const fill = cell.status === "certified"
        ? "#bef264"
        : cell.status === "recovery"
          ? "#7dd3fc"
          : "rgba(255,255,255,0.10)";
      fillRoundedRect(context, cellX, cellY, cellSize, cellSize, compact ? 4 : 6, fill);
      if (cell.badgeEarned) {
        context.fillStyle = "#fbbf24";
        context.beginPath();
        context.arc(cellX + cellSize - 2, cellY + 2, compact ? 2.5 : 3.5, 0, Math.PI * 2);
        context.fill();
      }
    });
  });
}

function drawWeeklyChart(
  context: CanvasRenderingContext2D,
  member: SeasonMemberReport,
  top: number,
  margin: number,
  compact: boolean
) {
  const chartHeight = compact ? 72 : 116;
  const gap = compact ? 7 : 9;
  const usableWidth = 1080 - margin * 2;
  const barWidth = (usableWidth - gap * (member.weeks.length - 1)) / member.weeks.length;
  const bestRate = Math.max(...member.weeks.map((week) => week.rate), 1);

  member.weeks.forEach((week, index) => {
    const height = Math.max((week.rate / 100) * chartHeight, 7);
    const x = margin + index * (barWidth + gap);
    const y = top + chartHeight - height;
    fillRoundedRect(context, x, y, barWidth, height, Math.min(barWidth / 2, 8), week.rate === bestRate ? member.theme.accent : "rgba(255,255,255,0.18)");
  });
  drawText(context, "1주", margin, top + chartHeight + (compact ? 22 : 27), compact ? 14 : 16, "rgba(255,255,255,0.42)", 800);
  drawText(context, `${member.weeks.length}주`, 1080 - margin, top + chartHeight + (compact ? 22 : 27), compact ? 14 : 16, "rgba(255,255,255,0.42)", 800, "right");
}

function drawMonthlyChart(
  context: CanvasRenderingContext2D,
  member: SeasonMemberReport,
  top: number,
  margin: number,
  compact: boolean
) {
  const gap = 22;
  const width = (1080 - margin * 2 - gap * 3) / 4;
  member.months.forEach((month, index) => {
    const x = margin + index * (width + gap);
    drawText(context, month.label, x, top, compact ? 16 : 18, "rgba(255,255,255,0.48)", 900);
    drawText(context, `${month.rate}%`, x + width, top, compact ? 20 : 24, "#ffffff", 900, "right");
    fillRoundedRect(context, x, top + (compact ? 14 : 19), width, compact ? 9 : 12, 8, "rgba(255,255,255,0.10)");
    fillRoundedRect(context, x, top + (compact ? 14 : 19), width * (month.rate / 100), compact ? 9 : 12, 8, member.theme.accent);
  });
}

export async function renderSeasonPosterBlob(
  member: SeasonMemberReport,
  format: SeasonPosterFormat,
  characterSvgMarkup = ""
) {
  const compact = format === "feed";
  const width = 1080;
  const height = compact ? 1350 : 1920;
  const margin = compact ? 62 : 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 만들 수 없는 브라우저입니다.");

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, member.theme.background);
  gradient.addColorStop(1, member.theme.surface);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  drawThemeDecoration(context, member, width, height);

  const headerY = compact ? 58 : 110;
  drawText(context, "SNESA · 100 DAYS RUNNING", margin, headerY, compact ? 18 : 21, member.theme.accent, 900);
  drawText(context, "2026.05.05 — 08.12", width - margin, headerY, compact ? 17 : 20, "rgba(255,255,255,0.48)", 800, "right");

  const heroTop = compact ? 112 : 176;
  const nameSize = fitText(context, member.name, 560, compact ? 66 : 78, 44);
  drawText(context, member.name, margin, heroTop + nameSize, nameSize, "#ffffff", 900);
  fillRoundedRect(context, margin, heroTop + (compact ? 86 : 110), compact ? 240 : 280, compact ? 46 : 54, 30, member.theme.accent);
  drawText(context, member.theme.label, margin + (compact ? 120 : 140), heroTop + (compact ? 117 : 146), compact ? 20 : 23, member.theme.background, 900, "center");
  drawText(context, member.statement, margin, heroTop + (compact ? 166 : 205), compact ? 22 : 27, "rgba(255,255,255,0.72)", 800);

  const character = await loadSvg(characterSvgMarkup);
  const characterSize = compact ? 220 : 280;
  const characterX = width - margin - characterSize;
  const characterY = heroTop - (compact ? 24 : 42);
  fillRoundedRect(context, characterX - 22, characterY - 22, characterSize + 44, characterSize + 44, characterSize / 2, "rgba(255,255,255,0.08)");
  if (character) context.drawImage(character, characterX, characterY, characterSize, characterSize);
  else {
    context.fillStyle = member.theme.accent;
    context.beginPath();
    context.arc(characterX + characterSize / 2, characterY + characterSize / 2, characterSize * 0.35, 0, Math.PI * 2);
    context.fill();
  }
  if (member.recentBadge) {
    const badgeLabel = `${member.recentBadge.key === "hundred-day-streak" ? "♛ " : ""}${member.recentBadge.label}`;
    const badgeWidth = Math.min(context.measureText(badgeLabel).width + 48, characterSize + 80);
    fillRoundedRect(context, width - margin - badgeWidth, characterY + characterSize - 22, badgeWidth, compact ? 42 : 48, 28, member.hasHundredDayBadge ? "#7dd3fc" : "#ffffff");
    drawText(context, badgeLabel, width - margin - badgeWidth / 2, characterY + characterSize + (compact ? 7 : 11), compact ? 17 : 20, member.theme.background, 900, "center");
  }

  const statsTop = compact ? 410 : 535;
  const statsGap = 18;
  const statWidth = (width - margin * 2 - statsGap) / 2;
  const statHeight = compact ? 92 : 122;
  const statValues = [
    ["총 인증일", `${member.certifiedDays}/100일`],
    ["누적 거리", `${member.distanceKm.toFixed(1)}km`],
    ["누적 시간", `${Math.floor(member.durationSeconds / 3600)}시간 ${Math.round((member.durationSeconds % 3600) / 60)}분`],
    ["최장 연속 인증", `${member.longestStreak}일`],
  ];
  statValues.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawStatCard(context, margin + column * (statWidth + statsGap), statsTop + row * (statHeight + statsGap), statWidth, statHeight, label, value, member.theme.accent, compact);
  });

  const calendarTitleY = compact ? 644 : 835;
  drawText(context, "인증한 날짜", margin, calendarTitleY, compact ? 23 : 28, "#ffffff", 900);
  drawText(context, "본 인증 · 리커버리 · 뱃지 획득", width - margin, calendarTitleY, compact ? 14 : 17, "rgba(255,255,255,0.46)", 800, "right");
  drawCalendar(context, member, calendarTitleY + (compact ? 34 : 44), margin, compact);

  const weeklyTitleY = compact ? 872 : 1166;
  drawText(context, "주간 리듬", margin, weeklyTitleY, compact ? 23 : 28, "#ffffff", 900);
  drawText(context, member.bestWeekLabel, width - margin, weeklyTitleY, compact ? 16 : 19, member.theme.accent, 900, "right");
  drawWeeklyChart(context, member, weeklyTitleY + (compact ? 24 : 34), margin, compact);

  const monthlyTitleY = compact ? 1028 : 1390;
  drawText(context, "월간 흐름", margin, monthlyTitleY, compact ? 23 : 28, "#ffffff", 900);
  drawMonthlyChart(context, member, monthlyTitleY + (compact ? 31 : 42), margin, compact);

  const badgesTop = compact ? 1135 : 1542;
  drawText(context, "최근 획득 뱃지", margin, badgesTop, compact ? 23 : 28, "#ffffff", 900);
  const recentBadges = member.badges.slice(0, 3);
  const badgeGap = 14;
  const badgeWidth = (width - margin * 2 - badgeGap * 2) / 3;
  recentBadges.forEach((badge, index) => {
    const x = margin + index * (badgeWidth + badgeGap);
    fillRoundedRect(context, x, badgesTop + (compact ? 22 : 31), badgeWidth, compact ? 70 : 92, compact ? 18 : 22, badge.key === "hundred-day-streak" ? "#7dd3fc" : "rgba(255,255,255,0.10)");
    drawText(context, badge.key === "hundred-day-streak" ? `♛ ${badge.label}` : badge.label, x + 16, badgesTop + (compact ? 51 : 66), compact ? 15 : 17, badge.key === "hundred-day-streak" ? member.theme.background : "#ffffff", 900);
    drawText(context, badge.earnedDate ? badge.earnedDate.slice(5).replace("-", ".") : "획득", x + 16, badgesTop + (compact ? 74 : 100), compact ? 12 : 14, badge.key === "hundred-day-streak" ? member.theme.background : "rgba(255,255,255,0.46)", 800);
  });

  const footerY = height - (compact ? 54 : 88);
  context.strokeStyle = "rgba(255,255,255,0.14)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(margin, footerY - (compact ? 28 : 40));
  context.lineTo(width - margin, footerY - (compact ? 28 : 40));
  context.stroke();
  drawText(context, "스내사 러닝보드", margin, footerY, compact ? 18 : 21, "rgba(255,255,255,0.72)", 900);
  drawText(context, `${member.favoriteWeekday} 러너 · 뱃지 ${member.badges.length}개`, width - margin, footerY, compact ? 16 : 19, "rgba(255,255,255,0.48)", 800, "right");

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("포스터 이미지 생성에 실패했습니다.")), "image/png", 1);
  });
}
