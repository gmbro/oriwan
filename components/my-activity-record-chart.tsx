"use client";
import { useState } from 'react';
import type { PersonalRunRecord } from '@/lib/personal-records';
import { personalRecordChart, type RecordPeriod } from '@/lib/personal-record-chart';
import styles from './my-activity.module.css';

export default function MyActivityRecordChart({ records, today }: { records: PersonalRunRecord[]; today: string }) {
  const [period, setPeriod] = useState<RecordPeriod>('week');
  const [metric, setMetric] = useState<'distance' | 'minutes'>('distance');
  const { start, buckets } = personalRecordChart(records, today, period);
  const maximum = Math.max(1, ...buckets.map(b => b[metric]));
  const total = buckets.reduce((sum, b) => sum + b[metric], 0);
  const unit = metric === 'distance' ? 'km' : '분';
  const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: metric === 'distance' ? 2 : 0 });
  return <section className={styles.chart} aria-label="운동 기록 그래프">
    <h3>기록 그래프</h3>
    <div className={styles.chartTabs} role="group" aria-label="그래프 기간">
      {([{ key: 'week', label: '주간 기록' }, { key: 'month', label: '월간 기록' }, { key: 'total', label: '총 기록' }] as const).map(item => <button type="button" key={item.key} aria-pressed={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
    </div>
    <div className={styles.row}><div className={styles.chartTabs} role="group" aria-label="그래프 지표">
      <button type="button" aria-pressed={metric === 'distance'} onClick={() => setMetric('distance')}>거리</button>
      <button type="button" aria-pressed={metric === 'minutes'} onClick={() => setMetric('minutes')}>시간</button>
    </div><strong aria-live="polite">{format(total)}{unit}</strong></div>
    <p className={styles.muted}>{start.replaceAll('-', '.')} ~ {today.replaceAll('-', '.')} · {period === 'total' ? '월별 합계' : '일별 합계'}</p>
    <div className={styles.chartScroll} tabIndex={0} role="region" aria-label="날짜별 기록. 좌우로 스크롤하여 확인하세요">
      <div className={styles.chartBars}>
        {buckets.map(bucket => <div className={styles.chartColumn} key={bucket.date}>
          <span>{format(bucket[metric])}</span><div className={styles.chartTrack}><div style={{ height: `${bucket[metric] / maximum * 100}%` }} /></div><small>{bucket.label}</small>
        </div>)}
      </div>
    </div>
    {total === 0 && <p className={styles.muted}>이 기간에 표시할 {metric === 'distance' ? '거리' : '시간'} 기록이 없어요.</p>}
    <p className={styles.muted}>시작 전 운동과 승인 대기 기록을 포함해요. 총 인증일은 공식 기간에 승인된 기록만 반영해요.</p>
  </section>;
}
