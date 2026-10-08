import type { PackDef, PackItemDef } from '@/data/types';

export const TLDR_CATEGORY = 'tldr pages';

/** True when the text looks like a tldr-pages Markdown page (`# name` heading, `- description:` + backtick command). */
export function looksLikeTldr(text: string): boolean {
  return /^\s*#\s+\S/.test(text) && /^`[^`]+`\s*$/m.test(text) && /^-\s+.+:\s*$/m.test(text);
}

/**
 * tldr placeholders (`{{path/to/file}}`) become our identifier-style variables
 * (`{{path_to_file}}`). The tldr option syntax `{{[-o|--output]}}` collapses to its short form.
 */
export function convertPlaceholders(command: string): string {
  return command.replace(/\{\{([^{}]+)\}\}/g, (_whole, inner: string) => {
    const opt = inner.match(/^\[([^|\]]+)\|([^\]]+)\]$/);
    if (opt) return opt[1];
    let name = inner.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!name) name = 'value';
    if (/^\d/.test(name)) name = `_${name}`;
    return `{{${name}}}`;
  });
}

/** Small stable hash used as the version of a tldr page, so "Update" can tell when content changed. */
export function contentVersion(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `tldr-${(h >>> 0).toString(16)}`;
}

export function parseTldr(text: string): PackDef {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const heading = lines.find((l) => /^\s*#\s+\S/.test(l));
  const command = heading ? heading.replace(/^\s*#\s+/, '').trim() : '';
  if (!command) throw new Error('This does not look like a tldr page (no "# command" heading).');

  const summary = lines
    .filter((l) => l.startsWith('>'))
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter((l) => l && !/^more information:/i.test(l) && !/^see also:/i.test(l))
    .join(' ');

  const items: PackItemDef[] = [];
  const used = new Set<string>();
  let pendingTitle: string | null = null;
  for (const line of lines) {
    const desc = line.match(/^-\s+(.+?):?\s*$/);
    if (desc && !line.startsWith('`')) {
      pendingTitle = desc[1].trim();
      continue;
    }
    const cmd = line.match(/^`(.+)`\s*$/);
    if (cmd && pendingTitle) {
      let title = `${command}: ${pendingTitle}`;
      for (let n = 2; used.has(title.toLowerCase()); n++) title = `${command}: ${pendingTitle} (${n})`;
      used.add(title.toLowerCase());
      items.push({
        title,
        body: convertPlaceholders(cmd[1]),
        description: summary || pendingTitle,
        type: 'command',
        language: 'bash',
        tags: [command],
      });
      pendingTitle = null;
    }
  }
  if (items.length === 0) throw new Error('No examples found in this tldr page.');

  return { name: `tldr: ${command}`, category: TLDR_CATEGORY, version: contentVersion(text), pinned: false, items };
}
