import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { initializeData, installLocalApi } from './data/api';
import { navigate, RouterContext } from './compat/router';
import Link from './compat/link';
import '@/styles/globals.css';
import '@/styles/usability.css';
import '@/styles/select.css';
import './native.css';

type PageModule = {
  default: ComponentType<any>;
  getServerSideProps?: (context: any) => Promise<{ props?: any; redirect?: { destination: string }; notFound?: boolean }>;
};
// Import the actual web screens. API handlers and Next's document/app never enter the native bundle.
const pages = import.meta.glob<PageModule>([
  '../../jb-web-frontend/src/pages/**/*.tsx',
  '!../../jb-web-frontend/src/pages/_*.tsx',
  '!../../jb-web-frontend/src/pages/api/**',
  '!../../jb-web-frontend/src/pages/index.tsx',
  '!../../jb-web-frontend/src/pages/login.tsx',
  '!../../jb-web-frontend/src/pages/register.tsx',
  '!../../jb-web-frontend/src/pages/share/**',
]);
const routes = Object.entries(pages).map(([file, load]) => {
  const route = file.split('/pages')[1].replace(/\.tsx$/, '').replace(/\/index$/, '') || '/';
  return { route, load, pattern: new RegExp(`^${route.replace(/\[([^\]]+)\]/g, '([^/]+)')}$`), keys: [...route.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]) };
}).sort((a, b) => a.keys.length - b.keys.length);

function Welcome() {
  return <main className="auth-page">
    <div className="brand auth-brand"><span className="brand-mark"><img src="/jblogo.png" alt="" /></span><span className="brand-copy"><strong>JB Management</strong><small>Gestão de obras</small></span></div>
    <section className="auth-card"><div className="auth-heading"><span className="eyebrow">Demo local</span><h1>Seu JB no celular</h1><p>Explore as telas com dados de demonstração. As alterações ficam salvas neste aparelho, sem precisar de internet.</p></div>
      <Link className="button primary" href="/dashboard">Entrar na demonstração</Link>
      <p className="muted">Os dados são fictícios. Não há login, sincronização ou compartilhamento com outras pessoas nesta versão. Desinstalar o app pode apagar os dados locais.</p>
    </section>
  </main>;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <main className="auth-page"><section className="auth-card"><h1>Não foi possível abrir o JB</h1><p role="alert">{this.state.error}</p><button onClick={() => location.reload()}>Tentar novamente</button></section></main> : this.props.children; }
}

function Application() {
  const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState<{ Page: ComponentType<any>; props: any; route: string; query: Record<string, string> } | null>(null);
  const [error, setError] = useState('');
  const asPath = location.hash.slice(1) || '/';
  useEffect(() => {
    const refresh = () => { setScreen(null); setError(''); setRevision(value => value + 1); };
    window.addEventListener('popstate', refresh);
    window.addEventListener('jb:navigate', refresh);
    return () => { window.removeEventListener('popstate', refresh); window.removeEventListener('jb:navigate', refresh); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const url = new URL(asPath, 'https://jb.local');
      if (['/', '/login', '/register'].includes(url.pathname)) {
        setScreen({ Page: Welcome, props: {}, route: '/', query: {} }); return;
      }
      const route = routes.find(item => item.pattern.test(url.pathname));
      if (!route) { setError('Esta tela não está disponível na demo local.'); return; }
      const match = url.pathname.match(route.pattern)!;
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      const module = await route.load();
      // Existing loaders are plain functions here, with their backend import redirected to SQLite.
      const result = module.getServerSideProps ? await module.getServerSideProps({ req: { cookies: { auth_token: 'local-demo' } }, params, query: Object.fromEntries(url.searchParams) }) : { props: {} };
      if (cancelled) return;
      if (result.redirect) { await navigate(result.redirect.destination, true); return; }
      if (result.notFound) throw new Error('Registro não encontrado.');
      setScreen({ Page: module.default, props: result.props ?? {}, route: route.route, query: { ...Object.fromEntries(url.searchParams), ...params } });
      window.scrollTo(0, 0);
    }
    load().catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao carregar os dados.'); });
    return () => { cancelled = true; };
  }, [asPath, revision]);
  return <>
    <div className="demo-banner">Demo local · Dados salvos neste aparelho</div>
    {error ? <main className="auth-page"><section className="auth-card"><p role="alert">{error}</p><Link href="/dashboard">Voltar às obras</Link></section></main> : screen ?
      <RouterContext.Provider value={{ pathname: screen.route, asPath, query: screen.query, push: href => navigate(href), replace: href => navigate(href, true) }}>
        <button className="skip-link" onClick={() => { const heading = document.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus(); } }}>Pular para o conteúdo</button>
        <div id="page-content"><screen.Page key={`${asPath}:${revision}`} {...screen.props} /></div>
      </RouterContext.Provider> : <p className="local-loading" role="status">Abrindo dados locais…</p>}
  </>;
}

async function start() {
  await initializeData();
  installLocalApi();
  if (Capacitor.getPlatform() === 'android') {
    await NativeApp.addListener('backButton', () => {
      const path = location.hash.slice(1);
      if (!path || path === '/' || path === '/dashboard') void NativeApp.minimizeApp();
      else if (history.length > 1) history.back();
      else void navigate('/dashboard', true);
    });
  }
  createRoot(document.getElementById('root')!).render(<ErrorBoundary><Application /></ErrorBoundary>);
}
start().catch(error => {
  createRoot(document.getElementById('root')!).render(<main className="auth-page"><section className="auth-card"><h1>Não foi possível abrir os dados locais</h1><p role="alert">{error instanceof Error ? error.message : 'Erro de armazenamento.'}</p><p>Os dados existentes não foram apagados.</p><button onClick={() => location.reload()}>Tentar novamente</button></section></main>);
});
