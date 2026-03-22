/**
 * Evidencia estructurada para explicar crecimiento de órdenes por zona (heurística, no causalidad).
 * La tabla `orders` no incluye `zone_type` (solo geografía + volumen); los KPIs salen de `metrics` por segmento.
 */
import { z } from 'zod';

const KPI_METRICS = [
  'Perfect Orders',
  'Lead Penetration',
  'Gross Profit UE',
  'Non-Pro PTC > OP',
];

export const analizarCrecimientoSchema = z.object({
  country: z.string().min(1).max(8).optional(),
  top_n: z.number().int().min(1).max(50).default(10),
});

/**
 * @param {import('better-sqlite3').Database} db
 * @param {unknown} raw
 */
export function runAnalizarCrecimientoOrdenes(db, raw) {
  const parsed = analizarCrecimientoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };

  const { country, top_n: topN } = parsed.data;

  let sql = `
    SELECT country, city, zone, metric,
      l0w, l1w, l2w, l3w, l4w, l5w
    FROM orders
    WHERE metric IS NOT NULL AND (LOWER(metric) LIKE '%order%' OR metric = 'Orders')
      AND l0w IS NOT NULL AND l5w IS NOT NULL AND abs(l5w) > 1e-12
  `;
  /** @type {unknown[]} */
  const vals = [];
  if (country) {
    sql += ` AND country = ?`;
    vals.push(country.toUpperCase());
  }
  const rows = db.prepare(sql).all(...vals);

  /** @type {Map<string, object>} */
  const byZoneKey = new Map();
  for (const r of rows) {
    const l0 = Number(r.l0w);
    const l5 = Number(r.l5w);
    if (!Number.isFinite(l0) || !Number.isFinite(l5)) continue;
    const growth_pct = ((l0 - l5) / Math.abs(l5)) * 100;
    const key = `${r.country}|${r.city}|${r.zone}`;
    const row = {
      country: r.country,
      city: r.city,
      zone: r.zone,
      zone_type: null,
      metric: r.metric,
      l0w_orders: l0,
      l5w_orders: l5,
      growth_pct_l0w_vs_l5w: growth_pct,
      orders_weeks: {
        l5w: l5,
        l4w: r.l4w != null ? Number(r.l4w) : null,
        l3w: r.l3w != null ? Number(r.l3w) : null,
        l2w: r.l2w != null ? Number(r.l2w) : null,
        l1w: r.l1w != null ? Number(r.l1w) : null,
        l0w: l0,
      },
    };
    const prev = byZoneKey.get(key);
    if (!prev || growth_pct > prev.growth_pct_l0w_vs_l5w) {
      byZoneKey.set(key, row);
    }
  }

  const scored = [...byZoneKey.values()]
    .sort((a, b) => b.growth_pct_l0w_vs_l5w - a.growth_pct_l0w_vs_l5w)
    .slice(0, topN);

  const kpiRowsStmt = db.prepare(`
    SELECT zone_type, metric, l0w, l1w, l2w
    FROM metrics
    WHERE country = ? AND city = ? AND zone = ?
      AND metric IN (${KPI_METRICS.map(() => '?').join(',')})
      AND l0w IS NOT NULL
  `);

  const metrics_snapshot = [];
  for (const zrow of scored) {
    const mrows = kpiRowsStmt.all(zrow.country, zrow.city, zrow.zone, ...KPI_METRICS);

    /** @type {Map<string | null, typeof mrows>} */
    const byZt = new Map();
    for (const m of mrows) {
      const zt = m.zone_type != null && String(m.zone_type).trim() !== '' ? m.zone_type : null;
      if (!byZt.has(zt)) byZt.set(zt, []);
      byZt.get(zt).push(m);
    }

    if (byZt.size === 0) {
      metrics_snapshot.push({
        zone_key: `${zrow.country}|${zrow.city}|${zrow.zone}`,
        zone_type: null,
        orders_growth_pct: zrow.growth_pct_l0w_vs_l5w,
        kpis: [],
      });
      continue;
    }

    for (const [zt, kpiList] of byZt) {
      const byMetric = new Map();
      for (const m of kpiList) {
        if (!byMetric.has(m.metric)) byMetric.set(m.metric, m);
      }
      const kpis = [...byMetric.values()].map((m) => ({
        metric: m.metric,
        l0w: m.l0w != null ? Number(m.l0w) : null,
        l1w: m.l1w != null ? Number(m.l1w) : null,
        l2w: m.l2w != null ? Number(m.l2w) : null,
      }));
      metrics_snapshot.push({
        zone_key: zt
          ? `${zrow.country}|${zrow.city}|${zrow.zone}|${zt}`
          : `${zrow.country}|${zrow.city}|${zrow.zone}`,
        zone_type: zt,
        orders_growth_pct: zrow.growth_pct_l0w_vs_l5w,
        kpis,
      });
    }
  }

  return {
    ok: true,
    definition:
      'Crecimiento de volumen de órdenes: ((l0w − l5w) / |l5w|) × 100 sobre la tabla `orders` (sin `zone_type`; una fila ganadora por country|city|zone). Los KPIs operativos se leen de `metrics` por cada `zone_type` presente en esa zona.',
    top_growth_zones: scored,
    metrics_snapshot,
    notes: [
      'Las órdenes son a nivel zona; `metrics_snapshot` repite el mismo `orders_growth_pct` por cada segmento `zone_type` con KPIs en `metrics`.',
      'Usá estos números solo como evidencia asociativa; no implica causa.',
      'Para hipótesis, contrastá KPIs en la zona con el crecimiento de órdenes y calificá cada hipótesis (consistente / no observada en datos).',
    ],
  };
}
