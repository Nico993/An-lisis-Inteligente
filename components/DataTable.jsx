'use client';

function rowsToCsv(rows) {
  if (!rows?.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = keys.map(esc).join(',');
  const lines = rows.map((r) => keys.map((k) => esc(r[k])).join(','));
  return [header, ...lines].join('\n');
}

export function DataTable({ rows, title }) {
  if (!rows?.length) return null;
  const keys = Object.keys(rows[0]);

  function downloadCsv() {
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'datos').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="data-table-wrap">
      {title ? (
        <div className="data-table-toolbar">
          <span className="data-table-caption">{title}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={downloadCsv}>
            CSV
          </button>
        </div>
      ) : null}
      <table className="data-table">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>{formatCell(r[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 ? (
        <p className="data-table-caption" style={{ marginTop: '0.5rem' }}>
          Mostrando 200 de {rows.length} filas. Exportá CSV para el total.
        </p>
      ) : null}
    </div>
  );
}

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Math.abs(v) < 1 && v !== 0) return v.toFixed(4);
    if (Math.abs(v) > 1000) return v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    return String(Math.round(v * 1e6) / 1e6);
  }
  return String(v);
}
