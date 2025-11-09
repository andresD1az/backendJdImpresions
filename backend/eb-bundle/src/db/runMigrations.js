import fs from 'fs';
import path from 'path';
import url from 'url';
import { query } from '../config/db.js';

export async function runMigrations() {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, './migrations.sql');
  const sql = fs.readFileSync(filePath, 'utf8');
  // naive splitter: run whole file as one statement batch
  await query(sql);
}
