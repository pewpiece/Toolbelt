import type { Repos } from '@/data';
import type { ApplyPackResult, PackDef } from '@/data/types';

import { assertHttpsUrl, fetchText, normalizePackUrl, PackFetchError, type FetchOptions } from './fetch';
import { looksLikeTldr, parseTldr } from './tldr';
import { validatePack } from './validate';

export class PackImportError extends Error {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'PackImportError';
    this.details = details;
  }
}

export interface ParsedPack {
  pack: PackDef;
  source: 'url' | 'tldr';
}

/** Detects JSON vs tldr Markdown and returns a validated pack. Throws PackImportError. */
export function parsePackText(text: string): ParsedPack {
  const trimmed = text.trim();
  if (!trimmed) throw new PackImportError('The file is empty.');

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      throw new PackImportError('The file looks like JSON but could not be parsed.');
    }
    const result = validatePack(raw);
    if (!result.ok) {
      throw new PackImportError(`Not a valid pack: ${result.errors[0]}`, result.errors);
    }
    return { pack: result.pack, source: 'url' };
  }

  if (looksLikeTldr(trimmed)) {
    try {
      return { pack: parseTldr(trimmed), source: 'tldr' };
    } catch (e) {
      throw new PackImportError(e instanceof Error ? e.message : 'Could not read the tldr page.');
    }
  }
  throw new PackImportError('Unrecognised format. Expected a DevCheat pack (JSON) or a tldr-pages Markdown page.');
}

export interface ImportSummary extends ApplyPackResult {
  name: string;
  upToDate?: boolean;
}

export function createPackService(repos: Repos, fetchOptions: FetchOptions = {}) {
  return {
    /** Download, validate and install (or refresh) a pack from a URL. */
    async importFromUrl(rawUrl: string): Promise<ImportSummary> {
      const url = assertHttpsUrl(rawUrl);
      const text = await fetchText(url, fetchOptions);
      const { pack, source } = parsePackText(text);

      const existing = repos.packs.findByName(pack.name);
      if (existing && existing.sourceUrl !== url) {
        throw new PackImportError(
          `A pack named "${pack.name}" is already installed${existing.sourceUrl ? ' from a different URL' : ' (built-in)'}. Rename the pack in the file to import it separately.`,
        );
      }
      const result = repos.packs.apply(pack, { source, sourceUrl: url });
      return { ...result, name: pack.name };
    },

    /** Re-download an imported pack and merge it (user items are never touched). */
    async updatePack(packId: number): Promise<ImportSummary> {
      const installed = repos.packs.get(packId);
      if (!installed) throw new PackImportError('That pack is no longer installed.');
      if (!installed.sourceUrl) {
        throw new PackImportError('Built-in packs are updated with the app, not from the network.');
      }
      const text = await fetchText(normalizePackUrl(installed.sourceUrl), fetchOptions);
      const { pack, source } = parsePackText(text);
      if (pack.name !== installed.name) {
        throw new PackImportError(`The file now contains a pack called "${pack.name}", not "${installed.name}". Import it as a new pack instead.`);
      }
      if (pack.version === installed.version) {
        return { packId, created: false, added: 0, updated: 0, removed: 0, skippedUser: 0, name: pack.name, upToDate: true };
      }
      const result = repos.packs.apply(pack, { source, sourceUrl: installed.sourceUrl });
      return { ...result, name: pack.name };
    },
  };
}

export function describeImportError(e: unknown): string {
  if (e instanceof PackFetchError || e instanceof PackImportError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}

export function summarize(r: ImportSummary): string {
  if (r.upToDate) return `${r.name} is already up to date.`;
  const parts = [`${r.added} added`, `${r.updated} updated`];
  if (r.removed) parts.push(`${r.removed} removed`);
  if (r.skippedUser) parts.push(`${r.skippedUser} of your edited items kept`);
  return `${r.name}: ${parts.join(', ')}.`;
}
