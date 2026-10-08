import { validatePack } from '../validate';

const good = () => ({
  name: 'P',
  category: 'C',
  version: '1',
  items: [{ title: 'A', body: 'b', description: 'd', type: 'command', language: 'bash', tags: ['x'] }],
});

describe('validatePack', () => {
  it('accepts a valid pack and normalizes it', () => {
    const r = validatePack({ ...good(), version: 3, pinned: true });
    expect(r.ok && r.pack).toMatchObject({ name: 'P', version: '3', pinned: true });
  });

  it('collects every problem', () => {
    const r = validatePack({ name: '', category: 5, items: 'no' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['not an object', [], /JSON object/],
    ['missing title', { ...good(), items: [{ body: 'b', description: 'd' }] }, /"title" is required/],
    ['missing body', { ...good(), items: [{ title: 'A', description: 'd' }] }, /"body" is required/],
    ['bad type', { ...good(), items: [{ title: 'A', body: 'b', description: 'd', type: 'note' }] }, /invalid "type"/],
    ['bad tags', { ...good(), items: [{ title: 'A', body: 'b', description: 'd', tags: [1] }] }, /"tags"/],
    ['duplicate title', { ...good(), items: [good().items[0], { ...good().items[0], title: ' a ' }] }, /duplicate title/],
    ['unbalanced braces', { ...good(), items: [{ title: 'A', body: 'x {{y}', description: 'd' }] }, /unbalanced/],
    ['bad pinned', { ...good(), pinned: 'yes' }, /"pinned"/],
    ['empty items', { ...good(), items: [] }, /must not be empty/],
  ])('rejects: %s', (_label, raw, message) => {
    const r = validatePack(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(message);
  });

  it('requires descriptions only in strict mode', () => {
    const raw = { ...good(), items: [{ title: 'A', body: 'b' }] };
    expect(validatePack(raw).ok).toBe(true);
    expect(validatePack(raw, { requireDescriptions: true }).ok).toBe(false);
  });
});
