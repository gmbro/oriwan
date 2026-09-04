import { readFileSync, writeFileSync } from "node:fs";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error("Usage: node scripts/build-third-season-snapshot.mjs <source.json> <output.json>");
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const seasonEnd = "2026-08-12";
const participantIdMap = new Map(
  source.participants.map((participant, index) => [
    participant.id,
    `p${String(index + 1).padStart(2, "0")}`,
  ]),
);

const snapshot = {
  from: "2026-05-05",
  to: seasonEnd,
  certification_display_start_date: source.certification_display_start_date,
  challenge_start_date: source.challenge_start_date,
  challenge_end_date: source.challenge_end_date,
  generated_at: source.generated_at,
  participants: source.participants.map((participant, index) => ({
    id: `p${String(index + 1).padStart(2, "0")}`,
    name: participant.name,
    active: participant.active,
    display_order: participant.display_order,
  })),
  records: source.records
    .filter((record) => record.record_date && record.record_date <= seasonEnd)
    .map((record, index) => ({
      id: `r${String(index + 1).padStart(4, "0")}`,
      participant_id: participantIdMap.get(record.participant_id) ?? null,
      record_date: record.record_date,
      distance_km: record.distance_km,
      duration_seconds: record.duration_seconds,
      status: record.status,
      space_label: record.space_label ?? null,
      is_recovery_certification: Boolean(record.is_recovery_certification),
    })),
  growth_badges: source.growth_badges.flatMap((badge) => {
    const participantId = participantIdMap.get(badge.participant_id);
    if (!participantId) return [];
    return [{
      participant_id: participantId,
      badge_key: badge.badge_key,
      earned_at: badge.earned_at,
    }];
  }),
};

writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
