/**
 * Extrae texto de razonamiento si el proveedor lo incluye en el mensaje (modelos o1/o3, etc.).
 */
export function extractReasoningFromMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (typeof msg.reasoning === 'string' && msg.reasoning.trim()) return msg.reasoning.trim();
  if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    return msg.reasoning_content.trim();
  }
  if (typeof msg.thinking === 'string' && msg.thinking.trim()) return msg.thinking.trim();
  if (Array.isArray(msg.reasoning_details) && msg.reasoning_details.length) {
    const parts = msg.reasoning_details
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d.text === 'string') return d.text;
        if (d && typeof d.content === 'string') return d.content;
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('\n\n');
  }
  return null;
}

export function truncateStr(s, max = 600) {
  if (s == null) return '';
  const t = String(s);
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function truncateCell(v, max = 72) {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function flattenError(err) {
  if (err == null) return 'Error desconocido';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    if (Array.isArray(err.formErrors) && err.formErrors.length) return err.formErrors.join('; ');
    if (err.fieldErrors && typeof err.fieldErrors === 'object') {
      const parts = Object.entries(err.fieldErrors).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : [`${k}: ${v}`]
      );
      if (parts.length) return parts.join('; ');
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/** Resumen para el trace (incluye muestra de filas en `query_datos`). */
export function summarizeToolResult(name, result) {
  if (!result.ok) {
    return {
      ok: false,
      tool: name,
      error: flattenError(result.error),
    };
  }
  switch (name) {
    case 'query_datos': {
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const sample = rows.slice(0, 8);
      const columns = sample.length ? Object.keys(sample[0]) : [];
      const sampleRows = sample.map((row) => {
        const out = {};
        for (const k of columns) {
          out[k] = truncateCell(row[k], 96);
        }
        return out;
      });
      return {
        ok: true,
        tool: name,
        kind: 'query',
        rowCount: rows.length,
        columns,
        sampleRows,
        table: result.meta?.table,
        sqlPreview: result.meta?.sql ? truncateStr(result.meta.sql, 360) : undefined,
      };
    }
    case 'calcular':
      return {
        ok: true,
        tool: name,
        kind: 'calc',
        value: result.value,
      };
    case 'generar_grafico': {
      const ch = result.chart;
      return {
        ok: true,
        tool: name,
        kind: 'chart',
        chartType: ch?.type,
        title: ch?.title,
        labelCount: ch?.labels?.length ?? 0,
        seriesNames: (ch?.series || []).map((s) => s.name),
      };
    }
    case 'obtener_diccionario_metricas': {
      const entries = result.entries || [];
      const previewNames = entries.slice(0, 6).map((e) => (e && e.name ? e.name : '')).filter(Boolean);
      return {
        ok: true,
        tool: name,
        kind: 'dictionary',
        matchCount: entries.length,
        previewNames,
      };
    }
    case 'analizar_crecimiento_ordenes': {
      const top = result.top_growth_zones || [];
      return {
        ok: true,
        tool: name,
        kind: 'growth',
        topCount: top.length,
        previewZones: top.slice(0, 5).map((z) => ({
          country: z.country,
          zone: z.zone,
          growth_pct: z.growth_pct_l0w_vs_l5w,
        })),
      };
    }
    case 'obtener_schema_columnas': {
      const rows = result.rows || [];
      const preview = rows.slice(0, 12).map((r) => ({
        column_name: r.column_name,
        type: r.type,
        description: r.description ? truncateStr(r.description, 80) : undefined,
      }));
      return {
        ok: true,
        tool: name,
        kind: 'schema',
        columnCount: rows.length,
        preview,
      };
    }
    default:
      return { ok: true, tool: name, kind: 'unknown' };
  }
}
