import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { WEEK_KEYS } from './weekConstants.js';

const METRIC_ROLL_COLS = [
  'L8W_ROLL',
  'L7W_ROLL',
  'L6W_ROLL',
  'L5W_ROLL',
  'L4W_ROLL',
  'L3W_ROLL',
  'L2W_ROLL',
  'L1W_ROLL',
  'L0W_ROLL',
];

const ORDER_WEEK_COLS = ['L8W', 'L7W', 'L6W', 'L5W', 'L4W', 'L3W', 'L2W', 'L1W', 'L0W'];

function dropTables(db) {
  db.exec(`
    DROP TABLE IF EXISTS schema_summary;
    DROP TABLE IF EXISTS metrics;
    DROP TABLE IF EXISTS orders;
  `);
}

export function ingestExcelToDatabase(db, filePath) {
  dropTables(db);
  const wb = XLSX.readFile(filePath);

  db.exec(`
    CREATE TABLE metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country TEXT,
      city TEXT,
      zone TEXT,
      zone_type TEXT,
      zone_prioritization TEXT,
      metric TEXT,
      l8w REAL, l7w REAL, l6w REAL, l5w REAL, l4w REAL, l3w REAL, l2w REAL, l1w REAL, l0w REAL
    );
    CREATE INDEX idx_metrics_country ON metrics(country);
    CREATE INDEX idx_metrics_city ON metrics(city);
    CREATE INDEX idx_metrics_zone ON metrics(country, city, zone);
    CREATE INDEX idx_metrics_metric ON metrics(metric);
    CREATE INDEX idx_metrics_zone_type ON metrics(zone_type);

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country TEXT,
      city TEXT,
      zone TEXT,
      metric TEXT,
      l8w REAL, l7w REAL, l6w REAL, l5w REAL, l4w REAL, l3w REAL, l2w REAL, l1w REAL, l0w REAL
    );
    CREATE INDEX idx_orders_country ON orders(country);
    CREATE INDEX idx_orders_zone ON orders(country, city, zone);

    CREATE TABLE schema_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      column_name TEXT,
      type TEXT,
      examples TEXT,
      description TEXT
    );
  `);

  const wsM = wb.Sheets['RAW_INPUT_METRICS'];
  const rowsM = XLSX.utils.sheet_to_json(wsM, { defval: null });
  const insM = db.prepare(`
    INSERT INTO metrics (country, city, zone, zone_type, zone_prioritization, metric,
      l8w, l7w, l6w, l5w, l4w, l3w, l2w, l1w, l0w)
    VALUES (@country, @city, @zone, @zone_type, @zone_prioritization, @metric,
      @l8w, @l7w, @l6w, @l5w, @l4w, @l3w, @l2w, @l1w, @l0w)
  `);

  const txM = db.transaction((items) => {
    for (const r of items) {
      const o = {
        country: r.COUNTRY ?? null,
        city: r.CITY ?? null,
        zone: r.ZONE ?? null,
        zone_type: r.ZONE_TYPE ?? null,
        zone_prioritization: r.ZONE_PRIORITIZATION ?? null,
        metric: r.METRIC ?? null,
      };
      for (let i = 0; i < WEEK_KEYS.length; i++) {
        const v = r[METRIC_ROLL_COLS[i]];
        o[WEEK_KEYS[i]] = v === null || v === undefined || v === '' ? null : Number(v);
      }
      insM.run(o);
    }
  });
  txM(rowsM);

  const wsO = wb.Sheets['RAW_ORDERS'];
  const rowsO = XLSX.utils.sheet_to_json(wsO, { defval: null });
  const insO = db.prepare(`
    INSERT INTO orders (country, city, zone, metric, l8w, l7w, l6w, l5w, l4w, l3w, l2w, l1w, l0w)
    VALUES (@country, @city, @zone, @metric, @l8w, @l7w, @l6w, @l5w, @l4w, @l3w, @l2w, @l1w, @l0w)
  `);

  const txO = db.transaction((items) => {
    for (const r of items) {
      const o = {
        country: r.COUNTRY ?? null,
        city: r.CITY ?? null,
        zone: r.ZONE ?? null,
        metric: r.METRIC ?? null,
      };
      for (let i = 0; i < WEEK_KEYS.length; i++) {
        const col = ORDER_WEEK_COLS[i];
        const v = r[col];
        o[WEEK_KEYS[i]] = v === null || v === undefined || v === '' ? null : Number(v);
      }
      insO.run(o);
    }
  });
  txO(rowsO);

  const wsS = wb.Sheets['RAW_SUMMARY'];
  if (wsS) {
    const rowsS = XLSX.utils.sheet_to_json(wsS, { defval: null });
    const insS = db.prepare(`
      INSERT INTO schema_summary (column_name, type, examples, description)
      VALUES (@column_name, @type, @examples, @description)
    `);
    const txS = db.transaction((items) => {
      for (const r of items) {
        insS.run({
          column_name: r.Column ?? r.column ?? '',
          type: r.Type ?? r.type ?? '',
          examples: r.Examples != null ? String(r.Examples) : '',
          description:
            r['Description (inferred)'] ?? r.Description ?? r.description ?? '',
        });
      }
    });
    txS(rowsS);
  }

  return { metrics: rowsM.length, orders: rowsO.length };
}
