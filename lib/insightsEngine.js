/**
 * Hechos determinísticos para el reporte de insights (sin LLM).
 */

import { METRIC_DICTIONARY_KPI_NAMES } from './metricDictionary.js';

/** Pares (columna nueva, columna vieja, etiqueta) para WoW en ventanas consecutivas. */
const WOW_WINDOW_DEFS = [
  ['l0w', 'l1w', 'l0w_vs_l1w'],
  ['l1w', 'l2w', 'l1w_vs_l2w'],
  ['l2w', 'l3w', 'l2w_vs_l3w'],
  ['l3w', 'l4w', 'l3w_vs_l4w'],
  ['l4w', 'l5w', 'l4w_vs_l5w'],
  ['l5w', 'l6w', 'l5w_vs_l6w'],
  ['l6w', 'l7w', 'l6w_vs_l7w'],
  ['l7w', 'l8w', 'l7w_vs_l8w'],
];

const EPS = 1e-12;
const ANOMALY_ROW_CAP = 55;

/** Mínimo de zonas alineadas para considerar un par en correlaciones. */
const CORR_MIN_ZONES = 20;
/** Cantidad de pares (por |Pearson|) que se exponen en hechos y gráficos. */
const CORR_TOP_K = 22;

/** Umbrales oportunidades (ajustables). */
const OPP_TENSION_LP_MIN = 0.6;
const OPP_TENSION_PO_MAX = 0.5;
const OPP_EFFICIENCY_LP_MAX = 0.35;
const OPP_EFFICIENCY_PO_MIN = 0.65;
const OPP_PRO_ADOPTION_MIN = 0.4;
const OPP_NONPRO_PTC_MAX = 0.25;

const ZONE_QUADRANT_LIMIT = 8;

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

function zoneKey(r) {
  return `${r.country}|${r.city}|${r.zone}|${r.zone_type}`;
}

