import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { sqliteStorage } from '../src/data/sqlite-storage.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE app_state (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE app_state_chunks (id INTEGER PRIMARY KEY, value TEXT NOT NULL);');
  const storage = sqliteStorage({
    async query(sql, values = []) { return { values: db.prepare(sql).all(...values) }; },
    async executeSet(statements) {
      db.exec('BEGIN');
      try { for (const { statement, values } of statements) db.prepare(statement).run(...values); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  });
  return { db, storage };
}
test('SQLite reads large legacy snapshots and writes small Unicode-safe rows', async () => {
  const { db, storage } = setup();
  try {
    const snapshot = JSON.stringify({ text: 'Obra 🏗️ São Paulo '.repeat(150000) });
    db.prepare('INSERT INTO app_state VALUES (1, ?)').run(snapshot);
    assert.equal(await storage.read(), snapshot);
    await storage.write(snapshot);
    assert.equal(await storage.read(), snapshot);
    assert.equal(db.prepare('SELECT count(*) AS count FROM app_state').get()?.count, 0);
    assert.ok(Number(db.prepare('SELECT max(length(value)) AS size FROM app_state_chunks').get()?.size) <= 65536);
  } finally { db.close(); }
});
test('SQLite transaction rolls back failed replacement of all chunks', async () => {
  const { db, storage } = setup();
  try {
    await storage.write('original');
    db.exec("CREATE TRIGGER fail_write BEFORE INSERT ON app_state_chunks WHEN NEW.id = 1 BEGIN SELECT RAISE(ABORT, 'disk error'); END;");
    await assert.rejects(storage.write('x'.repeat(140000)), /disk error/);
    assert.equal(await storage.read(), 'original');
  } finally { db.close(); }
});
