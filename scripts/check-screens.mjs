// Render shared screens with their actual loaders and the local data adapter.
// This verifies the compatibility boundary; it is not an emulator/browser test.
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const api = await server.ssrLoadModule('/src/data/api.ts');
  let value = null;
  await api.initializeData({ read: async () => value, write: async text => { value = text; } });
  const { RouterContext } = await server.ssrLoadModule('/src/compat/router.tsx');
  for (const route of ['dashboard', 'tasks', 'calendar', 'reports', 'map']) {
    const page = await server.ssrLoadModule(`../jb-web-frontend/src/pages/${route}.tsx`);
    const result = await page.getServerSideProps({ req: { cookies: { auth_token: 'local-device' } }, params: {}, query: {} });
    const html = renderToString(React.createElement(RouterContext.Provider, { value: { pathname: `/${route}`, asPath: `/${route}`, query: {}, push: async () => true, replace: async () => true } }, React.createElement(page.default, result.props)));
    assert.match(html, /<h1/);
    assert.doesNotMatch(html, /Sair da conta|demo@|Demonstração|Usuários e permissões/);
    console.log(`OK empty ${route}`);
  }
  const group = await api.requestBackend('/groups', { method: 'POST', body: JSON.stringify({ name: 'Empresa de teste' }) });
  const work = await api.requestBackend('/works', { method: 'POST', body: JSON.stringify({ name: 'Obra de teste', address: 'Rua Um, 10' }) });
  const secondWork = await api.requestBackend('/works', { method: 'POST', body: JSON.stringify({ name: 'Segunda obra', address: 'Rua Dois, 20' }) });
  await api.requestBackend('/works', { method: 'POST', body: JSON.stringify({ name: 'Obra sem despesas', address: 'Rua Tres, 30' }) });
  for (const [workUuid, amount] of [[work.uuid, 125.25], [secondWork.uuid, 80], [work.uuid, 74.75]]) {
    await api.requestBackend('/expenses', { method: 'POST', body: JSON.stringify({ workUuid, amount, type: 'material', name: 'Material de teste', uploadUrl: '' }) });
  }
  const routes = [
    ['dashboard', {}], ['tasks', {}], ['calendar', {}], ['reports', {}], ['map', {}],
    ['works/new', {}], ['works/[uuid]', { uuid: work.uuid }],
    ['works/[uuid]/expenses', { uuid: work.uuid }], ['groups/[uuid]', { uuid: group.uuid }],
  ];
  for (const [route, params] of routes) {
    const page = await server.ssrLoadModule(`../jb-web-frontend/src/pages/${route}.tsx`);
    const result = page.getServerSideProps ? await page.getServerSideProps({ req: { cookies: { auth_token: 'local-device' } }, params, query: {} }) : { props: {} };
    assert.ok(result.props, `${route}: loader redirected instead of loading local data`);
    const html = renderToString(React.createElement(RouterContext.Provider, { value: { pathname: `/${route}`, asPath: `/${route}`, query: params, push: async () => true, replace: async () => true } }, React.createElement(page.default, result.props)));
    assert.match(html, /<h1/, `${route}: missing main heading`);
    if (route === 'dashboard') {
      const cards = html.split('class="work-list-card ').slice(1);
      assert.equal(cards.length, 3);
      for (const [name, amount] of [['Obra de teste', 200], ['Segunda obra', 80], ['Obra sem despesas', 0]]) {
        const card = cards.find(card => card.includes(`<h3>${name}</h3>`));
        assert.ok(card, `Missing work card: ${name}`);
        const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
        assert.ok(card.includes(`<strong>${formatted}</strong>`), `Incorrect expense total: ${name}`);
      }
    }
    assert.doesNotMatch(html, /Sair da conta|Gerar link de acesso|Adicionar usuário à empresa|>Compartilhar</);
    console.log(`OK ${route}`);
  }
  const settings = await server.ssrLoadModule('/src/pages/Settings.tsx');
  const html = renderToString(React.createElement(RouterContext.Provider, { value: { pathname: '/settings', asPath: '/settings', query: {}, push: async () => true, replace: async () => true } }, React.createElement(settings.default)));
  assert.match(html, /Exportar backup/);
  console.log('OK settings');
} finally { await server.close(); }
