import type { StorageAdapter } from './storage';

// This adapter preserves the JSON contract used by the shared web screens.
// All operations are local; there is no authentication or remote synchronization.
type Row = Record<string, any>;
type Collection = 'works' | 'tasks' | 'expenses' | 'revenues' | 'groups' | 'attachments' | 'work-events' | 'notifications';
type BackupHistory = { revision: number; savedRevision: number; savedAt: string | null; remindAfter: number };
type State = { version: 2; user: Row; tables: Record<Collection, Row[]>; backupHistory?: BackupHistory };
const emptyBackupHistory = (): BackupHistory => ({ revision: 0, savedRevision: -1, savedAt: null, remindAfter: 0 });
export type BackupStatus = { savedAt: string | null; hasChanges: boolean; reminderDue: boolean };
const collections: Collection[] = ['works', 'tasks', 'expenses', 'revenues', 'groups', 'attachments', 'work-events', 'notifications'];
export class LocalApiError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

function emptyState(): State {
  const now = new Date().toISOString();
  const user = { uuid: crypto.randomUUID(), name: 'Neste aparelho', email: '', phone: '', profile: 'admin', createdAt: now, updatedAt: now };
  return {
    version: 2, user,
    tables: {
      works: [], tasks: [], expenses: [],
      revenues: [], groups: [], attachments: [], notifications: [],
      'work-events': [],
    },
  };
}

function validateRecord(collection: Collection, row: Row) {
  const requireText = (key: string) => {
    if (typeof row[key] !== 'string' || !row[key].trim()) throw new LocalApiError(`Preencha o campo ${key}.`);
  };
  const oneOf = (key: string, values: string[]) => { if (!values.includes(row[key])) throw new LocalApiError(`Valor inválido para ${key}.`); };
  const numeric = (key: string, min: number, max = Number.MAX_SAFE_INTEGER) => {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < min || row[key] > max) throw new LocalApiError(`Valor inválido para ${key}.`);
  };
  for (const key of ['description', 'address', 'assignee', 'name', 'title', 'uploadUrl', 'coverImageUrl', 'originalName']) {
    if (row[key] !== undefined && typeof row[key] !== 'string') throw new LocalApiError(`Texto inválido para ${key}.`);
  }
  if (['works', 'groups', 'expenses', 'revenues'].includes(collection)) requireText('name');
  if (collection === 'works') {
    requireText('address'); numeric('latitude', -90, 90); numeric('longitude', -180, 180);
    numeric('estimatedPrice', 0); numeric('finalBudget', 0);
    oneOf('status', ['planning', 'in_progress', 'paused', 'completed', 'cancelled']);
  }
  if (collection === 'tasks') {
    requireText('title'); numeric('position', 0);
    oneOf('status', ['backlog', 'todo', 'in_progress', 'review', 'done']);
    oneOf('priority', ['low', 'medium', 'high', 'critical']);
  }
  if (collection === 'expenses' || collection === 'revenues') {
    requireText('workUuid'); numeric('amount', Number.MIN_VALUE);
    oneOf('type', collection === 'expenses' ? ['material', 'labor', 'marketing', 'documentation'] : ['sale', 'rent', 'other']);
  }
  for (const key of ['dueDate', 'receivedAt']) {
    if (row[key] != null && (typeof row[key] !== 'string' || !Number.isFinite(Date.parse(row[key])))) throw new LocalApiError(`Data inválida para ${key}.`);
  }
  if (collection === 'attachments') {
    requireText('originalName'); requireText('publicUrl');
    if (!/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/]*={0,2}$/.test(row.publicUrl)) throw new LocalApiError('Anexo local inválido.');
  }
}

