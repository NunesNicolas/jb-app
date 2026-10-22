import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/data/store.ts';

function memory() {
  let saved: string | null = null;
  return { read: async () => saved, write: async (value: string) => { saved = value; } };
}
async function fixture(storage = memory()) {
  const store = new LocalStore(storage); await store.initialize();
  const work = await store.request('/works', 'POST', { name: 'Minha obra', address: 'Rua Um, 10' });
  return { store, storage, work };
}

test('fresh installation starts empty, without registration or fictional records', async () => {
  const store = new LocalStore(memory()); await store.initialize();
  for (const key of ['works', 'tasks', 'expenses', 'revenues', 'groups', 'attachments', 'work-events']) assert.deepEqual(await store.request(`/${key}`), []);
  const user = await store.request('/users/me');
  assert.equal(user.email, ''); assert.notEqual(user.uuid, 'local-demo');
});

test('persists edits across launches and serializes concurrent writes', async () => {
  const { store, storage, work } = await fixture();
  const tasks = await Promise.all(Array.from({ length: 8 }, (_, i) => store.request('/api/tasks', 'POST', { title: `Tarefa ${i}`, workUuid: work.uuid })));
  await store.request(`/tasks/${tasks[0].uuid}`, 'PATCH', { status: 'done' });
  const reopened = new LocalStore(storage); await reopened.initialize();
  const rows = await reopened.request(`/tasks?workUuid=${work.uuid}`);
  assert.equal(rows.length, 8);
  assert.equal(rows.find((row: any) => row.uuid === tasks[0].uuid).status, 'done');
});

test('failed persistence does not mutate in-memory data', async () => {
  const { store, storage, work } = await fixture();
  const write = storage.write; storage.write = async () => { throw new Error('disk full'); };
  await assert.rejects(store.request(`/works/${work.uuid}`, 'PATCH', { name: 'Changed' }), /disk full/);
  assert.equal((await store.request(`/works/${work.uuid}`)).name, 'Minha obra');
  storage.write = write;
  await store.request(`/works/${work.uuid}`, 'PATCH', { name: 'Saved' });
  assert.equal((await store.request(`/works/${work.uuid}`)).name, 'Saved');
});

test('deleting a work removes dependent records and group references', async () => {
  const { store, work } = await fixture();
  const group = await store.request('/groups', 'POST', { name: 'Empresa' });
  await store.request(`/groups/${group.uuid}/works`, 'POST', { workUuid: work.uuid });
  await store.request('/tasks', 'POST', { title: 'Tarefa', workUuid: work.uuid });
  await store.request(`/works/${work.uuid}`, 'DELETE');
  for (const collection of ['tasks', 'expenses', 'revenues', 'work-events']) assert.deepEqual(await store.request(`/${collection}?workUuid=${work.uuid}`), []);
  assert.deepEqual((await store.request(`/groups/${group.uuid}`)).works, []);
  await assert.rejects(store.request(`/works/${work.uuid}`), { statusCode: 404 });
});

test('validates financial inputs, references and immutable identity fields', async () => {
  const { store, work } = await fixture();
  await assert.rejects(store.request('/expenses', 'POST', { name: 'Invalid', amount: -1, workUuid: work.uuid }), { statusCode: 400 });
  await assert.rejects(store.request('/tasks', 'POST', { title: 'Invalid', workUuid: 'missing' }), { statusCode: 404 });
  const result = await store.request('/expenses', 'POST', { name: 'Material', amount: 80, workUuid: work.uuid, type: 'material', uuid: 'overwrite', ownerUserUuid: 'other' });
  assert.notEqual(result.uuid, 'overwrite'); assert.equal(result.ownerUserUuid, (await store.request('/users/me')).uuid);
  await assert.rejects(store.request(`/works/${work.uuid}`, 'PATCH', { status: 'bad' }), { statusCode: 400 });
  await assert.rejects(store.request(`/works/${work.uuid}`, 'PATCH', { latitude: 91 }), { statusCode: 400 });
  await assert.rejects(store.request('/tasks', 'POST', { title: 'Invalid', dueDate: 'invalid' }), { statusCode: 400 });
});

