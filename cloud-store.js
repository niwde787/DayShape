export const collections = ['profiles', 'activities', 'entries', 'goals', 'routines'];
export const emptyData = () => Object.fromEntries([['version', 1], ...collections.map(k => [k, []])]);
export const clean = value => JSON.parse(JSON.stringify(value));
export const recordKey = (kind, id) => `${kind}__${id}`;
export function validData(data) {
  return data?.version === 1 && collections.every(k => Array.isArray(data[k]) && data[k].every(r =>
    r && typeof r.id === 'string' && r.id.length > 0 && !r.id.includes('/') && typeof r.updatedAt === 'string'));
}
export function changedRecords(before, after) {
  const changed = [];
  for (const kind of collections) {
    const old = new Map(before[kind].map(r => [r.id, r]));
    for (const value of after[kind]) {
      if (JSON.stringify(old.get(value.id)) !== JSON.stringify(value)) changed.push({kind, value: clean(value)});
    }
  }
  return changed;
}
export function overlayRecords(remote, pending) {
  const result = clean(remote);
  for (const {kind, value} of Object.values(pending)) {
    const index = result[kind].findIndex(r => r.id === value.id);
    if (index < 0) result[kind].push(value); else result[kind][index] = value;
  }
  return result;
}
// Pending records and the displayed snapshot are persisted atomically. A failed
// browser save must never be reported as a durable offline save.
export class CloudStore {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
    const saved = JSON.parse(storage.getItem(key) || 'null');
    if (saved && (!validData(saved.data) || !saved.pending || typeof saved.pending !== 'object')) throw Error('Your offline cloud copy could not be read. Export your data before continuing.');
    this.data = saved?.data || emptyData();
    this.pending = saved?.pending || {};
  }
  commit(data, pending) {
    this.storage.setItem(this.key, JSON.stringify({data, pending}));
    this.data = data;
    this.pending = pending;
    return data;
  }
  edit(after) {
    if (!validData(after)) throw Error('This data could not be saved. Export a backup and try again.');
    const pending = {...this.pending};
    for (const row of changedRecords(this.data, after)) pending[recordKey(row.kind, row.value.id)] = {...row, token: crypto.randomUUID()};
    return this.commit(clean(after), pending);
  }
  receive(remote) { return this.commit(overlayRecords(remote, this.pending), this.pending); }
  acknowledge(key, token) {
    if (this.pending[key]?.token !== token) return;
    const pending = {...this.pending};
    delete pending[key];
    this.commit(this.data, pending);
  }
  // Import only absent IDs. Existing cloud records (including deletions) win,
  // so importing the same device twice never duplicates or resurrects records.
  importLocal(local) {
    if (!validData(local)) throw Error('The local backup has an unsupported format.');
    const result = clean(this.data);
    for (const kind of collections) {
      const ids = new Set(result[kind].map(r => r.id));
      result[kind].push(...local[kind].filter(r => !ids.has(r.id)));
    }
    return this.edit(result);
  }
}
