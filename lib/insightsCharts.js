/**
 * Genera specs de gráficos (mismo formato que la tool `generar_grafico`) a partir de `facts` del insights engine.
 * Cada gráfico tiene un `id` estable para insertarlo vía marcadores en el Markdown del informe.
 */

function trunc(s, n = 28) {
  if (s == null) return '';
  const t = String(s);
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function round(x, d = 2) {
  if (x == null || Number.isNaN(x)) return 0;
  const p = 10 ** d;
  return Math.round(x * p) / p;
}

/** Texto de pie de figura (informe tipo paper). */
const CAPTIONS = {
  anomalies:
    'Figura — Anomalías operativas (WoW). |Δ%| > 10 % entre semanas consecutivas (l0w↔l1w … l7w↔l8w). Fuente: métricas zonales en SQLite.',
  trends:
    'Figura — Tendencias en deterioro (≥3 semanas consecutivas de caída: l0w<l1w<l2w<l3w). Magnitud l3w→l0w. Fuente: insights engine.',
  trends_up:
    'Figura — Tendencias al alza (≥3 semanas consecutivas de mejora: l0w>l1w>l2w>l3w). Magnitud l3w→l0w. Fuente: insights engine.',
  benchmark:
    'Figura — Benchmarking. Desviación respecto a la media del grupo (país, tipo de zona y métrica) en unidades de z-score. Fuente: agregación por segmento.',
  correlations:
    'Figura — Correlaciones. Coeficiente de Pearson entre pares de métricas alineadas por zona (l0w). Correlación no implica causalidad. Fuente: cálculo sobre zonas coincidentes.',
  correlation_examples:
    'Figura — Ejemplos por zona (cuadrantes bajo-bajo vs mediana por par de métricas, l0w). Muestra accionable para priorizar visitas. Fuente: insights engine.',
  opportunities_tension:
    'Figura — Oportunidad: alta cobertura (Lead Penetration) y bajo Perfect Orders. Fuente: métricas por zona.',
  opportunities_efficiency:
    'Figura — Oportunidad: bajo Lead Penetration y alto Perfect Orders (base sólida). Fuente: métricas por zona.',
  opportunities_pro_mix:
    'Figura — Oportunidad: alto Pro Adoption y baja conversión No Pro (Non-Pro PTC > OP). Fuente: métricas por zona.',
};

/**
 * Marcador que el modelo debe insertar en el Markdown (solo línea, tras el texto de la sección).
 * Ejemplo: <!-- INSIGHT_CHART:anomalies -->
 */
export const INSIGHT_CHART_MARKER_PREFIX = '<!-- INSIGHT_CHART:';

/**
 * @param {object} facts Resultado de `computeInsightFacts`.
 * @returns {Array<{ id: string; spec: object; caption: string }>}
 */
export function buildInsightsChartSpecs(facts) {
  if (!facts || typeof facts !== 'object') return [];

  /** @type {Array<{ id: string; spec: object; caption: string }>} */
  const out = [];

  const anomalies = Array.isArray(facts.anomalies) ? facts.anomalies : [];
  if (anomalies.length) {
    const slice = anomalies.slice(0, 12);
    out.push({
      id: 'anomalies',
      caption: CAPTIONS.anomalies,
      spec: {
        type: 'bar',
        title: 'Mayores anomalías WoW (|Δ%| por ventana consecutiva)',
        labels: slice.map((a) =>
          trunc(
            `${a.wow_window || ''} · ${a.country} · ${a.zone || ''} · ${a.metric || ''}`,
            42
          )
        ),
        series: [
          {
            name: 'Δ % WoW',
            values: slice.map((a) => round(Number(a.wow_pct), 2)),
          },
        ],
      },
    });
  }

  const trends = Array.isArray(facts.trendsDown) ? facts.trendsDown : [];
  if (trends.length) {
    const slice = trends.slice(0, 12);
    out.push({
      id: 'trends',
      caption: CAPTIONS.trends,
      spec: {
        type: 'bar',
        title: 'Tendencias en deterioro (3+ semanas): magnitud l3w → l0w',
        labels: slice.map((t) =>
          trunc(`${t.country} · ${t.zone || ''} · ${t.metric || ''}`, 40)
        ),
        series: [
          {
            name: 'Δ (l3w−l0w)',
            values: slice.map((t) => {
              const l0 = Number(t.l0w);
              const l3 = Number(t.l3w);
              if (Number.isNaN(l0) || Number.isNaN(l3)) return 0;
              return round(l3 - l0, 4);
            }),
          },
        ],
      },
    });
  }

  const trendsUp = Array.isArray(facts.trendsUp) ? facts.trendsUp : [];
  if (trendsUp.length) {
    const slice = trendsUp.slice(0, 12);
    out.push({
      id: 'trends_up',
      caption: CAPTIONS.trends_up,
      spec: {
        type: 'bar',
        title: 'Tendencias al alza (3+ semanas): magnitud l0w − l3w',
        labels: slice.map((t) =>
          trunc(`${t.country} · ${t.zone || ''} · ${t.metric || ''}`, 40)
        ),
        series: [
          {
            name: 'Δ (l0w−l3w)',
            values: slice.map((t) => {
              const l0 = Number(t.l0w);
              const l3 = Number(t.l3w);
              if (Number.isNaN(l0) || Number.isNaN(l3)) return 0;
              return round(l0 - l3, 4);
            }),
          },
        ],
      },
    });
  }

  const bench = Array.isArray(facts.benchmark) ? facts.benchmark : [];
  if (bench.length) {
    const slice = bench.slice(0, 12);
    out.push({
      id: 'benchmark',
      caption: CAPTIONS.benchmark,
      spec: {
        type: 'bar',
        title: 'Benchmarking: |z-score| vs media país / tipo / métrica',
        labels: slice.map((b) =>
          trunc(`${b.country} · ${b.zone || ''} · ${b.metric || ''}`, 40)
        ),
        series: [
          {
            name: 'z-score',
            values: slice.map((b) => round(Number(b.zscore), 2)),
          },
        ],
      },
    });
  }

  const corrs = Array.isArray(facts.correlations) ? facts.correlations : [];
  const corrSlice = corrs.slice(0, 24);
  if (corrSlice.length) {
    out.push({
      id: 'correlations',
      caption: CAPTIONS.correlations,
      spec: {
        type: 'bar',
        title: 'Correlación de Pearson (l0w): top pares por |r|',
        labels: corrSlice.map((c) => trunc(`${c.metric_a} vs ${c.metric_b}`, 36)),
        series: [
          {
            name: 'Pearson r',
            values: corrSlice.map((c) => round(Number(c.pearson), 3)),
          },
        ],
      },
    });
    const firstPair = corrSlice.find(
      (c) => Array.isArray(c.zones_low_low) && c.zones_low_low.length
    );
    if (firstPair) {
      const sliceZ = firstPair.zones_low_low.slice(0, 10);
      out.push({
        id: 'correlation_examples',
        caption: CAPTIONS.correlation_examples,
        spec: {
          type: 'bar',
          title: `Ejemplos bajo-bajo: ${firstPair.metric_a} vs ${firstPair.metric_b} (l0w)`,
          labels: sliceZ.map((z) =>
            trunc(`${z.country} · ${z.zone || ''}`, 28)
          ),
          series: [
            {
              name: firstPair.metric_a,
              values: sliceZ.map((z) => round(Number(z.m1), 4)),
            },
            {
              name: firstPair.metric_b,
              values: sliceZ.map((z) => round(Number(z.m2), 4)),
            },
          ],
        },
      });
    }
  }

  const oppBlocks = Array.isArray(facts.opportunities) ? facts.opportunities : [];
  for (const block of oppBlocks) {
    if (!block?.rows?.length) continue;
    const slice = block.rows.slice(0, 12);
    const kind = block.kind || 'unknown';
    if (kind === 'tension_high_lp_low_perfect') {
      out.push({
        id: 'opportunities_tension',
        caption: CAPTIONS.opportunities_tension,
        spec: {
          type: 'bar',
          title: 'Oportunidad: alto Lead Penetration vs bajo Perfect Orders',
          labels: slice.map((o) => trunc(`${o.country} · ${o.zone || ''}`, 26)),
          series: [
            { name: 'Lead Pen.', values: slice.map((o) => round(Number(o.lead_penetration), 3)) },
            { name: 'Perfect Ord.', values: slice.map((o) => round(Number(o.perfect_orders), 3)) },
          ],
        },
      });
    } else if (kind === 'efficiency_low_lp_high_perfect') {
      out.push({
        id: 'opportunities_efficiency',
        caption: CAPTIONS.opportunities_efficiency,
        spec: {
          type: 'bar',
          title: 'Oportunidad: bajo Lead Penetration vs alto Perfect Orders',
          labels: slice.map((o) => trunc(`${o.country} · ${o.zone || ''}`, 26)),
          series: [
            { name: 'Lead Pen.', values: slice.map((o) => round(Number(o.lead_penetration), 3)) },
            { name: 'Perfect Ord.', values: slice.map((o) => round(Number(o.perfect_orders), 3)) },
          ],
        },
      });
    } else if (kind === 'pro_mix_high_pro_low_nonpro_cvr') {
      out.push({
        id: 'opportunities_pro_mix',
        caption: CAPTIONS.opportunities_pro_mix,
        spec: {
          type: 'bar',
          title: 'Oportunidad: Pro Adoption vs Non-Pro PTC > OP',
          labels: slice.map((o) => trunc(`${o.country} · ${o.zone || ''}`, 26)),
          series: [
            { name: 'Pro Adopt.', values: slice.map((o) => round(Number(o.pro_adoption), 3)) },
            { name: 'NonPro PTC', values: slice.map((o) => round(Number(o.nonpro_ptc), 3)) },
          ],
        },
      });
    }
  }

  return out;
}

/**
 * Mapa id → entrada para búsqueda rápida.
 * @param {object} facts
 */
export function buildInsightsChartMap(facts) {
  const list = buildInsightsChartSpecs(facts);
  /** @type {Record<string, { spec: object; caption: string }>} */
  const map = {};
  for (const item of list) {
    map[item.id] = { spec: item.spec, caption: item.caption };
  }
  return map;
}

/** Detecta si el informe ya trae marcadores de gráficos. */
export function hasInsightChartMarkers(markdown) {
  if (!markdown || typeof markdown !== 'string') return false;
  return /<!--\s*INSIGHT_CHART:\s*[a-z_]+\s*-->/i.test(markdown);
}

/**
 * Parte el Markdown en bloques de texto y slots de gráfico.
 * @returns {Array<{ type: 'md'; content: string } | { type: 'chart'; id: string }>}
 */
export function splitReportMarkdownByChartMarkers(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return [{ type: 'md', content: '' }];
  }
  const re = /<!--\s*INSIGHT_CHART:\s*([a-z_]+)\s*-->/gi;
  /** @type {Array<{ type: 'md'; content: string } | { type: 'chart'; id: string }>} */
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    parts.push({ type: 'md', content: markdown.slice(last, m.index) });
    parts.push({ type: 'chart', id: m[1].toLowerCase() });
    last = m.index + m[0].length;
  }
  parts.push({ type: 'md', content: markdown.slice(last) });
  return parts;
}
