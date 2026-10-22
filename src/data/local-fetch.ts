import { LocalApiError, type LocalStore } from './store';

export function createLocalFetch(store: LocalStore, assetFetch: typeof fetch, baseUrl: string): typeof fetch {
  const base = new URL(baseUrl);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), base);
    // Compare scheme and host: custom iOS schemes may have a null URL.origin.
    if (url.protocol !== base.protocol || url.host !== base.host) throw new Error('O JB local não realiza conexões externas.');
    if (!url.pathname.startsWith('/api/')) return assetFetch(input, init);
    try {
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const raw = init?.body ?? (input instanceof Request && method !== 'GET' ? await input.clone().text() : undefined);
      const body = typeof raw === 'string' && raw ? JSON.parse(raw) : {};
      const value = await store.request(url.pathname + url.search, method, body);
      return Response.json(value);
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : 'Não foi possível salvar os dados.' }, { status: error instanceof LocalApiError ? error.statusCode : 500 });
    }
  };
}
