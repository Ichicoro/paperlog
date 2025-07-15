import { Database } from 'bun:sqlite';

export const autoMigrateDb = () => {
  const db = new Database('data.db');

  const stmt = db.prepare("SELECT id FROM entries LIMIT 1");
  stmt.get();
  const type = stmt.declaredTypes[0];
  if (type && type === 'INTEGER') {
    // If the type is INTEGER, we need to update the table schema
    console.log('Updating entries table schema from INTEGER to TEXT for id column');
    // update table from `id INTEGER PRIMARY KEY AUTOINCREMENT` to `id TEXT PRIMARY KEY`
    db.run(`
ALTER TABLE entries RENAME TO old_entries;
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO entries (id, text, created_at)
SELECT uuid(), text, created_at FROM old_entries;
DROP TABLE old_entries;
`);
  } else {
    console.log('No schema update needed for entries table');
  }
}
