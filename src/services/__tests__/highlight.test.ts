import { tokenize } from '../highlight';

const kinds = (code: string, lang?: string) =>
  tokenize(code, lang)
    .filter((t) => t.kind !== 'plain')
    .map((t) => `${t.kind}:${t.text}`);

describe('tokenize', () => {
  it('round-trips the original text', () => {
    const code = 'for f in *.txt; do # comment\n  echo "hi $f" --flag 42\ndone\n{{var}}';
    expect(tokenize(code, 'bash').map((t) => t.text).join('')).toBe(code);
  });

  it('colours bash comments, strings, flags, keywords and placeholders', () => {
    expect(kinds('git commit -m "msg" # note {{x}}', 'bash')).toEqual([
      'keyword:git',
      'flag:-m',
      'string:"msg"',
      'comment:# note {{x}}',
    ]);
    expect(kinds('ssh {{user}}@host', 'bash')).toEqual(['keyword:ssh', 'placeholder:{{user}}']);
  });

  it('does not treat $# or a#b as comments', () => {
    expect(kinds('echo $# a#b', 'bash')).toEqual(['keyword:echo']);
  });

  it('handles python, sql (case-insensitive) and block comments', () => {
    expect(kinds('def f(): return 1', 'python')).toEqual(['keyword:def', 'keyword:return', 'number:1']);
    expect(kinds('SELECT a FROM t -- x', 'sql')).toEqual(['keyword:SELECT', 'keyword:FROM', 'comment:-- x']);
    expect(kinds('a /* c */ b', 'js')).toEqual(['comment:/* c */']);
  });

  it('does not hang on unterminated strings or comments', () => {
    expect(tokenize('echo "abc', 'bash').map((t) => t.text).join('')).toBe('echo "abc');
    expect(tokenize('/* open', 'js')[0].kind).toBe('comment');
    expect(tokenize('', 'js')).toEqual([]);
  });

  it('does not colour placeholders that follow a dollar sign', () => {
    expect(kinds('${{ secrets.X }}', 'yaml')).toEqual([]);
  });
});
