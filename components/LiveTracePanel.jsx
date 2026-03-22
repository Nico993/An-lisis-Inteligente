'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function parseUsage(u) {
  if (!u || typeof u !== 'object') return null;
  const prompt = u.prompt_tokens ?? u.prompt_tokens_total ?? u.input_tokens;
  const completion = u.completion_tokens ?? u.output_tokens;
  const total =
    u.total_tokens ??
    (typeof prompt === 'number' && typeof completion === 'number' ? prompt + completion : undefined);
  if (prompt == null && completion == null && total == null) return null;
  return { prompt, completion, total };
}

function ToolResultBody({ summary }) {
  if (!summary) return null;
  if (summary.ok === false) {
    return <div className="trace-tool-error">{summary.error || 'Error'}</div>;
  }

  switch (summary.kind) {
    case 'query': {
      const { rowCount, columns, sampleRows, table, sqlPreview } = summary;
      return (
        <div className="trace-tool-block">
          <div className="trace-tool-meta">
            {table ? <span className="trace-pill">{table}</span> : null}
            <span className="trace-muted">
              {rowCount} fila{rowCount === 1 ? '' : 's'}
            </span>
          </div>
          {sqlPreview ? (
            <pre className="trace-code trace-code--sql" title={sqlPreview}>
              {sqlPreview}
            </pre>
          ) : null}
          {sampleRows?.length > 0 && columns?.length > 0 ? (
            <div className="trace-table-wrap">
              <table className="trace-mini-table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, ri) => (
                    <tr key={ri}>
                      {columns.map((c) => (
                        <td key={c}>{row[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="trace-muted trace-tool-empty">Sin filas devueltas.</p>
          )}
        </div>
      );
    }
    case 'calc':
      return (
        <div className="trace-tool-block trace-tool-calc">
          <span className="trace-calc-value">{String(summary.value)}</span>
        </div>
      );
    case 'chart':
      return (
        <div className="trace-tool-block">
          <div className="trace-tool-meta">
            <span className="trace-pill">{summary.chartType || 'chart'}</span>
            {summary.title ? <span className="trace-chart-title">{summary.title}</span> : null}
          </div>
          {summary.seriesNames?.length ? (
            <p className="trace-muted trace-tool-series">
              Series: {summary.seriesNames.join(', ')} · {summary.labelCount} etiquetas
            </p>
          ) : null}
        </div>
      );
    case 'dictionary':
      return (
        <div className="trace-tool-block">
          <p className="trace-muted">{summary.matchCount} coincidencias</p>
          {summary.previewNames?.length ? (
            <ul className="trace-tool-list">
              {summary.previewNames.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    case 'schema':
      return (
        <div className="trace-tool-block">
          <p className="trace-muted">{summary.columnCount} columnas en schema</p>
          {summary.preview?.length ? (
            <ul className="trace-tool-list trace-tool-list--compact">
              {summary.preview.map((r) => (
                <li key={r.column_name}>
                  <strong>{r.column_name}</strong> <span className="trace-muted">{r.type}</span>
                  {r.description ? ` — ${r.description}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    default:
      return <pre className="trace-code">{JSON.stringify(summary, null, 2)}</pre>;
  }
}

function ThinkingBlock({ text, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, text]);
  if (!text?.trim()) return null;
  return (
    <div className="trace-think">
      <button
        type="button"
        className="trace-think-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="trace-chevron" data-open={open} aria-hidden />
        Pensamiento
      </button>
      {open ? <pre className="trace-think-body">{text}</pre> : null}
    </div>
  );
}

function UsageBar({ usage }) {
  const p = parseUsage(usage);
  if (!p) return null;
  const { prompt, completion, total } = p;
  return (
    <div className="trace-usage" role="status">
      <span className="trace-usage-label">Tokens</span>
      {typeof prompt === 'number' ? (
        <span className="trace-usage-chip" title="Entrada">
          in <strong>{prompt.toLocaleString('es-AR')}</strong>
        </span>
      ) : null}
      {typeof completion === 'number' ? (
        <span className="trace-usage-chip" title="Salida">
          out <strong>{completion.toLocaleString('es-AR')}</strong>
        </span>
      ) : null}
      {typeof total === 'number' ? (
        <span className="trace-usage-chip trace-usage-chip--total" title="Total">
          Σ <strong>{total.toLocaleString('es-AR')}</strong>
        </span>
      ) : null}
    </div>
  );
}

function labelTool(name) {
  const map = {
    query_datos: 'query_datos',
    calcular: 'calcular',
    generar_grafico: 'generar_grafico',
    obtener_diccionario_metricas: 'diccionario',
    obtener_schema_columnas: 'schema',
  };
  return map[name] || name || 'tool';
}

export function LiveTracePanel({ events, active }) {
  const bottomRef = useRef(null);
  const [draftOpen, setDraftOpen] = useState({});

  const modelLabel = useMemo(() => {
    const s = events.find((e) => e.type === 'session_start');
    return s?.model ? String(s.model) : null;
  }, [events]);

  const lastThinkingIdx = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'thinking') return i;
    }
    return -1;
  }, [events]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (!active && events.length === 0) return null;

  return (
    <div className={`trace-dock${active ? ' trace-dock--active' : ''}`}>
      <div className="trace-dock-head">
        <span className="trace-dock-title">Ejecución</span>
        {modelLabel ? <span className="trace-dock-model">{modelLabel}</span> : null}
        {active ? <span className="trace-dock-pulse" aria-hidden /> : null}
      </div>
      <div className="trace-dock-body">
        {events.map((ev, idx) => {
          if (ev.type === 'session_start' || ev.type === 'iteration' || ev.type === 'llm_request') {
            return null;
          }

          if (ev.type === 'thinking') {
            return (
              <ThinkingBlock
                key={`think-${idx}`}
                text={ev.text}
                defaultOpen={idx === lastThinkingIdx}
              />
            );
          }

          if (ev.type === 'assistant_message' && ev.text) {
            const isOpen = Boolean(draftOpen[idx]);
            return (
              <div key={`draft-${idx}`} className="trace-draft">
                <button
                  type="button"
                  className="trace-draft-toggle"
                  onClick={() => setDraftOpen((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  aria-expanded={isOpen}
                >
                  <span className="trace-chevron" data-open={isOpen} aria-hidden />
                  Borrador del modelo
                </button>
                {isOpen ? <pre className="trace-draft-body">{ev.text}</pre> : null}
              </div>
            );
          }

          if (ev.type === 'tool_calls_pending') {
            const names = (ev.names || []).filter(Boolean);
            const label =
              names.length > 0
                ? names.map((n) => labelTool(n)).join(', ')
                : `${ev.count ?? '?'} herramienta(s)`;
            return (
              <div key={`pend-${idx}`} className="trace-line trace-line--pending">
                <span className="trace-glyph">→</span>
                {label}
              </div>
            );
          }

          if (ev.type === 'tool_call') {
            return (
              <div key={`call-${idx}`} className="trace-tool-call">
                <div className="trace-tool-name">
                  <span className="trace-glyph">$</span> {labelTool(ev.name)}
                </div>
                {ev.argumentsPreview ? (
                  <pre className="trace-code">{ev.argumentsPreview}</pre>
                ) : null}
              </div>
            );
          }

          if (ev.type === 'tool_result') {
            return (
              <div key={`res-${idx}`} className="trace-tool-result">
                <div className="trace-tool-result-label">Resultado</div>
                <ToolResultBody summary={ev.summary} />
              </div>
            );
          }

          if (ev.type === 'usage') {
            return <UsageBar key={`usage-${idx}`} usage={ev.usage} />;
          }

          if (ev.type === 'finish') {
            return (
              <div key={`fin-${idx}`} className="trace-finish">
                {ev.reason === 'stop' ? 'Listo' : String(ev.reason || '')}
              </div>
            );
          }

          return null;
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
