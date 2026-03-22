import { z } from 'zod';
import { evaluate, mean, sum, min, max, median, std } from 'mathjs';
import { runQueryDatos } from './queryBuilder.js';
import { runAnalizarCrecimientoOrdenes } from './orderGrowthAnalysis.js';
import { findMetricEntries, getDictionaryText } from './metricDictionary.js';

const chartSpecSchema = z.object({
  type: z.enum(['line', 'bar']),
  title: z.string().optional(),
  labels: z.array(z.string()),
  series: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.number()),
    })
  ),
});

const calcularSchema = z.object({
  expression: z.string().max(800),
  variables: z.record(z.number()),
});

function runCalcular(raw) {
  const parsed = calcularSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const { expression, variables } = parsed.data;
  const scope = {
    ...variables,
    mean,
    sum,
    min,
    max,
    median,
    std,
  };
  try {
    const value = evaluate(expression, scope);
    const num = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
    if (!Number.isFinite(num)) {
      return { ok: false, error: 'Resultado no numérico' };
    }
    return { ok: true, value: num };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function runGenerarGrafico(raw) {
  const parsed = chartSpecSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
  const spec = parsed.data;
  for (const s of spec.series) {
    if (s.values.length !== spec.labels.length) {
      return {
        ok: false,
        error: `Serie "${s.name}": longitud de values (${s.values.length}) no coincide con labels (${spec.labels.length})`,
      };
    }
  }
  return { ok: true, chart: spec };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} name
 * @param {unknown} args
 */
export function executeTool(db, name, args) {
  if (name === 'query_datos') {
    return runQueryDatos(db, args);
  }
  if (name === 'analizar_crecimiento_ordenes') {
    return runAnalizarCrecimientoOrdenes(db, args);
  }
  if (name === 'calcular') {
    return runCalcular(args);
  }
  if (name === 'generar_grafico') {
    return runGenerarGrafico(args);
  }
  if (name === 'obtener_diccionario_metricas') {
    const q = args && typeof args.query === 'string' ? args.query : '';
    const entries = findMetricEntries(q);
    return {
      ok: true,
      entries,
      full_text: getDictionaryText(),
    };
  }
  if (name === 'obtener_schema_columnas') {
    const rows = db.prepare('SELECT column_name, type, examples, description FROM schema_summary').all();
    return { ok: true, rows };
  }
  return { ok: false, error: `Unknown tool: ${name}` };
}
