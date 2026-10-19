import type { StorageAdapter } from './storage';

// This adapter preserves the JSON contract used by the shared web screens.
// Production synchronization and multi-user authorization are not part of the local demo.
type Row = Record<string, any>;
type Collection = 'works' | 'tasks' | 'expenses' | 'revenues' | 'groups' | 'attachments' | 'work-events' | 'notifications';
type State = { version: 1; user: Row; tables: Record<Collection, Row[]> };
const collections: Collection[] = ['works', 'tasks', 'expenses', 'revenues', 'groups', 'attachments', 'work-events', 'notifications'];
export class LocalApiError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

function seed(): State {
  const now = new Date().toISOString();
  const user = { uuid: 'local-demo', name: 'Demonstração JB', email: 'demo@jb.local', phone: '', profile: 'admin', createdAt: now, updatedAt: now };
  const base = { ownerUserUuid: user.uuid, createdAt: now, updatedAt: now };
  const work = { ...base, uuid: 'obra-demo', name: 'Residencial Jardim — Demo', address: 'São Paulo, SP', latitude: -23.55052, longitude: -46.633308, estimatedPrice: 350000, finalBudget: 300000, coverImageUrl: '', status: 'in_progress' };
  return {
    version: 1, user,
    tables: {
      works: [work],
      tasks: [{ ...base, uuid: 'tarefa-demo', workUuid: work.uuid, workName: work.name, title: 'Conferir materiais da obra', description: 'Tarefa de demonstração. Você pode editar, mover e excluir.', assignee: 'Equipe JB', dueDate: now.slice(0, 10), status: 'todo', priority: 'medium', position: 0 }],
      expenses: [{ ...base, uuid: 'despesa-demo', workUuid: work.uuid, type: 'material', name: 'Materiais iniciais', description: 'Valor fictício da demo', amount: 12500, uploadUrl: '' }],
      revenues: [], groups: [], attachments: [], notifications: [],
      'work-events': [{ ...base, uuid: 'evento-demo', workUuid: work.uuid, type: 'work_created', title: 'Obra de demonstração criada', description: 'Dados locais, sem conexão com o servidor.' }],
    },
  };
}

export class LocalStore {
  private state!: State;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: StorageAdapter) {}
  async initialize() {
    const raw = await this.storage.read();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !parsed.user || !collections.every(key => Array.isArray(parsed.tables?.[key]))) {
        throw new Error('Banco local incompatível. Os dados foram preservados.');
      }
      this.state = parsed;
    } else {
      this.state = seed();
      await this.storage.write(JSON.stringify(this.state));
    }
  }
  request(path: string, method = 'GET', body: Row = {}): Promise<any> {
    const job = this.queue.then(async () => {
      const candidate = structuredClone(this.state);
      const result = this.execute(candidate, path, method.toUpperCase(), body);
      if (method.toUpperCase() !== 'GET') {
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
    if (name === 'auth' && uuid === 'logout' && method === 'POST') return { ok: true };
    if (name === 'auth' || name === 'share-invites' || relation === 'members') {
      throw new LocalApiError('Contas e compartilhamento entre usuários precisam do servidor e não estão disponíveis nesta demo local.', 501);
    }
    if (!collections.includes(name as Collection)) throw new LocalApiError('Recurso indisponível na demo.', 404);
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
      throw new LocalApiError('Operação indisponível na demo.', 501);
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
      if (collection === 'attachments') state.tables['work-events'] = state.tables['work-events'].filter(event => event.metadata?.attachmentUuid !== uuid);
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
    if (['works', 'groups', 'expenses', 'revenues'].includes(collection) && !String(row.name ?? '').trim()) throw new LocalApiError('Informe um nome.');
    if (collection === 'tasks' && !String(row.title ?? '').trim()) throw new LocalApiError('Informe um título.');
    if (['expenses', 'revenues'].includes(collection) && (!Number.isFinite(row.amount) || row.amount <= 0 || !row.workUuid)) throw new LocalApiError('Informe uma obra e um valor positivo.');
    if (row.workUuid && !state.tables.works.some(work => work.uuid === row.workUuid)) throw new LocalApiError('Obra não encontrada.', 404);
    if (collection === 'tasks') row.workName = state.tables.works.find(work => work.uuid === row.workUuid)?.name ?? null;
    if (collection === 'attachments' && (!existing || payload.dataUrl)) {
      if (typeof row.dataUrl !== 'string' || !/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,/.test(row.dataUrl)) throw new LocalApiError('Use uma imagem PNG, JPEG, WebP, GIF ou PDF.');
      if (row.dataUrl.length > 8 * 1024 * 1024) throw new LocalApiError('Arquivo muito grande para a demo (máximo aproximado: 6 MB).');
      row.publicUrl = row.dataUrl; row.filename = row.uuid; row.mimeType = row.dataUrl.slice(5, row.dataUrl.indexOf(';')); row.size = Math.floor(row.dataUrl.split(',')[1].length * 3 / 4);
      delete row.dataUrl;
    }
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
