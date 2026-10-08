/**
 * `{{variable}}` placeholders.
 *
 * A placeholder is `{{` + optional spaces + an identifier (letters, digits, underscore,
 * not starting with a digit) + optional spaces + `}}`. Deliberately NOT placeholders, so
 * snippets for other template languages copy verbatim:
 *   - `${{ secrets.TOKEN }}` (GitHub Actions: preceded by `$`)
 *   - `{{ user.name }}`      (Django/Jinja: dotted names, filters, expressions)
 */
const PLACEHOLDER = /(?<!\$)\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Unique placeholder names in order of first appearance. */
export function extractVariables(body: string): string[] {
  const seen: string[] = [];
  for (const m of body.matchAll(PLACEHOLDER)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/**
 * Replaces placeholders with values. A variable with no value (or an empty one) is left
 * as `{{name}}` so a forgotten field is visible in the pasted text instead of silently vanishing.
 */
export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER, (whole, name: string) => {
    const v = values[name];
    return v === undefined || v === '' ? whole : v;
  });
}

/**
 * True when every `{{` is closed by a `}}` before the next `{{`, and no identifier-style
 * placeholder is closed with a single brace (`{{name}`). A stray `}}` is allowed because
 * code legitimately ends nested dicts/JSON with `}}` (`{"a": {"b": 1}}`).
 */
export function hasBalancedBraces(text: string): boolean {
  if (/\{\{\s*[A-Za-z_]\w*\s*\}(?!\})/.test(text)) return false;
  let i = 0;
  while (true) {
    const open = text.indexOf('{{', i);
    if (open === -1) return true;
    const close = text.indexOf('}}', open + 2);
    if (close === -1) return false;
    const nextOpen = text.indexOf('{{', open + 2);
    if (nextOpen !== -1 && nextOpen < close) return false;
    i = close + 2;
  }
}
