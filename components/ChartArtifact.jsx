'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function buildRows(spec) {
  const { labels, series } = spec;
  return labels.map((label, i) => {
    const row = { label };
    for (const s of series) {
      row[s.name] = s.values[i];
    }
    return row;
  });
}

const GRID = 'rgba(120, 140, 170, 0.15)';
const TICK = '#8b97ab';
const TOOLTIP_BG = 'rgba(8, 10, 14, 0.95)';
const TOOLTIP_BORDER = 'rgba(120, 140, 170, 0.25)';

export function ChartArtifact({ spec }) {
  if (!spec?.labels?.length || !spec?.series?.length) return null;
  const data = buildRows(spec);
  const keys = spec.series.map((s) => s.name);

  return (
    <div className="chart-wrap" style={{ width: '100%', height: 320 }}>
      {spec.title ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 10, fontWeight: 600 }}>
          {spec.title}
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        {spec.type === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={68} />
            <YAxis tick={{ fill: TICK, fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 10 }}
              labelStyle={{ color: 'var(--text)' }}
            />
            <Legend />
            {keys.map((k, idx) => (
              <Bar key={k} dataKey={k} fill={colorAt(idx)} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} />
            <YAxis tick={{ fill: TICK, fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 10 }}
              labelStyle={{ color: 'var(--text)' }}
            />
            <Legend />
            {keys.map((k, idx) => (
              <Line key={k} type="monotone" dataKey={k} stroke={colorAt(idx)} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const COLORS = ['#c4a574', '#7d9cbf', '#d67b5c', '#9a8bc4', '#c9cdd4'];

function colorAt(i) {
  return COLORS[i % COLORS.length];
}
