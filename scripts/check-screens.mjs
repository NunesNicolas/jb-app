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
  const group = await api.requestBackend('/groups', { method: 'POST', body: JSON.stringify({ name: 'Grupo demo' }) });
  const routes = [
    ['dashboard', {}], ['tasks', {}], ['calendar', {}], ['reports', {}], ['map', {}],
    ['works/new', {}], ['works/[uuid]', { uuid: 'obra-demo' }],
    ['works/[uuid]/expenses', { uuid: 'obra-demo' }], ['groups/[uuid]', { uuid: group.uuid }],
  ];
  for (const [route, params] of routes) {
    const page = await server.ssrLoadModule(`../jb-web-frontend/src/pages/${route}.tsx`);
    const result = page.getServerSideProps ? await page.getServerSideProps({ req: { cookies: { auth_token: 'local-demo' } }, params, query: {} }) : { props: {} };
    assert.ok(result.props, `${route}: loader redirected instead of loading local data`);
    const html = renderToString(React.createElement(RouterContext.Provider, { value: { pathname: `/${route}`, asPath: `/${route}`, query: params, push: async () => true, replace: async () => true } }, React.createElement(page.default, result.props)));
    assert.match(html, /<h1/, `${route}: missing main heading`);
    console.log(`OK ${route}`);
  }
} finally { await server.close(); }
