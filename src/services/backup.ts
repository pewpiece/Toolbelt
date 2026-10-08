import type { BackupFile, BackupImportSummary, ImportMode } from '@/data/backupRepo';
import type { Repos } from '@/data';
import { ITEM_TYPES } from '@/data/types';
import { LIMITS, normalizeTag } from '@/data/validation';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const MAX_BACKUP_CHARS = 20_000_000;
const SOURCES = ['user', 'builtin', 'tldr', 'url'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, field: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new BackupError(`Invalid "${field}" in backup file.`);
  return v;
};
const str = (v: unknown, field: string): string => {
  if (typeof v !== 'string') throw new BackupError(`Invalid "${field}" in backup file.`);
  return v;
};

/** Serialises the whole library. Pretty-printed so a backup is diff-able and human-readable. */
export function createBackupJson(repos: Repos): string {
  return JSON.stringify(repos.backup.exportAll(), null, 2);
}

export function backupFileName(now = new Date()): string {
  return `devcheat-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** Parses and strictly validates untrusted backup text. Throws BackupError with a readable reason. */
export function parseBackup(text: string): BackupFile {
  if (!text.trim()) throw new BackupError('The file is empty.');
  if (text.length > MAX_BACKUP_CHARS) throw new BackupError('The file is too large to be a DevCheat backup.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('This is not a valid JSON file.');
  }
  if (!isObj(raw) || raw.app !== 'devcheat') throw new BackupError('This file is not a DevCheat backup.');
  if (raw.formatVersion !== 1) {
    throw new BackupError(`Unsupported backup version (${String(raw.formatVersion)}). Update DevCheat and try again.`);
  }
  if (!Array.isArray(raw.packs) || !Array.isArray(raw.items) || !Array.isArray(raw.collections)) {
    throw new BackupError('The backup is missing packs, items or collections.');
  }

  const packs = raw.packs.map((p, i) => {
    if (!isObj(p)) throw new BackupError(`packs[${i}] is not an object.`);
    const name = str(p.name, 'pack name').trim();
    if (!name) throw new BackupError(`packs[${i}] has no name.`);
    return {
      name,
      category: str(p.category, 'pack category'),
      sourceUrl: p.sourceUrl === null || p.sourceUrl === undefined ? null : str(p.sourceUrl, 'sourceUrl'),
      version: str(p.version, 'pack version'),
      pinnedDefault: p.pinnedDefault === true,
      installedAt: num(p.installedAt, 'installedAt'),
    };
  });

  const items = raw.items.map((it, i) => {
    if (!isObj(it)) throw new BackupError(`items[${i}] is not an object.`);
    const title = str(it.title, 'title').trim();
    const body = str(it.body, 'body');
    if (!title || !body.trim()) throw new BackupError(`items[${i}] needs a title and a body.`);
    if (title.length > LIMITS.title || body.length > LIMITS.body) throw new BackupError(`items[${i}] ("${title.slice(0, 40)}") is too long.`);
    const type = str(it.type, 'type');
    if (!(ITEM_TYPES as readonly string[]).includes(type)) throw new BackupError(`items[${i}] has an unknown type "${type}".`);
    const source = str(it.source, 'source');
    if (!SOURCES.includes(source)) throw new BackupError(`items[${i}] has an unknown source "${source}".`);
    const tags = Array.isArray(it.tags)
      ? [...new Set(it.tags.filter((t): t is string => typeof t === 'string').map(normalizeTag).filter((t) => t && t.length <= LIMITS.tag))]
      : [];
    return {
      id: num(it.id, 'item id'),
      title,
      body,
      description: typeof it.description === 'string' ? it.description : '',
      type: type as BackupFile['items'][number]['type'],
      language: typeof it.language === 'string' && it.language ? it.language : null,
      source: source as BackupFile['items'][number]['source'],
      packName: typeof it.packName === 'string' ? it.packName : null,
      pinned: it.pinned === true,
      useCount: Math.max(0, Math.trunc(num(it.useCount ?? 0, 'useCount'))),
      lastUsedAt: it.lastUsedAt === null || it.lastUsedAt === undefined ? null : num(it.lastUsedAt, 'lastUsedAt'),
      createdAt: num(it.createdAt, 'createdAt'),
      updatedAt: num(it.updatedAt, 'updatedAt'),
      tags,
    };
  });

  const collections = raw.collections.map((c, i) => {
    if (!isObj(c)) throw new BackupError(`collections[${i}] is not an object.`);
    const name = str(c.name, 'collection name').trim();
    if (!name) throw new BackupError(`collections[${i}] has no name.`);
    const itemIds = Array.isArray(c.itemIds) ? c.itemIds.filter((x): x is number => typeof x === 'number') : [];
    return { name: name.slice(0, LIMITS.collectionName), createdAt: num(c.createdAt, 'collection createdAt'), itemIds };
  });

  return {
    app: 'devcheat',
    formatVersion: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    packs,
    items,
    collections,
  };
}

export function restoreBackup(repos: Repos, text: string, mode: ImportMode): BackupImportSummary {
  return repos.backup.importAll(parseBackup(text), mode);
}

export function describeRestore(s: BackupImportSummary): string {
  const parts = [`${s.itemsAdded} items added`];
  if (s.itemsSkipped) parts.push(`${s.itemsSkipped} already present`);
  if (s.packsAdded) parts.push(`${s.packsAdded} packs`);
  if (s.collectionsAdded) parts.push(`${s.collectionsAdded} collections`);
  return `${s.mode === 'replace' ? 'Library replaced' : 'Backup merged'}: ${parts.join(', ')}.`;
}
