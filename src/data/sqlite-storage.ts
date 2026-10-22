import type { StorageAdapter } from './storage';

type Statement = { statement: string; values: any[] };
interface SQLitePort {
  query(statement: string, values?: any[]): Promise<{ values?: any[] }>;
  executeSet(statements: Statement[], transaction?: boolean): Promise<unknown>;
}

export function sqliteStorage(db: SQLitePort): StorageAdapter {
  return {
    async read() {
      const chunks = await db.query('SELECT id, value FROM app_state_chunks ORDER BY id');
      if (chunks.values?.length) {
        if (chunks.values.some((row, index) => row.id !== index)) throw new Error('Dados locais incompletos.');
        return chunks.values.map(row => row.value).join('');
      }
      // Read old single-row snapshots in pieces too, avoiding CursorWindow limits.
      const legacy = await db.query('SELECT length(value) AS size FROM app_state WHERE id = 1');
      if (!legacy.values?.length) return null;
      let result = '';
      for (let offset = 1; offset <= legacy.values[0].size; offset += 65536) {
        const piece = await db.query('SELECT substr(value, ?, 65536) AS value FROM app_state WHERE id = 1', [offset]);
        result += piece.values?.[0]?.value ?? '';
      }
      return result;
    },
    async write(value) {
      // Unicode-aware splitting preserves emoji/surrogate pairs. Small rows avoid
      // Android CursorWindow limits; the transaction protects the previous snapshot.
      const chunks = value.match(/[\s\S]{1,65536}/gu) ?? [''];
      await db.executeSet([
        { statement: 'DELETE FROM app_state_chunks', values: [] },
        ...chunks.map((chunk, id) => ({ statement: 'INSERT INTO app_state_chunks (id, value) VALUES (?, ?)', values: [id, chunk] })),
        { statement: 'DELETE FROM app_state', values: [] },
      ], true);
    },
  };
}
