import { LocalApiError, LocalStore } from './store';
import { openStorage, type StorageAdapter } from './storage';
import { createLocalFetch } from './local-fetch';

let store: LocalStore;
export async function initializeData(storage?: StorageAdapter) {
  store = new LocalStore(storage ?? await openStorage());
  await store.initialize();
}
export async function requestBackend<T>(path: string, init?: RequestInit): Promise<T> {
  return store.request(path, init?.method ?? 'GET', typeof init?.body === 'string' ? JSON.parse(init.body) : {});
}
export { LocalApiError as BackendRequestError };
export function exportBackup() { return store.exportBackup(); }
export function inspectBackup(text: string) { return store.inspectBackup(text); }
export function restoreBackup(text: string) { return store.restoreBackup(text); }
export function getBackupStatus() { return store.backupStatus(); }
export function confirmBackup(text: string) { return store.confirmBackup(text); }
export function postponeBackupReminder() { return store.postponeBackupReminder(); }

// Keep the web screens' /api calls local. Never fall through to a remote backend.
export function installLocalApi() {
  window.fetch = createLocalFetch(store, window.fetch.bind(window), location.href);
}
