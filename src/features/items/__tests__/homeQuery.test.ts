import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { loadHome } from '../homeQuery';

function setup() {
  const repos = createRepos(createTestDb());
  repos.packs.apply(
    { name: 'Study & Career', category: 'Study & Career', version: '1', pinned: true, items: [{ title: 'STAR template', body: 'S T A R', description: 'x' }] },
    { source: 'builtin' },
  );
  repos.packs.apply(
    {
      name: 'Git',
      category: 'Daily dev work',
      version: '1',
      items: [
        { title: 'Stash', body: 'git stash', description: 'x', language: 'bash' },
        { title: 'Rebase', body: 'git rebase -i', description: 'x', language: 'bash', tags: ['history'] },
        { title: 'Python venv', body: 'python -m venv .venv', description: 'x', language: 'python' },
      ],
    },
    { source: 'builtin' },
  );
  return repos;
}

describe('loadHome', () => {
  it('browse mode shows pinned (Study & Career by default) and most used, without duplicates', () => {
    const repos = setup();
    const stash = repos.items.list({ category: 'Daily dev work' }).find((i) => i.title === 'Stash')!;
    repos.items.recordCopy(stash.id);
    const star = repos.items.search('star')[0];
    repos.items.recordCopy(star.id);
    const data = loadHome(repos, { text: '' });
    if (data.mode !== 'browse') throw new Error('expected browse');
    expect(data.pinned.map((i) => i.title)).toEqual(['STAR template']);
    expect(data.mostUsed.map((i) => i.title)).toEqual(['Stash']);
    expect(data.categories).toEqual(['Daily dev work', 'Study & Career']);
    expect(data.languages).toEqual(['bash', 'python']);
  });

  it('category and language filters switch to a result list', () => {
    const repos = setup();
    const byCat = loadHome(repos, { text: '', category: 'Daily dev work' });
    expect(byCat.mode === 'results' && byCat.items.map((i) => i.title)).toEqual(['Python venv', 'Rebase', 'Stash']);
    const byLang = loadHome(repos, { text: '', language: 'python' });
    expect(byLang.mode === 'results' && byLang.items.map((i) => i.title)).toEqual(['Python venv']);
    const byTag = loadHome(repos, { text: '', tag: 'history' });
    expect(byTag.mode === 'results' && byTag.items.map((i) => i.title)).toEqual(['Rebase']);
  });

  it('searches with prefix matching and combines with filters', () => {
    const repos = setup();
    const r = loadHome(repos, { text: ' reb ' });
    expect(r.mode === 'results' && r.items.map((i) => i.title)).toEqual(['Rebase']);
    const none = loadHome(repos, { text: 'reb', language: 'python' });
    expect(none.mode === 'results' && none.items).toEqual([]);
  });

  it('is empty-safe on a fresh database', () => {
    const data = loadHome(createRepos(createTestDb()), { text: '' });
    expect(data).toMatchObject({ mode: 'browse', pinned: [], mostUsed: [], categories: [], languages: [] });
  });
});
