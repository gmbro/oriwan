export type Hello2027MetricRecord = {
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  status: "certified" | "needs_review";
  created_at: string | null;
};

type GroupHello2027MetricRecordsInput = {
  records: readonly Hello2027MetricRecord[];
  participantIds: ReadonlySet<string>;
  personalStartDate: string;
  officialStartDate: string;
  seasonEndDate: string;
  throughDate: string;
};

export type Hello2027ParticipantRecordGroups = {
  officialCertifiedByParticipant: Map<string, Hello2027MetricRecord[]>;
  visibleMetricsByParticipant: Map<string, Hello2027MetricRecord[]>;
  visibleHistoryByParticipant: Map<string, Hello2027MetricRecord[]>;
};

/** Sum the already filtered, one-record-per-member/day official projection. */
export function sumHello2027OfficialMetrics(
  recordsByParticipant: ReadonlyMap<string, readonly Hello2027MetricRecord[]>,
) {
  let distanceKm = 0;
  let durationSeconds = 0;
  for (const records of recordsByParticipant.values()) {
    for (const record of records) {
      if (isUsableMetric(record.distance_km)) distanceKm += record.distance_km;
      if (isUsableMetric(record.duration_seconds)) durationSeconds += record.duration_seconds;
    }
  }
  return { distanceKm: Math.round(distanceKm * 100) / 100, durationMinutes: Math.round(durationSeconds / 60) };
}

function isUsableMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function metricCompleteness(record: Hello2027MetricRecord) {
  return Number(isUsableMetric(record.distance_km)) + Number(isUsableMetric(record.duration_seconds));
}

export function roundHello2027DurationMinutes(value: unknown) {
  return isUsableMetric(value) ? Math.round(value / 60) : null;
}

function isPreferredMetricRecord(
  candidate: Hello2027MetricRecord,
  current: Hello2027MetricRecord,
) {
  const candidateCompleteness = metricCompleteness(candidate);
  const currentCompleteness = metricCompleteness(current);

  // Never let an empty or malformed OCR row hide a usable row for the same day.
  if (candidateCompleteness !== currentCompleteness) {
    return candidateCompleteness > currentCompleteness;
  }

  // Once both rows have equally useful metrics, the approved row is authoritative.
  if (candidate.status !== current.status) return candidate.status === "certified";

  return (candidate.created_at || "") > (current.created_at || "");
}

function appendByParticipant(
  rowsByParticipant: Map<string, Hello2027MetricRecord[]>,
  record: Hello2027MetricRecord,
) {
  if (!record.participant_id) return;
  const participantRecords = rowsByParticipant.get(record.participant_id) || [];
  participantRecords.push(record);
  rowsByParticipant.set(record.participant_id, participantRecords);
}

/**
 * Splits a dashboard record feed into official certifications and display-only
 * running metrics. The latter includes OCR rows waiting for review and
 * pre-season records, while the official group remains certified-only.
 */
export function groupHello2027ParticipantRecords({
  records,
  participantIds,
  personalStartDate,
  officialStartDate,
  seasonEndDate,
  throughDate,
}: GroupHello2027MetricRecordsInput): Hello2027ParticipantRecordGroups {
  const officialByParticipantDate = new Map<string, Hello2027MetricRecord>();
  const metricsByParticipantDate = new Map<string, Hello2027MetricRecord>();

  records.forEach((record) => {
    const participantId = record.participant_id;
    const recordDate = record.record_date;
    if (
      !participantId
      || !participantIds.has(participantId)
      || !recordDate
      || recordDate < personalStartDate
      || recordDate > seasonEndDate
      || recordDate > throughDate
    ) return;

    const participantDateKey = `${participantId}:${recordDate}`;

    if (record.status === "certified" && recordDate >= officialStartDate) {
      const currentOfficial = officialByParticipantDate.get(participantDateKey);
      if (!currentOfficial || isPreferredMetricRecord(record, currentOfficial)) {
        officialByParticipantDate.set(participantDateKey, record);
      }
    }

    if (metricCompleteness(record) === 0) return;
    const currentMetric = metricsByParticipantDate.get(participantDateKey);
    if (!currentMetric || isPreferredMetricRecord(record, currentMetric)) {
      metricsByParticipantDate.set(participantDateKey, record);
    }
  });

  const officialCertifiedByParticipant = new Map<string, Hello2027MetricRecord[]>();
  const visibleMetricsByParticipant = new Map<string, Hello2027MetricRecord[]>();
  const visibleHistoryByParticipant = new Map<string, Hello2027MetricRecord[]>();
  officialByParticipantDate.forEach((record) => appendByParticipant(officialCertifiedByParticipant, record));
  metricsByParticipantDate.forEach((record) => appendByParticipant(visibleMetricsByParticipant, record));

  const historyByParticipantDate = new Map(metricsByParticipantDate);
  officialByParticipantDate.forEach((officialRecord, participantDateKey) => {
    const metricRecord = metricsByParticipantDate.get(participantDateKey);
    historyByParticipantDate.set(participantDateKey, metricRecord
      ? {
          ...officialRecord,
          distance_km: isUsableMetric(officialRecord.distance_km)
            ? officialRecord.distance_km
            : metricRecord.distance_km,
          duration_seconds: isUsableMetric(officialRecord.duration_seconds)
            ? officialRecord.duration_seconds
            : metricRecord.duration_seconds,
        }
      : officialRecord);
  });
  historyByParticipantDate.forEach((record) => appendByParticipant(visibleHistoryByParticipant, record));

  return {
    officialCertifiedByParticipant,
    visibleMetricsByParticipant,
    visibleHistoryByParticipant,
  };
}
