'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DataTable } from './DataTable.jsx';
import { ChartArtifact } from './ChartArtifact.jsx';

export function Message({ role, content, artifacts }) {
  const isUser = role === 'user';

  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--assistant'}`}>
      <div
        className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}
      >
        <div className="message-meta">{isUser ? 'Vos' : 'Asistente'}</div>
        <div className="md-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
        </div>
        {artifacts?.charts?.length ? (
          <div className="chart-wrap">
            {artifacts.charts.map((c, i) => (
              <ChartArtifact key={i} spec={c.chart} />
            ))}
          </div>
        ) : null}
        {artifacts?.tables?.length ? (
          <div className="chart-wrap">
            {artifacts.tables.map((t, i) => (
              <DataTable
                key={i}
                rows={t.rows}
                title={t.meta?.table ? `Tabla: ${t.meta.table}` : 'Resultados'}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
