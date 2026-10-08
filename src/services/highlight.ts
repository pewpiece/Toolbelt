/**
 * A small, dependency-free tokenizer for display-only syntax colouring. It is not a real
 * parser: it recognises comments, strings, numbers, a keyword list per language family,
 * CLI flags, and `{{placeholders}}`, which is enough to make short snippets readable.
 */
export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'flag' | 'placeholder';

export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS: Record<string, string[]> = {
  shell: 'if then else elif fi for while do done case esac function in return exit local export readonly set unset echo cd source sudo git docker npm npx pip python python3 curl grep find sed awk cat ls rm mv cp mkdir chmod chown tar ssh systemctl'.split(' '),
  python: 'def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue None True False async await global'.split(' '),
  js: 'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof interface type enum null undefined true false'.split(' '),
  sql: 'select from where group by order having join left right inner outer full on as and or not null insert into values update set delete create table index alter drop distinct limit offset union over partition with case when then else end is in like exists primary key references unique'.split(' '),
  generic: 'if else for while return function class const let var def import from true false null'.split(' '),
};

const FAMILY: Record<string, { keywords: string[]; line: string[]; block?: [string, string]; ci?: boolean }> = {
  shell: { keywords: KEYWORDS.shell, line: ['#'] },
  python: { keywords: KEYWORDS.python, line: ['#'] },
  js: { keywords: KEYWORDS.js, line: ['//'], block: ['/*', '*/'] },
  sql: { keywords: KEYWORDS.sql, line: ['--'], block: ['/*', '*/'], ci: true },
  yaml: { keywords: ['true', 'false', 'null'], line: ['#'] },
  css: { keywords: [], line: [], block: ['/*', '*/'] },
  generic: { keywords: KEYWORDS.generic, line: ['#', '//'], block: ['/*', '*/'] },
};

const LANG_TO_FAMILY: Record<string, keyof typeof FAMILY> = {
  bash: 'shell', sh: 'shell', shell: 'shell', zsh: 'shell', dockerfile: 'shell', nginx: 'shell', ini: 'shell',
  python: 'python', py: 'python', toml: 'python',
  javascript: 'js', js: 'js', typescript: 'js', ts: 'js', tsx: 'js', jsx: 'js', java: 'js', go: 'js', rust: 'js', c: 'js', cpp: 'js', json: 'js',
  sql: 'sql', postgresql: 'sql', psql: 'sql',
  yaml: 'yaml', yml: 'yaml',
  css: 'css', scss: 'css',
};

function familyFor(language: string | null | undefined) {
  const key = (language ?? '').toLowerCase();
  return FAMILY[LANG_TO_FAMILY[key] ?? 'generic'];
}

const NUMBER = /^\d+(\.\d+)?/;
const WORD = /^[A-Za-z_][A-Za-z0-9_]*/;
const FLAG = /^--?[A-Za-z][\w-]*/;
const PLACEHOLDER = /^\{\{\s*[A-Za-z_]\w*\s*\}\}/;

export function tokenize(code: string, language?: string | null): Token[] {
  const fam = familyFor(language);
  const keywords = new Set(fam.keywords);
  const out: Token[] = [];
  let plain = '';
  const flush = () => {
    if (plain) out.push({ text: plain, kind: 'plain' });
    plain = '';
  };
  const push = (text: string, kind: TokenKind) => {
    flush();
    out.push({ text, kind });
  };

  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);

    const ph = rest.match(PLACEHOLDER);
    if (ph && code[i - 1] !== '$') {
      push(ph[0], 'placeholder');
      i += ph[0].length;
      continue;
    }

    if (fam.block && rest.startsWith(fam.block[0])) {
      const end = code.indexOf(fam.block[1], i + fam.block[0].length);
      const stop = end === -1 ? code.length : end + fam.block[1].length;
      push(code.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    const lineMarker = fam.line.find((m) => rest.startsWith(m));
    // A `#` right after a word character is part of a token (e.g. `$#`, `foo#bar`), not a comment.
    if (lineMarker && !(lineMarker === '#' && /[\w$]/.test(code[i - 1] ?? ''))) {
      const nl = code.indexOf('\n', i);
      const stop = nl === -1 ? code.length : nl;
      push(code.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch && !(code[j] === '\n' && ch !== '`')) {
        if (code[j] === '\\') j++;
        j++;
      }
      const stop = Math.min(j + 1, code.length);
      push(code.slice(i, stop), 'string');
      i = stop;
      continue;
    }

    if (/\d/.test(ch) && !/[\w]/.test(code[i - 1] ?? '')) {
      const n = rest.match(NUMBER)!;
      push(n[0], 'number');
      i += n[0].length;
      continue;
    }

    if (ch === '-' && /\s/.test(code[i - 1] ?? ' ') && (!language || LANG_TO_FAMILY[language.toLowerCase()] === 'shell')) {
      const f = rest.match(FLAG);
      if (f) {
        push(f[0], 'flag');
        i += f[0].length;
        continue;
      }
    }

    const w = rest.match(WORD);
    if (w) {
      const word = w[0];
      const isKw = keywords.has(fam.ci ? word.toLowerCase() : word);
      if (isKw) push(word, 'keyword');
      else plain += word;
      i += word.length;
      continue;
    }

    plain += ch;
    i++;
  }
  flush();
  return out;
}
