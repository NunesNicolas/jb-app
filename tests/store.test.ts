import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/data/store.ts';

function memory() {
  let saved: string | null = null;
  return { read: async () => saved, write: async (value: string) => { saved = value; } };
}

test('persists edits across app launches without reseeding or losing concurrent writes', async () => {
  const storage = memory();
  const store = new LocalStore(storage);
  await store.initialize();
  const tasks = await Promise.all(Array.from({ length: 8 }, (_, i) => store.request('/api/tasks', 'POST', { title: `Tarefa ${i}`, workUuid: 'obra-demo' })));
  await store.request(`/tasks/${tasks[0].uuid}`, 'PATCH', { status: 'done' });
  const reopened = new LocalStore(storage);
  await reopened.initialize();
  const rows = await reopened.request('/tasks?workUuid=obra-demo');
  assert.equal(rows.length, 9);
  assert.equal(rows.find((row: any) => row.uuid === tasks[0].uuid).status, 'done');
  assert.equal((await reopened.request('/works')).length, 1);
});

test('failed persistence does not report success or change in-memory state', async () => {
  const storage = memory();
  const store = new LocalStore(storage);
  await store.initialize();
  const write = storage.write;
  storage.write = async () => { throw new Error('disk full'); };
  await assert.rejects(store.request('/works/obra-demo', 'PATCH', { name: 'Changed' }), /disk full/);
  assert.equal((await store.request('/works/obra-demo')).name, 'Residencial Jardim — Demo');
  storage.write = write;
  await store.request('/works/obra-demo', 'PATCH', { name: 'Saved' });
  assert.equal((await store.request('/works/obra-demo')).name, 'Saved');
});

test('deleting a work removes dependent records and local group references', async () => {
  const store = new LocalStore(memory()); await store.initialize();
  const group = await store.request('/groups', 'POST', { name: 'Grupo local' });
  await store.request(`/groups/${group.uuid}/works`, 'POST', { workUuid: 'obra-demo' });
  await store.request('/works/obra-demo', 'DELETE');
  for (const collection of ['tasks', 'expenses', 'revenues', 'work-events']) assert.deepEqual(await store.request(`/${collection}?workUuid=obra-demo`), []);
  assert.deepEqual((await store.request(`/groups/${group.uuid}`)).works, []);
  await assert.rejects(store.request('/works/obra-demo'), { statusCode: 404 });
});

test('rejects remote-only operations and invalid financial references', async () => {
  const store = new LocalStore(memory()); await store.initialize();
  await assert.rejects(store.request('/api/share-invites', 'POST', {}), { statusCode: 501 });
  await assert.rejects(store.request('/expenses', 'POST', { name: 'Invalid', amount: -1, workUuid: 'obra-demo' }), { statusCode: 400 });
  await assert.rejects(store.request('/tasks', 'POST', { title: 'Invalid', workUuid: 'missing' }), { statusCode: 404 });
  const result = await store.request('/expenses', 'POST', { name: 'Material', amount: 80, workUuid: 'obra-demo', type: 'material', uuid: 'overwrite', ownerUserUuid: 'other' });
  assert.notEqual(result.uuid, 'overwrite'); assert.equal(result.ownerUserUuid, 'local-demo');
});

test('does not overwrite incompatible databases', async () => {
  let writes = 0;
  const store = new LocalStore({ read: async () => '{"version":99}', write: async () => { writes++; } });
  await assert.rejects(store.initialize(), /incompatível/);
  assert.equal(writes, 0);
});

test('attachments persist locally and can be linked to a work later', async () => {
  const storage = memory(); const store = new LocalStore(storage); await store.initialize();
  const image = 'data:image/png;base64,aGVsbG8=';
  const attachment = await store.request('/attachments', 'POST', { originalName: 'demo.png', dataUrl: image });
  await store.request(`/attachments/${attachment.uuid}`, 'PATCH', { workUuid: 'obra-demo' });
  const reopened = new LocalStore(storage); await reopened.initialize();
  assert.equal((await reopened.request(`/attachments/${attachment.uuid}`)).publicUrl, image);
  const events = await reopened.request('/work-events?workUuid=obra-demo');
  assert.equal(events.find((event: any) => event.metadata?.attachmentUuid === attachment.uuid).metadata.publicUrl, image);
  await reopened.request(`/attachments/${attachment.uuid}`, 'DELETE');
  assert.equal((await reopened.request('/work-events?workUuid=obra-demo')).some((event: any) => event.metadata?.attachmentUuid === attachment.uuid), false);
});
