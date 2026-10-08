import { extractVariables, fillTemplate, hasBalancedBraces } from '../template';

describe('template variables', () => {
  it('extracts unique variables in order', () => {
    expect(extractVariables('ssh {{user}}@{{ host }} -p {{port}} # {{user}}')).toEqual(['user', 'host', 'port']);
  });

  it('ignores GitHub Actions expressions and dotted/Jinja expressions', () => {
    expect(extractVariables('token: ${{ secrets.GITHUB_TOKEN }}')).toEqual([]);
    expect(extractVariables('<h1>{{ post.title }}</h1> {{ name|upper }} {{ 1 + 2 }}')).toEqual([]);
    expect(extractVariables('${{ matrix_os }} and {{real}}')).toEqual(['real']);
  });

  it('fills values, leaving empty or missing ones visible', () => {
    expect(fillTemplate('git checkout -b {{branch}} {{base}}', { branch: 'feat/x', base: '' })).toBe(
      'git checkout -b feat/x {{base}}',
    );
    expect(fillTemplate('{{a}}-{{a}}', { a: '1' })).toBe('1-1');
    expect(fillTemplate('no vars', {})).toBe('no vars');
  });

  it('does not re-expand dollar signs in replacement values', () => {
    expect(fillTemplate('echo {{v}}', { v: '$1 $& $$' })).toBe('echo $1 $& $$');
  });

  it('checks brace balance', () => {
    expect(hasBalancedBraces('{{a}} ${{ b }}')).toBe(true);
    expect(hasBalancedBraces('no braces at all')).toBe(true);
    expect(hasBalancedBraces('{{a}')).toBe(false);
    expect(hasBalancedBraces('{{a')).toBe(false);
    expect(hasBalancedBraces('{{a {{b}}')).toBe(false);
    expect(hasBalancedBraces('{{ user.name }} and {{x}')).toBe(false);
  });

  it('allows stray closing braces from nested JSON/dict literals', () => {
    expect(hasBalancedBraces('{"a": {"b": 1}}')).toBe(true);
    expect(hasBalancedBraces('LOGGING = {"root": {"level": "INFO"}} and {{name}}')).toBe(true);
  });
});