function parseState(value: unknown, checkRecords = false): State {
  const state = value as State;
  if (!state || ![1, 2].includes(state.version) || !state.user || typeof state.user.uuid !== 'string' || !collections.every(key => Array.isArray(state.tables?.[key]))) {
    throw new Error('Banco local incompatível. Os dados foram preservados.');
  }
  const migrated = structuredClone(state);
  migrated.version = 2;
  const history = migrated.backupHistory;
  if (!history || !Number.isSafeInteger(history.revision) || history.revision < 0 || !Number.isSafeInteger(history.savedRevision) || history.savedRevision < -1 || history.savedRevision > history.revision || (history.savedAt !== null && !Number.isFinite(Date.parse(history.savedAt))) || !Number.isFinite(history.remindAfter)) {
    migrated.backupHistory = emptyBackupHistory();
  }
  // Retain identity and every existing record, including edits made in the earlier build.
  migrated.user = { ...migrated.user, name: 'Neste aparelho', email: '', profile: 'admin' };
  if (checkRecords) {
    for (const collection of collections) {
      const ids = new Set<string>();
      for (const row of migrated.tables[collection]) {
        if (!row || typeof row.uuid !== 'string' || !row.uuid || ids.has(row.uuid) || row.ownerUserUuid !== migrated.user.uuid || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Backup contém registros inválidos ou duplicados.');
        ids.add(row.uuid);
        validateRecord(collection, row);
        if (row.workUuid && !migrated.tables.works.some(work => work.uuid === row.workUuid)) throw new Error('Backup contém referência a uma obra inexistente.');
        if (collection === 'groups' && (!Array.isArray(row.members) || !Array.isArray(row.works) || row.works.some((work: Row) => !migrated.tables.works.some(existing => existing.uuid === work.uuid)))) throw new Error('Empresa inválida no backup.');
      }
    }
  }
  return migrated;
}

export class LocalStore {
  private state!: State;
  private queue: Promise<unknown> = Promise.resolve();
  private pendingBackup: { text: string; revision: number; at: string } | null = null;
  constructor(private storage: StorageAdapter) {}
  async initialize() {
    const raw = await this.storage.read();
    if (raw) {
      const parsed = JSON.parse(raw);
      this.state = parseState(parsed);
      if (parsed.version !== 2) await this.storage.write(JSON.stringify(this.state));
    } else {
      this.state = emptyState();
      await this.storage.write(JSON.stringify(this.state));
    }
  }
  async exportBackup(): Promise<string> {
    await this.queue;
    const at = new Date().toISOString();
    const text = JSON.stringify({ format: 'jb-local-backup', version: 1, exportedAt: at, state: this.state });
    this.pendingBackup = { text, revision: this.state.backupHistory?.revision ?? 0, at };
    return text;
  }
  async backupStatus(now = Date.now()): Promise<BackupStatus> {
    await this.queue;
    const history = this.state.backupHistory ?? emptyBackupHistory();
    const hasChanges = history.revision > history.savedRevision;
    const hasRecords = collections.some(key => this.state.tables[key].length > 0);
    return { savedAt: history.savedAt, hasChanges, reminderDue: hasRecords && hasChanges && now >= history.remindAfter && (!history.savedAt || now - Date.parse(history.savedAt) >= 7 * 86400000) };
  }
  confirmBackup(text: string): Promise<void> {
    return this.updateBackupHistory(history => {
      if (!this.pendingBackup || this.pendingBackup.text !== text) throw new Error('Exporte um novo backup antes de confirmar.');
      history.savedAt = this.pendingBackup.at;
      history.savedRevision = this.pendingBackup.revision;
      history.remindAfter = 0;
    });
  }
  postponeBackupReminder(): Promise<void> {
    return this.updateBackupHistory(history => { history.remindAfter = Date.now() + 86400000; });
  }
  private updateBackupHistory(update: (history: BackupHistory) => void): Promise<void> {
    const job = this.queue.then(async () => {
      const candidate = structuredClone(this.state);
      candidate.backupHistory ??= emptyBackupHistory();
      update(candidate.backupHistory);
      await this.storage.write(JSON.stringify(candidate));
      this.state = candidate;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }
  inspectBackup(text: string) {
    const backup = JSON.parse(text);
    if (backup?.format !== 'jb-local-backup' || backup.version !== 1) throw new Error('Selecione um backup exportado pelo JB.');
    const state = parseState(backup.state, true);
    return Object.fromEntries(collections.map(key => [key, state.tables[key].length]));
  }
  restoreBackup(text: string): Promise<void> {
    const job = this.queue.then(async () => {
      this.inspectBackup(text);
      const candidate = parseState(JSON.parse(text).state, true);
      // An imported file does not establish backup history on this installation.
      candidate.backupHistory = emptyBackupHistory();
      await this.storage.write(JSON.stringify(candidate));
      this.state = candidate;
      this.pendingBackup = null;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }
  request(path: string, method = 'GET', body: Row = {}): Promise<any> {
    const job = this.queue.then(async () => {
      const candidate = structuredClone(this.state);
      const result = this.execute(candidate, path, method.toUpperCase(), body);
      if (method.toUpperCase() !== 'GET') {
        candidate.backupHistory ??= emptyBackupHistory();
        candidate.backupHistory.revision++;
        // Commit in memory only after durable storage succeeds.
        await this.storage.write(JSON.stringify(candidate));
        this.state = candidate;
      }
      return structuredClone(result);
    });
    this.queue = job.catch(() => undefined);
    return job;
  }
  private execute(state: State, path: string, method: string, body: Row): any {
    const url = new URL(path, 'https://jb.local');
    const [name, uuid, relation, relationUuid] = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean);
    if (name === 'users' && uuid === 'me' && method === 'GET') return state.user;
    if (name === 'auth' || name === 'share-invites' || relation === 'members') {
      throw new LocalApiError('Esta versão funciona sem contas ou compartilhamento entre usuários.', 405);
    }
    if (!collections.includes(name as Collection)) throw new LocalApiError('Recurso não encontrado.', 404);
    const collection = name as Collection;
    const rows = state.tables[collection];
    const existing = uuid ? rows.find(row => row.uuid === uuid) : undefined;
    if (uuid && !existing) throw new LocalApiError('Registro não encontrado.', 404);
    if (relation) {
      if (collection === 'groups' && relation === 'works' && existing) {
        if (method === 'POST' && !relationUuid) {
          const work = state.tables.works.find(row => row.uuid === body.workUuid);
          if (!work) throw new LocalApiError('Obra não encontrada.', 404);
          if (!existing.works.some((row: Row) => row.uuid === work.uuid)) existing.works.push({ uuid: work.uuid, name: work.name, address: work.address, status: work.status });
          return existing;
        }
        if (method === 'DELETE' && relationUuid) {
          existing.works = existing.works.filter((row: Row) => row.uuid !== relationUuid);
          return existing;
        }
      }
      throw new LocalApiError('Operação não suportada.', 405);
    }
    if (method === 'GET') {
      if (existing) return existing;
      const workUuid = url.searchParams.get('workUuid');
      const result = workUuid ? rows.filter(row => row.workUuid === workUuid) : rows;
      return collection === 'tasks' ? result.map(row => ({ ...row, workName: state.tables.works.find(work => work.uuid === row.workUuid)?.name ?? null })) : result;
    }
    if (collection === 'work-events' || collection === 'notifications') throw new LocalApiError('Recurso somente para leitura.', 405);
    if (method === 'DELETE' && existing) {
      state.tables[collection] = rows.filter(row => row.uuid !== uuid);
      if (collection === 'attachments') {
        state.tables['work-events'] = state.tables['work-events'].filter(event => event.metadata?.attachmentUuid !== uuid);
        for (const work of state.tables.works) if (work.coverImageUrl === existing.publicUrl) work.coverImageUrl = '';
        for (const expense of state.tables.expenses) if (expense.uploadUrl === existing.publicUrl) expense.uploadUrl = '';
      }
      if (collection === 'works') {
        for (const key of ['expenses', 'revenues', 'tasks', 'attachments', 'work-events'] as Collection[]) state.tables[key] = state.tables[key].filter(row => row.workUuid !== uuid);
        for (const group of state.tables.groups) group.works = group.works.filter((row: Row) => row.uuid !== uuid);
      }
      return { ok: true };
    }
    if (!((method === 'POST' && !uuid) || ((method === 'PATCH' || method === 'PUT') && existing))) throw new LocalApiError('Método não permitido.', 405);
    const now = new Date().toISOString();
    const defaults: Record<string, Row> = {
      works: { address: '', latitude: 0, longitude: 0, estimatedPrice: 0, finalBudget: 0, coverImageUrl: '', status: 'planning' },
      tasks: { workUuid: null, workName: null, description: '', assignee: '', dueDate: null, status: 'todo', priority: 'medium', position: 0 },
      expenses: { description: '', uploadUrl: '' }, revenues: { description: '', receivedAt: now },
      groups: { members: [], works: [] }, attachments: {},
    };
    const allowed: Record<string, string[]> = {
      works: ['name', 'address', 'latitude', 'longitude', 'estimatedPrice', 'finalBudget', 'coverImageUrl', 'status'],
      tasks: ['title', 'description', 'workUuid', 'assignee', 'dueDate', 'status', 'priority', 'position'],
      expenses: ['workUuid', 'type', 'name', 'description', 'amount', 'uploadUrl'],
      revenues: ['workUuid', 'type', 'name', 'description', 'amount', 'receivedAt'],
      groups: ['name'], attachments: ['workUuid', 'originalName', 'dataUrl'],
    };
    const payload = Object.fromEntries(Object.entries(body).filter(([key]) => allowed[collection].includes(key)));
    const row: Row = { ...(existing ?? { ...defaults[collection], uuid: crypto.randomUUID(), ownerUserUuid: state.user.uuid, createdAt: now }), ...payload, updatedAt: now };
    if (row.workUuid && !state.tables.works.some(work => work.uuid === row.workUuid)) throw new LocalApiError('Obra não encontrada.', 404);
    if (collection === 'tasks') row.workName = state.tables.works.find(work => work.uuid === row.workUuid)?.name ?? null;
    if (collection === 'attachments' && (!existing || payload.dataUrl)) {
      if (typeof row.dataUrl !== 'string' || !/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,/.test(row.dataUrl)) throw new LocalApiError('Use uma imagem PNG, JPEG, WebP, GIF ou PDF.');
      if (row.dataUrl.length > 8 * 1024 * 1024) throw new LocalApiError('Arquivo muito grande (máximo aproximado: 6 MB por anexo).');
      row.publicUrl = row.dataUrl; row.filename = row.uuid; row.mimeType = row.dataUrl.slice(5, row.dataUrl.indexOf(';')); row.size = Math.floor(row.dataUrl.split(',')[1].length * 3 / 4);
      delete row.dataUrl;
    }
    validateRecord(collection, row);
    if (existing) rows[rows.indexOf(existing)] = row;
    else rows.unshift(row);
    if (collection === 'works') {
      for (const group of state.tables.groups) group.works = group.works.map((work: Row) => work.uuid === row.uuid ? { uuid: row.uuid, name: row.name, address: row.address, status: row.status } : work);
    }
    const workUuid = collection === 'works' ? row.uuid : row.workUuid;
    if (workUuid) {
      const type = collection === 'works' ? (existing ? 'work_updated' : 'work_created') : ({ expenses: 'expense_created', revenues: 'revenue_created', tasks: existing ? 'task_moved' : 'task_created', attachments: 'attachment_uploaded' } as Record<string, string>)[collection];
      if (type) state.tables['work-events'].unshift({ uuid: crypto.randomUUID(), ownerUserUuid: state.user.uuid, workUuid, type, title: existing ? 'Registro atualizado' : 'Registro adicionado', description: row.name ?? row.title ?? row.originalName ?? '', ...(collection === 'attachments' ? { metadata: { attachmentUuid: row.uuid, publicUrl: row.publicUrl } } : {}), createdAt: now });
    }
    return row;
  }
}
