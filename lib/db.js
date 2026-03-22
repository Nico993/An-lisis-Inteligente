import fs from 'fs';
import path from 'path';
import { ingestExcelToDatabase } from './excelIngest.js';

let _db;
let _ingestedXlsxMtime = 0;

function defaultXlsxPath() {
  const env = process.env.DATA_XLSX_PATH;
  if (env && fs.existsSync(env)) return env;
  const root = process.cwd();
  const candidates = [
    path.join(root, 'Sistema de Análisis Inteligente para Operaciones Rappi - Dummy Data.xlsx'),
    path.join(root, 'data', 'dummy.xlsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function dbFilePath() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'app.db');
}

export function getDbPath() {
  return dbFilePath();
}

export function getDefaultXlsxPath() {
  return defaultXlsxPath();
}

export async function getDb() {
  const { default: Database } = await import('better-sqlite3');
  const dbPath = dbFilePath();
  const xlsxPath = defaultXlsxPath();
  const xlsxStat = fs.existsSync(xlsxPath) ? fs.statSync(xlsxPath) : null;
  const dbExists = fs.existsSync(dbPath);

  const mustReingest =
    xlsxStat &&
    (!dbExists || !fs.statSync(dbPath).mtimeMs || fs.statSync(dbPath).mtimeMs < xlsxStat.mtimeMs);

  if (!_db) {
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }

  if (xlsxStat && (mustReingest || _ingestedXlsxMtime < xlsxStat.mtimeMs)) {
    ingestExcelToDatabase(_db, xlsxPath);
    _ingestedXlsxMtime = xlsxStat.mtimeMs;
  }

  if (!xlsxStat && !dbExists) {
    console.warn('[db] Excel not found at', xlsxPath, '- run with DATA_XLSX_PATH or add the file.');
  }

  return _db;
}
