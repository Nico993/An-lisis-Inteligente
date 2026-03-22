'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  hasInsightChartMarkers,
  splitReportMarkdownByChartMarkers,
} from '@/lib/insightsCharts.js';
import { ChartArtifact } from './ChartArtifact.jsx';

function mdBlock(content) {
  if (!content || !String(content).trim()) return null;
  return (
    <div className="insights-md" style={{ lineHeight: 1.55 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Informe: narrativa primero; en cada marcador `<!-- INSIGHT_CHART:id -->` se inserta el gráfico + pie.
 * Si el modelo no dejó marcadores, se muestra todo el texto y al final un anexo con gráficos en orden.
 */
export function InsightsReportMarkdown({ markdown, chartList, chartMap }) {
  const parts = useMemo(() => splitReportMarkdownByChartMarkers(markdown || ''), [markdown]);
  const interleaved = hasInsightChartMarkers(markdown || '');

  if (interleaved) {
    return (
      <div>
        {parts.map((p, i) => {
          if (p.type === 'md') return <div key={i}>{mdBlock(p.content)}</div>;
          const entry = chartMap[p.id];
          if (!entry) {
            return (
              <p key={i} className="insights-missing-chart">
                [Gráfico no disponible: {p.id}]
              </p>
            );
          }
          return (
            <figure key={i} className="insights-figure">
              <ChartArtifact spec={entry.spec} />
              <figcaption className="insights-figcaption">{entry.caption}</figcaption>
            </figure>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {mdBlock(markdown)}
      {chartList.length > 0 ? (
        <section style={{ marginTop: '1.75rem' }}>
          <h3 className="insights-section-title">Anexos gráficos</h3>
          <p className="insights-annex-lead">Gráficos al final porque no hubo marcadores de posición en el texto.</p>
          {chartList.map((item) => (
            <figure key={item.id} className="insights-figure">
              <ChartArtifact spec={item.spec} />
              <figcaption className="insights-figcaption">{item.caption}</figcaption>
            </figure>
          ))}
        </section>
      ) : null}
    </div>
  );
}
