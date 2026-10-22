import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { sqliteStorage } from './sqlite-storage';

export interface StorageAdapter {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export async function openStorage(): Promise<StorageAdapter> {
  if (Capacitor.isNativePlatform()) {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    // Retain the database name so existing installations keep their data.
    const db = await sqlite.createConnection('jb_demo', false, 'no-encryption', 1, false);
    await db.open();
    await db.execute('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL);');
    await db.execute('CREATE TABLE IF NOT EXISTS app_state_chunks (id INTEGER PRIMARY KEY, value TEXT NOT NULL);');
    return sqliteStorage(db);
  }
  // Browser preview only. The installed Android/iOS app always uses SQLite.
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('jb-demo', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    async read() {
      return new Promise((resolve, reject) => {
        const request = db.transaction('state').objectStore('state').get('current');
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    },
    async write(value) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put(value, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Gravação interrompida.'));
      });
    },
  };
}
