'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { buildInsightsChartMap, buildInsightsChartSpecs } from '@/lib/insightsCharts.js';
import { ChartArtifact } from './ChartArtifact.jsx';
import { exportElementToPdf } from './exportInsightsPdf.js';
import { InsightsReportMarkdown } from './InsightsReportMarkdown.jsx';

function stripInsightChartMarkers(md) {
  return md
    .replace(/<!--\s*INSIGHT_CHART:\s*[a-z_]+\s*-->/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function InsightsPanel() {
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [facts, setFacts] = useState(null);
  const [error, setError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const reportRef = useRef(null);

  const chartList = useMemo(() => buildInsightsChartSpecs(facts), [facts]);
  const chartMap = useMemo(() => buildInsightsChartMap(facts), [facts]);
  const factsJson = useMemo(() => (facts ? JSON.stringify(facts, null, 2) : ''), [facts]);

  const load = useCallback(async (synthesize) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synthesize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMarkdown(data.markdown || '');
      setFacts(data.facts ?? null);
    } catch (e) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  function downloadMd() {
    const raw = markdown || factsJson;
    const body = markdown ? stripInsightChartMarkers(markdown) : raw;
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insights_rappi.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!reportRef.current) return;
    setPdfBusy(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => r()));
      await exportElementToPdf(reportRef.current, 'insights_rappi.pdf');
    } catch (e) {
      console.error(e);
      setError(e?.message || 'No se pudo generar el PDF');
    } finally {
      setPdfBusy(false);
    }
  }

  const hasReport = Boolean(markdown || facts);

  return (
    <div className="insights-page">
      <h1 className="insights-title">Insights</h1>
      <p className="insights-lead">Resumen automático sobre los datos cargados. Exportá a Markdown o PDF.</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => load(false)} disabled={loading}>
          Solo hechos (JSON)
        </button>
        <button type="button" className="btn btn--primary" onClick={() => load(true)} disabled={loading}>
          Generar informe ejecutivo (Markdown)
        </button>
        {hasReport && (
          <>
            <button type="button" className="btn btn--ghost" onClick={downloadMd}>
              Descargar .md
            </button>
            <button type="button" className="btn" onClick={downloadPdf} disabled={pdfBusy}>
              {pdfBusy ? 'Generando PDF…' : 'Descargar PDF'}
            </button>
          </>
        )}
      </div>
      {loading ? <p className="status-loading">Generando…</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      {hasReport ? (
        <div ref={reportRef} className="insights-report-card">
          <h2 className="insights-report-title">Informe</h2>
          <p className="insights-report-sub">Texto y gráficos con pie de figura donde el modelo insertó marcadores.</p>

          {markdown ? (
            <InsightsReportMarkdown
              markdown={markdown}
              chartList={chartList}
              chartMap={chartMap}
            />
          ) : null}

          {!markdown && factsJson ? <pre className="insights-facts-pre">{factsJson}</pre> : null}

          {!markdown && chartList.length > 0 ? (
            <section style={{ marginTop: '1.5rem' }}>
              <h3 className="insights-section-title">Visualizaciones (derivadas de los hechos)</h3>
              {chartList.map((item) => (
                <figure key={item.id} className="insights-figure">
                  <ChartArtifact spec={item.spec} />
                  <figcaption className="insights-figcaption">{item.caption}</figcaption>
                </figure>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