test('expenses and revenues support create, update, delete and reload', async () => {
  const { store, storage, work } = await fixture();
  const expense = await store.request('/expenses', 'POST', { name: 'Cimento', amount: 120, type: 'material', workUuid: work.uuid });
  const revenue = await store.request('/revenues', 'POST', { name: 'Venda', amount: 500, type: 'sale', workUuid: work.uuid });
  await store.request(`/expenses/${expense.uuid}`, 'PATCH', { amount: 150 });
  await store.request(`/revenues/${revenue.uuid}`, 'PATCH', { amount: 600 });
  const reopened = new LocalStore(storage); await reopened.initialize();
  assert.equal((await reopened.request(`/expenses?workUuid=${work.uuid}`))[0].amount, 150);
  assert.equal((await reopened.request(`/revenues?workUuid=${work.uuid}`))[0].amount, 600);
  await reopened.request(`/expenses/${expense.uuid}`, 'DELETE');
  assert.deepEqual(await reopened.request('/expenses'), []);
});

test('migrates earlier installations without deleting edited records', async () => {
  const { store, work } = await fixture();
  const legacy = JSON.parse(await store.exportBackup()).state;
  legacy.version = 1; legacy.user.name = 'Demonstração JB'; legacy.user.email = 'demo@jb.local';
  const storage = memory(); await storage.write(JSON.stringify(legacy));
  const reopened = new LocalStore(storage); await reopened.initialize();
  assert.equal((await reopened.request(`/works/${work.uuid}`)).name, 'Minha obra');
  assert.equal((await reopened.request('/users/me')).email, '');
  assert.equal(JSON.parse((await storage.read())!).version, 2);
});

test('does not overwrite incompatible databases', async () => {
  let writes = 0;
  const store = new LocalStore({ read: async () => '{"version":99}', write: async () => { writes++; } });
  await assert.rejects(store.initialize(), /incompatível/); assert.equal(writes, 0);
});

test('attachments, photos and cover references persist and are cleaned on delete', async () => {
  const { store, storage, work } = await fixture();
  const image = 'data:image/png;base64,aGVsbG8=';
  const attachment = await store.request('/attachments', 'POST', { originalName: 'foto.png', dataUrl: image });
  await store.request(`/attachments/${attachment.uuid}`, 'PATCH', { workUuid: work.uuid });
  await store.request(`/works/${work.uuid}`, 'PATCH', { coverImageUrl: image });
  const reopened = new LocalStore(storage); await reopened.initialize();
  assert.equal((await reopened.request(`/attachments/${attachment.uuid}`)).publicUrl, image);
  const events = await reopened.request(`/work-events?workUuid=${work.uuid}`);
  assert.equal(events.find((event: any) => event.metadata?.attachmentUuid === attachment.uuid).metadata.publicUrl, image);
  await reopened.request(`/attachments/${attachment.uuid}`, 'DELETE');
  assert.equal((await reopened.request(`/works/${work.uuid}`)).coverImageUrl, '');
  assert.equal((await reopened.request('/work-events')).some((event: any) => event.metadata?.attachmentUuid === attachment.uuid), false);
});

test('backup restores records and attachments on another installation', async () => {
  const { store, work } = await fixture();
  await store.request('/attachments', 'POST', { originalName: 'foto.png', dataUrl: 'data:image/png;base64,aGVsbG8=', workUuid: work.uuid });
  const backup = await store.exportBackup();
  const targetStorage = memory(); const target = new LocalStore(targetStorage); await target.initialize();
  assert.equal(target.inspectBackup(backup).works, 1);
  await target.restoreBackup(backup);
  const reopened = new LocalStore(targetStorage); await reopened.initialize();
  assert.deepEqual(await reopened.request('/works'), await store.request('/works'));
  assert.deepEqual(await reopened.request('/attachments'), await store.request('/attachments'));
});

test('invalid backups and failed restore never replace current data', async () => {
  const { store, storage, work } = await fixture();
  const backup = await store.exportBackup();
  const broken = JSON.parse(backup); broken.state.tables.works[0].status = 'bad';
  await assert.rejects(store.restoreBackup(JSON.stringify(broken)));
  await assert.rejects(store.restoreBackup('{invalid'));
  storage.write = async () => { throw new Error('disk full'); };
  await assert.rejects(store.restoreBackup(backup), /disk full/);
  assert.equal((await store.request(`/works/${work.uuid}`)).name, 'Minha obra');
});

test('remote account operations are unavailable in the standalone data layer', async () => {
  const { store } = await fixture();
  await assert.rejects(store.request('/api/share-invites', 'POST', {}), { statusCode: 405 });
  await assert.rejects(store.request('/api/auth/login', 'POST', {}), { statusCode: 405 });
});
