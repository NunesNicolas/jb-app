import { LocalApiError, LocalStore } from './store';
import { openStorage, type StorageAdapter } from './storage';

let store: LocalStore;
export async function initializeData(storage?: StorageAdapter) {
  store = new LocalStore(storage ?? await openStorage());
  await store.initialize();
}
export async function requestBackend<T>(path: string, init?: RequestInit): Promise<T> {
  return store.request(path, init?.method ?? 'GET', typeof init?.body === 'string' ? JSON.parse(init.body) : {});
}
export { LocalApiError as BackendRequestError };

// Keep the web screens' /api calls local. Never fall through to a remote backend.
export function installLocalApi() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
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
