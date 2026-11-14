import React, { useId } from 'react';

/** Null readings create a gap; no substituted zeroes or synthetic samples. */
export function LineChart({ rows, metric, title, unit, xKey = 'Time' }) {
  const id = useId();
  const values = rows.filter(
    (r) => r[metric] != null && Number.isFinite(Number(r[metric])),
  );
  if (!values.length)
    return (
      <div className="wa-chart">
        <h3>{title}</h3>
        <p className="wa-empty">Chưa có dữ liệu để vẽ biểu đồ.</p>
      </div>
    );
  const min = Math.min(...values.map((r) => Number(r[metric]))),
    max = Math.max(...values.map((r) => Number(r[metric])));
  const times = rows.map((r, i) =>
    Number.isFinite(Date.parse(r[xKey])) ? Date.parse(r[xKey]) : i,
  );
  const first = Math.min(...times),
    last = Math.max(...times);
  let connected = false;
  const path = rows
    .map((row, index) => {
      if (row[metric] == null || !Number.isFinite(Number(row[metric]))) {
        connected = false;
        return '';
      }
      const x = 50 + ((times[index] - first) / (last - first || 1)) * 590;
      const y = 150 - ((Number(row[metric]) - min) / (max - min || 1)) * 115;
      const command = `${connected ? 'L' : 'M'}${x},${y}`;
      connected = true;
      return command;
    })
    .join(' ');
  return (
    <div className="wa-chart">
      <h3>
        {title} <small>({unit})</small>
      </h3>
      <svg viewBox="0 0 680 190" role="img" aria-labelledby={id}>
        <title id={id}>
          {title}: {values.length} số đo, từ {min} đến {max} {unit}
        </title>
        <path d="M50 20V150H650" stroke="#cfddd5" fill="none" />
        <text x="0" y="35">
          {max}
        </text>
        <text x="0" y="150">
          {min}
        </text>
        <path d={path} fill="none" stroke="#1f7857" strokeWidth="2.5" />
        {rows.length === 1 && <circle cx="50" cy="150" r="4" fill="#1f7857" />}
        <text x="50" y="178">
          {String(rows[0]?.[xKey] || '')
            .slice(0, 16)
            .replace('T', ' ')}
        </text>
        <text x="640" y="178" textAnchor="end">
          {String(rows.at(-1)?.[xKey] || '')
            .slice(0, 16)
            .replace('T', ' ')}
        </text>
      </svg>
    </div>
  );
}
