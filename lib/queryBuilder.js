import { z } from 'zod';
import { WEEK_KEYS } from './weekConstants.js';

const METRIC_DIMS = ['country', 'city', 'zone', 'zone_type', 'zone_prioritization', 'metric'];
const ORDER_DIMS = ['country', 'city', 'zone', 'metric'];

const filterSchema = z.object({
  field: z.string(),
  op: z.enum(['eq', 'ne', 'in', 'like', 'gte', 'lte']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

/**
 * Acepta nombres de campo como en el schema del Excel (ZONE, METRIC) o SQL (zone, metric).
 * @param {unknown} raw
 */
export function normalizeQueryDatosParams(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const out = { ...raw };
  if (Array.isArray(out.filters)) {
    out.filters = out.filters.map((f) => {
      if (f && typeof f === 'object' && typeof f.field === 'string') {
        return { ...f, field: f.field.toLowerCase() };
      }
      return f;
    });
  }
  if (Array.isArray(out.group_by)) {
    out.group_by = out.group_by.map((g) => (typeof g === 'string' ? g.toLowerCase() : g));
  }
  if (out.order_by && typeof out.order_by === 'object' && typeof out.order_by.field === 'string') {
    out.order_by = { ...out.order_by, field: out.order_by.field.toLowerCase() };
  }
  if (typeof out.week_field === 'string') {
    out.week_field = out.week_field.toLowerCase();
  }
  if (Array.isArray(out.include_weeks)) {
    out.include_weeks = out.include_weeks.map((w) => (typeof w === 'string' ? w.toLowerCase() : w));
  }
  return out;
}

export const queryDatosSchema = z
  .object({
    source: z.enum(['metrics', 'orders']),
    filters: z.array(filterSchema).default([]),
    /** list rows, or aggregate by group_by */
    mode: z.enum(['rows', 'aggregate']).default('rows'),
    group_by: z.array(z.string()).optional(),
    /** Which week column to use for sorting / aggregation (default l0w = current week) */
    week_field: z.enum(WEEK_KEYS).default('l0w'),
    /** For trend questions: include these week columns in the result */
    include_weeks: z.array(z.enum(WEEK_KEYS)).optional(),
    aggregation: z.enum(['none', 'avg', 'sum', 'min', 'max']).default('none'),
    order_by: z
      .object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
      })
      .optional(),
    limit: z.number().int().min(1).max(500).default(100),
  })
  .superRefine((data, ctx) => {
    const dims = data.source === 'metrics' ? METRIC_DIMS : ORDER_DIMS;
    for (const f of data.filters) {
      if (!dims.includes(f.field) && !WEEK_KEYS.includes(f.field)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid filter field "${f.field}" for ${data.source}`,
        });
      }
    }
    if (data.mode === 'aggregate') {
      if (!data.group_by || data.group_by.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mode "aggregate" requires group_by',
        });
      }
      if (data.aggregation === 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mode "aggregate" requires aggregation other than "none"',
        });
      }
    }
    if (data.group_by) {
      for (const g of data.group_by) {
        if (!dims.includes(g)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid group_by "${g}"`,
          });
        }
      }
    }
  });

function buildWhereClauses(filters) {
  const parts = [];
  const values = [];
  for (const f of filters) {
    const col = f.field;
    if (f.op === 'eq') {
      parts.push(`${col} = ?`);
      values.push(f.value);
    } else if (f.op === 'ne') {
      parts.push(`${col} != ?`);
      values.push(f.value);
    } else if (f.op === 'in') {
      const arr = Array.isArray(f.value) ? f.value : [f.value];
      parts.push(`${col} IN (${arr.map(() => '?').join(',')})`);
      values.push(...arr);
    } else if (f.op === 'like') {
      parts.push(`${col} LIKE ?`);
      values.push(`%${f.value}%`);
    } else if (f.op === 'gte') {
      parts.push(`${col} >= ?`);
      values.push(f.value);
    } else if (f.op === 'lte') {
      parts.push(`${col} <= ?`);
      values.push(f.value);
    }
  }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', values };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {unknown} rawParams
 */
export function runQueryDatos(db, rawParams) {
  const parsed = queryDatosSchema.safeParse(normalizeQueryDatosParams(rawParams));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten() };
  }
  const p = parsed.data;
  const table = p.source === 'orders' ? 'orders' : 'metrics';
  const { sql: whereSql, values: whereVals } = buildWhereClauses(p.filters);
  const dims = p.source === 'metrics' ? METRIC_DIMS : ORDER_DIMS;

  if (p.mode === 'rows') {
    const weeks =
      p.include_weeks && p.include_weeks.length > 0 ? p.include_weeks : WEEK_KEYS;

    const baseCols =
      p.source === 'metrics'
        ? ['country', 'city', 'zone', 'zone_type', 'zone_prioritization', 'metric']
        : ['country', 'city', 'zone', 'metric'];

    const selectCols = [...baseCols, ...weeks];
    const uniqueCols = [...new Set(selectCols)];
    let sql = `SELECT ${uniqueCols.join(', ')} FROM ${table} ${whereSql}`;

    const orderField = p.order_by?.field || p.week_field;
    const allowedOrder = [...dims, ...WEEK_KEYS];
    if (orderField && allowedOrder.includes(orderField)) {
      sql += ` ORDER BY ${orderField} ${p.order_by?.direction === 'asc' ? 'ASC' : 'DESC'}`;
    }
    sql += ` LIMIT ${p.limit}`;
    const rows = db.prepare(sql).all(...whereVals);
    return { ok: true, rows, meta: { table, sql } };
  }

  // aggregate
  const groupBy = p.group_by?.length ? p.group_by : null;
  if (!groupBy || groupBy.length === 0) {
    return { ok: false, error: 'aggregate mode requires group_by' };
  }

  const aggFn = p.aggregation === 'none' ? 'avg' : p.aggregation;
  const weekCol = p.week_field;
  const selectParts = [...groupBy.map((g) => g), `${aggFn}(${weekCol}) AS agg_value`];
  let sql = `SELECT ${selectParts.join(', ')} FROM ${table} ${whereSql} GROUP BY ${groupBy.join(', ')}`;

  const orderField = p.order_by?.field || 'agg_value';
  if (orderField === 'agg_value' || groupBy.includes(orderField)) {
    sql += ` ORDER BY ${orderField} ${p.order_by?.direction === 'asc' ? 'ASC' : 'DESC'}`;
  } else {
    sql += ` ORDER BY agg_value DESC`;
  }
  sql += ` LIMIT ${p.limit}`;

  const rows = db.prepare(sql).all(...whereVals);
  return { ok: true, rows, meta: { table, sql } };
}

export { METRIC_DIMS, ORDER_DIMS };