/** Mediana de números finitos. */
function medianOf(nums) {
  const a = nums.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function computeWowAnomalies(db) {
  const parts = WOW_WINDOW_DEFS.map(([newCol, oldCol, label]) => {
    const sql = `
    SELECT country, city, zone, zone_type, metric,
      '${label}' AS wow_window,
      ${newCol} AS new_val,
      ${oldCol} AS old_val,
      ((${newCol} - ${oldCol}) / abs(${oldCol})) * 100.0 AS wow_pct
    FROM metrics
    WHERE ${oldCol} IS NOT NULL AND abs(${oldCol}) > ${EPS}
      AND ${newCol} IS NOT NULL
      AND abs(((${newCol} - ${oldCol}) / ${oldCol}) * 100.0) > 10
    `;
    return sql;
  });

  const sql = `
    SELECT * FROM (
      ${parts.join('\n    UNION ALL\n    ')}
    )
    ORDER BY abs(wow_pct) DESC
    LIMIT ${ANOMALY_ROW_CAP}
  `;

  return db.prepare(sql).all();
}

/**
 * Métricas presentes en DB que están en el diccionario de negocio (excluye Orders).
 * @param {import('better-sqlite3').Database} db
 */
function getCorrelationMetricNames(db) {
  const dict = new Set(METRIC_DICTIONARY_KPI_NAMES);
  const rows = db.prepare(`SELECT DISTINCT metric FROM metrics WHERE l0w IS NOT NULL`).all();
  const inDict = rows.map((r) => r.metric).filter((m) => m && dict.has(m));
  if (inDict.length >= 2) return [...new Set(inDict)].sort();
  const fallback = rows.map((r) => r.metric).filter(Boolean);
  return [...new Set(fallback)].sort();
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} metricNames
 * @returns {Map<string, Array<{country: string, city: string, zone: string, zone_type: string, metric: string, l0w: number}>>}
 */
function loadMetricRowsMap(db, metricNames) {
  const map = new Map();
  if (metricNames.length === 0) return map;
  const ph = metricNames.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT country, city, zone, zone_type, metric, l0w FROM metrics WHERE l0w IS NOT NULL AND metric IN (${ph})`
    )
    .all(...metricNames);
  for (const r of rows) {
    const m = r.metric;
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(r);
  }
  return map;
}

/**
 * @param {Array<{ country: string, city: string, zone: string, zone_type: string, m1: number, m2: number }>} points
 */
function buildQuadrantSamples(points) {
  if (points.length < 3) {
    return { zones_low_low: [], zones_high_high: [] };
  }
  const m1s = points.map((p) => p.m1);
  const m2s = points.map((p) => p.m2);
  const med1 = medianOf(m1s);
  const med2 = medianOf(m2s);
  if (med1 == null || med2 == null) {
    return { zones_low_low: [], zones_high_high: [] };
  }

  const lowLow = points
    .filter((p) => p.m1 <= med1 && p.m2 <= med2)
    .sort((a, b) => a.m1 + a.m2 - (b.m1 + b.m2))
    .slice(0, ZONE_QUADRANT_LIMIT);

  const highHigh = points
    .filter((p) => p.m1 >= med1 && p.m2 >= med2)
    .sort((a, b) => b.m1 + b.m2 - (a.m1 + a.m2))
    .slice(0, ZONE_QUADRANT_LIMIT);

  return { zones_low_low: lowLow, zones_high_high: highHigh };
}

/**
 * @param {Map<string, unknown[]>} rowsMap
 * @param {string} m1
 * @param {string} m2
 */
function correlationForPair(rowsMap, m1, m2) {
  const r1 = rowsMap.get(m1) || [];
  const r2 = rowsMap.get(m2) || [];
  const map2 = new Map();
  for (const r of r2) map2.set(zoneKey(r), r.l0w);
  const xs = [];
  const ys = [];
  const points = [];
  for (const a of r1) {
    const k = zoneKey(a);
    if (!map2.has(k)) continue;
    const v1 = Number(a.l0w);
    const v2 = Number(map2.get(k));
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    xs.push(v1);
    ys.push(v2);
    points.push({
      country: a.country,
      city: a.city,
      zone: a.zone,
      zone_type: a.zone_type,
      m1: v1,
      m2: v2,
    });
  }
  if (xs.length < CORR_MIN_ZONES) {
    return null;
  }
  const r = pearson(xs, ys);
  const { zones_low_low, zones_high_high } = buildQuadrantSamples(points);
  return {
    metric_a: m1,
    metric_b: m2,
    n: xs.length,
    pearson: r != null && !Number.isNaN(r) ? r : null,
    zones_low_low,
    zones_high_high,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function computeCorrelationsWithZones(db) {
  const names = getCorrelationMetricNames(db);
  if (names.length < 2) return [];

  const rowsMap = loadMetricRowsMap(db, names);
  const candidates = [];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const m1 = names[i];
      const m2 = names[j];
      const entry = correlationForPair(rowsMap, m1, m2);
      if (entry && entry.pearson != null) {
        candidates.push(entry);
      }
    }
  }

  candidates.sort((a, b) => Math.abs(Number(b.pearson)) - Math.abs(Number(a.pearson)));
  return candidates.slice(0, CORR_TOP_K);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {Array<{ kind: string; label: string; rows: object[] }>}
 */
function computeOpportunityBlocks(db) {
  /** @type {Array<{ kind: string; label: string; rows: object[] }>} */
  const blocks = [];

  try {
    const rows = db
      .prepare(
        `
      SELECT lp.country, lp.city, lp.zone, lp.zone_type,
        lp.l0w AS lead_penetration,
        po.l0w AS perfect_orders
      FROM metrics lp
      JOIN metrics po
        ON lp.country = po.country AND lp.city = po.city AND lp.zone = po.zone AND lp.zone_type = po.zone_type
      WHERE lp.metric = 'Lead Penetration' AND po.metric = 'Perfect Orders'
        AND lp.l0w IS NOT NULL AND po.l0w IS NOT NULL
        AND lp.l0w > ? AND po.l0w < ?
      ORDER BY lp.l0w DESC
      LIMIT 25
    `
      )
      .all(OPP_TENSION_LP_MIN, OPP_TENSION_PO_MAX);
    if (rows.length) {
      blocks.push({
        kind: 'tension_high_lp_low_perfect',
        label:
          'Alta cobertura (Lead Penetration) con calidad de entrega débil (Perfect Orders): revisar operación y fricción post-alta cobertura.',
        rows,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const rows = db
      .prepare(
        `
      SELECT lp.country, lp.city, lp.zone, lp.zone_type,
        lp.l0w AS lead_penetration,
        po.l0w AS perfect_orders
      FROM metrics lp
      JOIN metrics po
        ON lp.country = po.country AND lp.city = po.city AND lp.zone = po.zone AND lp.zone_type = po.zone_type
      WHERE lp.metric = 'Lead Penetration' AND po.metric = 'Perfect Orders'
        AND lp.l0w IS NOT NULL AND po.l0w IS NOT NULL
        AND lp.l0w < ? AND po.l0w > ?
      ORDER BY po.l0w DESC
      LIMIT 25
    `
      )
      .all(OPP_EFFICIENCY_LP_MAX, OPP_EFFICIENCY_PO_MIN);
    if (rows.length) {
      blocks.push({
        kind: 'efficiency_low_lp_high_perfect',
        label:
          'Baja expansión de tiendas (Lead Penetration) pero alta ejecución (Perfect Orders): oportunidad de crecimiento con base operativa sólida.',
        rows,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const rows = db
      .prepare(
        `
      SELECT pa.country, pa.city, pa.zone, pa.zone_type,
        pa.l0w AS pro_adoption,
        np.l0w AS nonpro_ptc
      FROM metrics pa
      JOIN metrics np
        ON pa.country = np.country AND pa.city = np.city AND pa.zone = np.zone AND pa.zone_type = np.zone_type
      WHERE pa.metric = 'Pro Adoption' AND np.metric = 'Non-Pro PTC > OP'
        AND pa.l0w IS NOT NULL AND np.l0w IS NOT NULL
        AND pa.l0w > ? AND np.l0w < ?
      ORDER BY pa.l0w DESC
      LIMIT 25
    `
      )
      .all(OPP_PRO_ADOPTION_MIN, OPP_NONPRO_PTC_MAX);
    if (rows.length) {
      blocks.push({
        kind: 'pro_mix_high_pro_low_nonpro_cvr',
        label:
          'Alta adopción Pro con conversión No Pro débil: revisar mix de usuarios y embudo fuera de Pro.',
        rows,
      });
    }
  } catch {
    /* ignore */
  }

  return blocks;
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function computeInsightFacts(db) {
  const anomalies = computeWowAnomalies(db);

  const trendsDown = db
    .prepare(
      `
    SELECT country, city, zone, zone_type, metric,
      l0w, l1w, l2w, l3w,
      (l3w - l0w) AS decline_span
    FROM metrics
    WHERE l0w IS NOT NULL AND l1w IS NOT NULL AND l2w IS NOT NULL AND l3w IS NOT NULL
      AND l0w < l1w AND l1w < l2w AND l2w < l3w
    ORDER BY (l3w - l0w) DESC
    LIMIT 40
  `
    )
    .all();

  const trendsUp = db
    .prepare(
      `
    SELECT country, city, zone, zone_type, metric,
      l0w, l1w, l2w, l3w,
      (l0w - l3w) AS improvement_span
    FROM metrics
    WHERE l0w IS NOT NULL AND l1w IS NOT NULL AND l2w IS NOT NULL AND l3w IS NOT NULL
      AND l0w > l1w AND l1w > l2w AND l2w > l3w
    ORDER BY (l0w - l3w) DESC
    LIMIT 40
  `
    )
    .all();

  const benchmark = db
    .prepare(
      `
    WITH stats AS (
      SELECT country, zone_type, metric,
        AVG(l0w) AS mu,
        AVG(l0w * l0w) AS ex2
      FROM metrics
      WHERE l0w IS NOT NULL
      GROUP BY country, zone_type, metric
    )
    SELECT m.country, m.zone_type, m.metric, m.zone, m.l0w, s.mu,
      (m.l0w - s.mu) / (CASE
        WHEN (s.ex2 - s.mu * s.mu) > 1e-18 THEN sqrt(s.ex2 - s.mu * s.mu)
        ELSE NULL
      END) AS zscore
    FROM metrics m
    JOIN stats s ON s.country = m.country AND s.zone_type = m.zone_type AND s.metric = m.metric
    WHERE m.l0w IS NOT NULL
      AND (s.ex2 - s.mu * s.mu) > 1e-18
      AND ABS((m.l0w - s.mu) / sqrt(s.ex2 - s.mu * s.mu)) > 2
    ORDER BY ABS((m.l0w - s.mu) / sqrt(s.ex2 - s.mu * s.mu)) DESC
    LIMIT 40
  `
    )
    .all();

  const correlations = computeCorrelationsWithZones(db);

  const opportunities = computeOpportunityBlocks(db);

  return {
    anomalies,
    trendsDown,
    trendsUp,
    benchmark,
    correlations,
    opportunities,
  };
}
