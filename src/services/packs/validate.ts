import { ITEM_TYPES, type PackDef, type PackItemDef } from '@/data/types';
import { LIMITS } from '@/data/validation';

import { hasBalancedBraces } from '../template';

const MAX_PACK_ITEMS = 1000;

export type ValidationResult = { ok: true; pack: PackDef } | { ok: false; errors: string[] };

export interface ValidateOptions {
  /** Built-in packs must also have a non-empty description on every item. */
  requireDescriptions?: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Validates untrusted pack JSON and returns a normalized PackDef, or every problem found. */
export function validatePack(raw: unknown, opts: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];
  if (!isObject(raw)) return { ok: false, errors: ['Pack must be a JSON object.'] };

  const name = str(raw.name)?.trim() ?? '';
  const category = str(raw.category)?.trim() ?? '';
  if (!name) errors.push('"name" is required.');
  if (!category) errors.push('"category" is required.');

  let version = '';
  if (typeof raw.version === 'string' && raw.version.trim()) version = raw.version.trim();
  else if (typeof raw.version === 'number' && Number.isFinite(raw.version)) version = String(raw.version);
  else errors.push('"version" is required (a string or number).');

  if (raw.pinned !== undefined && typeof raw.pinned !== 'boolean') errors.push('"pinned" must be true or false.');

  if (!Array.isArray(raw.items)) {
    errors.push('"items" must be an array.');
    return { ok: false, errors };
  }
  if (raw.items.length === 0) errors.push('"items" must not be empty.');
  if (raw.items.length > MAX_PACK_ITEMS) errors.push(`Too many items (max ${MAX_PACK_ITEMS}).`);

  const items: PackItemDef[] = [];
  const titles = new Set<string>();
  raw.items.slice(0, MAX_PACK_ITEMS).forEach((entry, idx) => {
    const where = `items[${idx}]`;
    if (!isObject(entry)) {
      errors.push(`${where} must be an object.`);
      return;
    }
    const title = str(entry.title)?.trim() ?? '';
    const body = str(entry.body) ?? '';
    const description = str(entry.description)?.trim() ?? '';
    const label = title ? `${where} ("${title}")` : where;

    if (!title) errors.push(`${where}: "title" is required.`);
    else if (title.length > LIMITS.title) errors.push(`${label}: title is too long.`);
    if (!body.trim()) errors.push(`${label}: "body" is required.`);
    else if (body.length > LIMITS.body) errors.push(`${label}: body is too long.`);
    if (opts.requireDescriptions && !description) errors.push(`${label}: "description" is required.`);
    if (description.length > LIMITS.description) errors.push(`${label}: description is too long.`);

    let type: PackItemDef['type'];
    if (entry.type !== undefined) {
      if (typeof entry.type === 'string' && (ITEM_TYPES as readonly string[]).includes(entry.type)) {
        type = entry.type as PackItemDef['type'];
      } else {
        errors.push(`${label}: invalid "type" (use ${ITEM_TYPES.join(', ')}).`);
      }
    }

    let language: string | null = null;
    if (entry.language !== undefined && entry.language !== null) {
      if (typeof entry.language === 'string') language = entry.language;
      else errors.push(`${label}: "language" must be a string.`);
    }

    let tags: string[] | undefined;
    if (entry.tags !== undefined) {
      if (Array.isArray(entry.tags) && entry.tags.every((t) => typeof t === 'string')) tags = entry.tags as string[];
      else errors.push(`${label}: "tags" must be an array of strings.`);
    }

    for (const [field, text] of [['title', title], ['body', body], ['description', description]] as const) {
      if (!hasBalancedBraces(text)) errors.push(`${label}: unbalanced {{ }} in ${field}.`);
    }

    if (title) {
      const key = title.toLowerCase();
      if (titles.has(key)) errors.push(`${label}: duplicate title in this pack.`);
      titles.add(key);
    }

    items.push({ title, body, description, type, language, tags });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, pack: { name, category, version, pinned: raw.pinned === true, items } };
}
