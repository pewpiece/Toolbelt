import { ITEM_TYPES, type ItemInput, type ItemType } from './types';

export const LIMITS = {
  title: 200,
  body: 20000,
  description: 1000,
  tag: 30,
  tags: 20,
  language: 30,
  collectionName: 60,
} as const;

export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export interface CleanItemInput {
  title: string;
  body: string;
  description: string;
  type: ItemType;
  language: string | null;
  tags: string[];
}

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
}

export function normalizeTags(raw: string[] | undefined): string[] {
  const out: string[] = [];
  for (const t of raw ?? []) {
    const n = normalizeTag(t);
    if (!n) continue;
    if (n.length > LIMITS.tag) throw new ValidationError('tags', `Tag "${n}" is too long (max ${LIMITS.tag}).`);
    if (!out.includes(n)) out.push(n);
  }
  if (out.length > LIMITS.tags) throw new ValidationError('tags', `Too many tags (max ${LIMITS.tags}).`);
  return out;
}

/** Trims and validates item input; throws ValidationError naming the offending field. */
export function cleanItemInput(input: ItemInput): CleanItemInput {
  const title = (input.title ?? '').trim();
  if (!title) throw new ValidationError('title', 'Title is required.');
  if (title.length > LIMITS.title) throw new ValidationError('title', `Title is too long (max ${LIMITS.title}).`);

  const body = input.body ?? '';
  if (!body.trim()) throw new ValidationError('body', 'Body is required.');
  if (body.length > LIMITS.body) throw new ValidationError('body', `Body is too long (max ${LIMITS.body}).`);

  const description = (input.description ?? '').trim();
  if (description.length > LIMITS.description) {
    throw new ValidationError('description', `Description is too long (max ${LIMITS.description}).`);
  }

  const type = input.type ?? 'snippet';
  if (!ITEM_TYPES.includes(type)) throw new ValidationError('type', `Unknown type "${type}".`);

  const language = input.language?.trim().toLowerCase() || null;
  if (language && language.length > LIMITS.language) {
    throw new ValidationError('language', `Language is too long (max ${LIMITS.language}).`);
  }

  return { title, body, description, type, language, tags: normalizeTags(input.tags) };
}

export function cleanCollectionName(raw: string): string {
  const name = (raw ?? '').trim();
  if (!name) throw new ValidationError('name', 'Name is required.');
  if (name.length > LIMITS.collectionName) {
    throw new ValidationError('name', `Name is too long (max ${LIMITS.collectionName}).`);
  }
  return name;
}
