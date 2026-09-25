"use client";
import { useId, useState } from 'react';
import type { PersonalRunRecord } from '@/lib/personal-records';
import { personalRecordChart, type RecordPeriod } from '@/lib/personal-record-chart';
import styles from './my-activity.module.css';

export default function MyActivityRecordChart({ records, today }: { records: PersonalRunRecord[]; today: string }) {
  const [period, setPeriod] = useState<RecordPeriod>('day');
  const [metric, setMetric] = useState<'distance' | 'minutes'>('distance');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const titleId = useId();
  const { start, end, buckets, beforeStart, canPrevious, canNext } = personalRecordChart(records, today, period, offset);
  const total = buckets.reduce((sum, b) => sum + b[metric], 0);
  const unit = metric === 'distance' ? 'km' : '분';
  const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: metric === 'distance' ? 2 : 0 });
  const max = Math.max(1, ...buckets.map(b => b[metric]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const ceiling = Math.ceil(max / step) * step;
  const chosen = buckets.find(b => b.date === selected);
  const chartWidth = Math.max(320, period === 'day' ? buckets.length * 28 + 44 : 320), left = 34, plotWidth = chartWidth - 44, base = 158, plotHeight = 122;
  const slot = plotWidth / Math.max(1, buckets.length);
  return <section className={styles.chart} aria-label="운동 기록 그래프">
    <div className={styles.chartTabs} role="group" aria-label="그래프 기간">
      {([{ key: 'day', label: '일간 기록' }, { key: 'week', label: '주간 기록' }, { key: 'month', label: '월간 기록' }] as const).map(item => <button type="button" key={item.key} aria-pressed={period === item.key} onClick={() => {setPeriod(item.key); setOffset(0); setSelected(null);}}>{item.label}</button>)}
    </div>
    <div className={styles.chartPeriod}>
      {period !== 'month' && <button type="button" disabled={!canPrevious} aria-label="이전 기록 기간" onClick={() => {setOffset(offset-1);setSelected(null);}}>‹</button>}
      <span>{beforeStart ? '2026년 9월 1일 시작' : period === 'month' ? '2026년 9월 – 12월' : `${start.slice(5).replace('-', '.')} – ${end.slice(5).replace('-', '.')}${period === 'week' ? ' · 월–일 기준' : ''}`}</span>
      {period !== 'month' && <button type="button" disabled={!canNext} aria-label="다음 기록 기간" onClick={() => {setOffset(offset+1);setSelected(null);}}>›</button>}
    </div>
    <div className={styles.chartSummary}>
      <div><span>{chosen ? chosen.label : period === 'month' ? '9월부터 전체' : '선택한 월'} {metric === 'distance' ? '달린 거리' : '운동 시간'}</span><strong aria-live="polite">{format(chosen ? chosen[metric] : total)}<small>{unit}</small></strong></div>
      <div className={styles.chartTabs} role="group" aria-label="그래프 지표"><button type="button" aria-pressed={metric === 'distance'} onClick={() => setMetric('distance')}>거리</button><button type="button" aria-pressed={metric === 'minutes'} onClick={() => setMetric('minutes')}>시간</button></div>
    </div>
    {beforeStart ? <div className={styles.chartEmpty}><strong>첫 기록을 기다립니다</strong><p>9월 1일 시작</p></div> : <>
      <div className={styles.chartScroll}><svg style={{minWidth: chartWidth}} viewBox={`0 0 ${chartWidth} 190`} className={styles.recordPlot} role="group" aria-labelledby={titleId}>
        <title id={titleId}>{period === 'month' ? '월별' : period === 'week' ? '주별' : '일별'} {metric === 'distance' ? '거리' : '시간'} 그래프, 단위 {unit}. 막대를 선택하면 수치를 확인할 수 있어요.</title>
        {[0,0.5,1].map(ratio => <g key={ratio}><line x1={left} x2={chartWidth-10} y1={base-ratio*plotHeight} y2={base-ratio*plotHeight} stroke="#e5e8eb" strokeDasharray={ratio ? '3 4' : undefined}/><text x="27" y={base-ratio*plotHeight+3} textAnchor="end" fontSize="9" fill="#8b95a1">{format(ceiling*ratio)}</text></g>)}
        {buckets.map((b,i) => { const height=b[metric]/ceiling*plotHeight; const x=left+i*slot; return <g key={b.date} role="button" tabIndex={0} aria-label={`${b.label}, ${format(b[metric])}${unit}`} aria-pressed={selected===b.date} onClick={()=>setSelected(selected === b.date ? null : b.date)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(selected === b.date ? null : b.date);}}}>
          <rect x={x+slot*.2} y={base-Math.max(height,2)} width={slot*.6} height={Math.max(height,2)} rx="3" fill={b[metric]===0?'#e5e8eb':selected===b.date?'#174bba':'#3182f6'}/>
          <rect x={x} y="20" width={slot} height="160" fill="transparent"/>
          {<text x={x+slot/2} y="177" textAnchor="middle" fontSize="9" fill="#6b7684">{b.label}</text>}
        </g>;})}
      </svg></div>
    </>}
  </section>;
}
