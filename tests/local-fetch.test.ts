import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/data/store.ts';
import { createLocalFetch } from '../src/data/local-fetch.ts';

for (const base of ['https://localhost/index.html', 'capacitor://localhost/index.html']) {
  test(`local CRUD never calls network fetch (${base})`, async () => {
    const store = new LocalStore({ read: async () => null, write: async () => {} }); await store.initialize();
    let networkCalls = 0;
    const localFetch = createLocalFetch(store, async () => { networkCalls++; return new Response('asset'); }, base);
    const created = await localFetch('/api/works', { method: 'POST', body: JSON.stringify({ name: 'Minha obra', address: 'Rua Um' }) });
    assert.equal(created.status, 200);
    const work = await created.json();
    assert.equal((await (await localFetch(`/api/works/${work.uuid}`)).json()).name, 'Minha obra');
    const invalid = await localFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title: '' }) });
    assert.equal(invalid.status, 400);
    await assert.rejects(localFetch('https://example.com/api/works'), /conexões externas/);
    await assert.rejects(localFetch('other://localhost/api/works'), /conexões externas/);
    assert.equal(networkCalls, 0);
    await localFetch('/jblogo.png'); assert.equal(networkCalls, 1);
  });
}
