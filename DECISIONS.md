# Decisions

Decisions made while building DevCheat without asking questions, with the reason for each.

## Platform and tooling

- **Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6 (strict).** Current stable at build time.
  Versions come from `expo/bundledNativeModules.json` because `npx expo install` could not reach
  `api.expo.dev` from the build sandbox.
- **Every dependency is pinned exactly** (`.npmrc` has `save-exact=true`; `package-lock.json` is committed;
  CI uses `npm ci`). No `^` or `~` anywhere.
- **Minimal native surface.** Only the modules the brief names (expo-sqlite, expo-clipboard,
  expo-file-system, expo-sharing, expo-document-picker) plus what Expo Router needs
  (linking, safe-area-context, screens, constants, status-bar, system-ui). No icon font, no
  AsyncStorage, no syntax-highlighting or date library.
- **`react-dom` is pinned** (19.2.3, same as `react`) although the app is Android only: without it npm
  resolved a mismatched `react-dom` as a peer of Expo Router and failed with ERESOLVE.
- **`test-renderer` is an explicit devDependency** because React Native Testing Library 14 lists it as a peer.
- **Application id `com.devcheat.app`.** Change it in `app.json` before publishing anywhere else.
- **Node 22 in CI.** Also lets the tests use the same `better-sqlite3` prebuilt binaries as locally.

## Database

- **Drizzle for the schema and typed queries, hand-written SQL for migrations.** drizzle-kit cannot emit FTS5
  virtual tables or triggers, so `src/db/migrations.ts` holds ordered SQL statements applied inside
  transactions and tracked with `PRAGMA user_version`. A test (`schema.test.ts`) compares the
  Drizzle schema with the migrated database so the two cannot silently drift. drizzle-kit was removed as unused.
- **Synchronous drivers.** The app uses expo-sqlite's sync API through Drizzle; tests use `better-sqlite3`
  through the same Drizzle API. Repositories are therefore synchronous and one `AppDb` type serves both.
  Trade-off: work runs on the JS thread (fine for this data size).
- **FTS5 table is standalone** (not external-content) because the `tags` column is derived from another table.
  Triggers keep it in sync for item insert/update/delete, tag attach/detach and tag rename. `recordCopy` updates
  only counters, so Copy never touches the index.
- **Search:** each word becomes a quoted prefix term (`"git"* "reb"*`), joined with AND. Quoting makes
  FTS operators in user text harmless. Results are ranked with `bm25` weighted title 10, body 1,
  description 3, tags 5 (arbitrary but sensible; title hits first).
- **Foreign keys on.** `items.pack_id` is `ON DELETE SET NULL`, not `CASCADE`, so removing a pack can never
  delete user items. `PacksRepo.remove` deletes only non-user items explicitly.
- **Settings live in a small `settings` table** instead of a second storage library.
- **Timestamps are epoch milliseconds.** Tags are lower-case, trimmed, `#` stripped, spaces become `-`.

## Packs and merge rules

- **Pack identity = `name` (unique); item identity inside a pack = `title`.** Simple and predictable; renaming a title
  in a pack update looks like remove + add.
- **Editing a pack item makes it the user's** (`source` becomes `user`). That is what lets "refresh never touches
  `source = 'user'`" also protect edits. The edit form says so.
- **A user item with the same title as a pack entry wins**: the pack entry is skipped and reported.
- **Update keeps `pinned`, `use_count`, `last_used_at`.** Pinned-by-default is applied only when an item is
  first inserted. New items that appear in a later update follow the pack default.
- **First-launch seeding is incremental**: one pack per event-loop tick (a generator shared by the sync version used in
  tests and the async version used by the app), with a progress screen. Desktop timing was 1.2 s for all 34 packs; a
  blocking single pass on a phone could leave a blank screen for much longer.
- **Built-in packs update with the app**: on launch, a bundled pack replaces the installed copy only when its
  `version` string differs. A removed built-in pack stays removed (`seededPacks` setting).
- **Imported packs cannot overwrite a pack with the same name from a different source** (for example a built-in);
  the user is told to rename. Updating checks the file still names the same pack.
- **Imported pack versions** are compared as strings; tldr pages use a content hash as version so Update can tell.
- **Network rules:** `https://` only (Android blocks cleartext by default anyway), 1 MB cap, 15 s timeout,
  GitHub `blob` URLs rewritten to raw. Errors are typed and human-readable; a failed fetch changes nothing.
- **Validation:** `balanced {{ }}` means every `{{` is closed before the next `{{` and `{{name}` typos are caught.
  A stray `}}` is allowed because code legitimately ends nested dicts/JSON with `}}`.
  (The first, naive count-based version was rejected by the pack tests on real content.)
- **Pack size:** the brief asks for about 12 to 25 entries per pack; the validator test enforces exactly 12 to 25
  (real packs range from 13 to 25, 660 entries in 34 packs). Entries are short and each has a one-line description.
- **Starter content was authored with a throw-away generator script** (kept outside the repo so JSON escaping is
  always correct); only the generated JSON is committed. `scripts/update-pack-index.js` regenerates the import list.

## Template variables

- `{{identifier}}` only, never preceded by `$`. Chosen so GitHub Actions (`${{ secrets.X }}`), Django/Jinja
  (`{{ user.name }}`) and Go templates copy verbatim. Empty values leave the placeholder in place so mistakes are visible.
- tldr placeholders (`{{path/to/file}}`) are converted to identifiers (`{{path_to_file}}`).

## UI

- **Four tabs** (Home, Collections, Packs, Settings) with text labels; add/edit/detail are stack screens.
- **Home** shows pinned + most-used until you search or pick a chip, then a single result list.
  Study & Career is pinned by data (the pack's `pinned: true`), not by special-casing.
- **Syntax highlighting is a 150-line tokenizer** (comments, strings, numbers, keywords, CLI flags, placeholders)
  rather than a library; good enough for short snippets, and adds no dependency.
- **Dark/light:** two palettes; "system" follows the OS. Font size is one base size from which the others scale.
- **Destructive actions confirm** (delete item/collection/pack, replace-all import).
- **State:** Zustand for settings, the copy flow and toasts; screens re-query SQLite on focus and whenever a
  global `revision` counter changes, instead of caching lists in stores.

## Backup

- JSON, `formatVersion: 1`, pretty-printed. Items reference packs by name and collections reference item ids inside the file.
- **Merge** never changes anything already on the device (pack items match by pack + title, standalone items by title + body).
  **Replace** wipes packs/items/tags/collections first. Both run in one transaction.
- Settings (theme, font size) are not part of the backup; they are per-device preferences.

## CI and release

- Release job runs only for `v*` tags and only after the check job passes.
- Expo's prebuild template signs release builds with the debug key; the workflow therefore **aligns and re-signs with
  `apksigner`** using the keystore from secrets, then runs `apksigner verify`. The keystore file is deleted after use.
- The job fails early with a clear message when any of the four secrets is missing.
- CI also runs `expo export --platform android` so a broken import fails the check job, not the release.
- **Android permissions: INTERNET only** (pack import). Storage, overlay and vibrate permissions that the Expo template adds
  are blocked in `app.json`; the file picker and share sheet use the system UI and need no permission.

## Testing

- Database and repository tests run against real SQLite (`better-sqlite3`, FTS5 enabled), not mocks.
- Screen tests use React Native Testing Library with a small `expo-router` stand-in (`src/test/expoRouterMock.tsx`).
- `testTimeout` is 30 s because the first React Native test on a cold transform cache (CI) takes several seconds.
