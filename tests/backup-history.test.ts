import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/data/store.ts';

async function fixture() {
  let saved: string | null = null;
  const storage = { read: async () => saved, write: async (value: string) => { saved = value; } };
  const store = new LocalStore(storage);
  await store.initialize();
  return { store, storage };
}

test('export alone does not claim a saved copy; confirmation tracks the exported revision', async () => {
  const { store, storage } = await fixture();
  assert.equal((await store.backupStatus()).reminderDue, false);
  await store.request('/works', 'POST', { name: 'Obra fictícia', address: 'Rua de teste, 1' });
  assert.equal((await store.backupStatus()).reminderDue, true);
  const text = await store.exportBackup();
  assert.equal((await store.backupStatus()).savedAt, null);
  await store.request('/tasks', 'POST', { title: 'Tarefa após exportar' });
  await store.confirmBackup(text);
  assert.equal((await store.backupStatus()).hasChanges, true);
  assert.equal((await store.backupStatus()).reminderDue, false);
  assert.equal((await store.backupStatus(Date.now() + 8 * 86400000)).reminderDue, true);
  const latest = await store.exportBackup();
  await store.confirmBackup(latest);
  const reopened = new LocalStore(storage); await reopened.initialize();
  assert.equal((await reopened.backupStatus()).hasChanges, false);
  assert.equal((await reopened.backupStatus()).savedAt, JSON.parse(latest).exportedAt);
});

test('reminder postponement persists, and failed confirmation preserves history and records', async () => {
  const { store, storage } = await fixture();
  await store.request('/works', 'POST', { name: 'Obra fictícia', address: 'Rua de teste, 2' });
  await store.postponeBackupReminder();
  const reopened = new LocalStore(storage); await reopened.initialize();
  assert.equal((await reopened.backupStatus()).reminderDue, false);
  assert.equal((await reopened.backupStatus(Date.now() + 2 * 86400000)).reminderDue, true);
  const text = await reopened.exportBackup();
  storage.write = async () => { throw new Error('disk full'); };
  await assert.rejects(reopened.confirmBackup(text), /disk full/);
  assert.equal((await reopened.backupStatus()).savedAt, null);
  assert.equal((await reopened.request('/works')).length, 1);
});

test('upgrading legacy v1/v2 snapshots preserves all collections and old backups remain restorable', async () => {
  const { store, storage } = await fixture();
  const work = await store.request('/works', 'POST', { name: 'Obra fictícia', address: 'Rua de teste, 3' });
  await store.request('/tasks', 'POST', { title: 'Tarefa antiga', workUuid: work.uuid });
  await store.request('/expenses', 'POST', { name: 'Material', amount: 42.75, type: 'material', workUuid: work.uuid });
  const backup = JSON.parse(await store.exportBackup());
  delete backup.state.backupHistory;
  for (const version of [1, 2]) {
    backup.state.version = version;
    await storage.write(JSON.stringify(backup.state));
    const updated = new LocalStore(storage); await updated.initialize();
    const current = JSON.parse(await updated.exportBackup());
    assert.deepEqual(current.state.tables, backup.state.tables);
    assert.equal(current.state.user.uuid, backup.state.user.uuid);
    assert.equal((await updated.backupStatus()).savedAt, null);
    await updated.restoreBackup(JSON.stringify(backup));
    assert.deepEqual(JSON.parse(await updated.exportBackup()).state.tables, backup.state.tables);
  }
});

test('restoration resets device confirmation and invalidates an outstanding export', async () => {
  const { store } = await fixture();
  await store.request('/works', 'POST', { name: 'Obra fictícia', address: 'Rua de teste, 4' });
  const first = await store.exportBackup(); await store.confirmBackup(first);
  const withHistory = await store.exportBackup();
  await store.restoreBackup(withHistory);
  assert.equal((await store.backupStatus()).savedAt, null);
  assert.equal((await store.backupStatus()).reminderDue, true);
  await assert.rejects(store.confirmBackup(withHistory), /Exporte um novo backup/);
});
