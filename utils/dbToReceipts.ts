import { Database } from "bun:sqlite";

const db = new Database('data.db');

const results = db.query(`
  SELECT id, text, created_at
  FROM entries
  ORDER BY created_at DESC
`).all();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const res = results.map((entry: any) => ({
  uuid: entry.id,
  text: entry.text,
  timestamp: entry.created_at
}))

console.log(JSON.stringify(res, null, 2));