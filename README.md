# DevCheat

An offline-first Android app for **short, reusable developer snippets and commands**. It is
copy-first, not a long-form notes app: find the thing, press **Copy**, paste it. For personal use,
with no backend and no accounts. Everything lives in a SQLite database on the phone.

- Search as you type (SQLite FTS5, prefix matching) across title, body, description and tags
- Filter chips by category and language; pinned items and most-used items on Home
- `{{variable}}` placeholders: Copy asks for the values and copies the filled text
- About 660 starter entries in 34 packs (Git, Docker, Django, SQL, networking, study and career...)
- Collections, tags, pin, usage tracking (use count, last used)
- Import packs from a URL (DevCheat JSON or [tldr-pages](https://github.com/tldr-pages/tldr) Markdown) and update them later
- Light, dark or system theme; adjustable font size
- Export and import your whole library as JSON

Stack: Expo (SDK 57) with Expo Router, React Native, TypeScript (strict), expo-sqlite + Drizzle ORM
(FTS5 for search), Zustand, Jest + React Native Testing Library.

## Run it

Requirements: Node 22 and npm. For a phone you need Expo Go (or an Android emulator / USB debugging).

```bash
npm install
npx expo start            # scan the QR code with Expo Go, or press "a" for an emulator
```

Handy scripts:

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Jest: database, services, pack validation, screens |
| `npm run packs:index` | Regenerate `assets/packs/index.ts` after adding a pack file |
| `npx expo export --platform android` | Bundle the JS without a device (quick sanity check) |

### Project layout

```
app/                  Expo Router screens (tabs: Home, Collections, Packs, Settings; item and collection screens)
src/features/         items, collections, packs, settings (+ common UI)
src/data/             repositories: the only layer that touches SQLite
src/db/               Drizzle schema, SQL migrations (incl. FTS5 + triggers), client
src/services/         template variables, highlighter, pack parser/fetcher, backup
src/store/            Zustand stores (settings, copy flow, toast, library revision)
assets/packs/*.json   built-in starter packs (+ generated index.ts)
.github/workflows/    CI and release
```

Rules that matter when changing things:

- Only `src/data` talks to the database. Screens call repositories through `getRepos()`.
- Migrations in `src/db/migrations.ts` are append-only. Never edit a shipped migration; add a new one.
  `src/db/__tests__/schema.test.ts` fails if the Drizzle schema and the migrations drift apart.

## Template variables

Write `{{name}}` in an item body. On **Copy**, DevCheat shows a small form with one field per
variable and copies the filled text. Empty fields stay as `{{name}}` so a forgotten value is visible.

A placeholder is `{{` + an identifier (letters, digits, underscore) + `}}`. These are deliberately
**not** placeholders, so other template languages copy verbatim: `${{ secrets.TOKEN }}` (GitHub
Actions), `{{ user.name }}` (Django/Jinja, dotted names), `{{ 1 + 2 }}`.

## Packs

A pack is a JSON file. Built-in packs are loaded on first launch; you can import more from a URL.

### How to add a pack

1. Create `assets/packs/my-pack.json`:

```json
{
  "name": "My pack",
  "category": "Daily dev work",
  "version": "1",
  "pinned": false,
  "items": [
    {
      "title": "Undo last commit",
      "body": "git reset --soft HEAD~1",
      "description": "Keeps your changes staged.",
      "type": "command",
      "language": "bash",
      "tags": ["git", "undo"]
    }
  ]
}
```

| Field | Notes |
| --- | --- |
| `name` | Required, unique across packs. It is the identity of the pack. |
| `category` | Required. Shown as a filter chip on Home. Built-in categories: Study & Career, Daily dev work, My own stack, QA, Data & ML, Infrastructure, Reference. |
| `version` | Required string or number. Bump it whenever you change content, so installed copies update. |
| `pinned` | Optional. `true` inserts the pack's items with `pinned = 1`. Only the Study & Career pack uses it. |
| `items[].title` | Required, unique inside the pack (case-insensitive). |
| `items[].body` | Required. May contain `{{variables}}`. |
| `items[].description` | Required for built-in packs (one line). Optional for imported packs. |
| `items[].type` | `snippet` (default), `command` or `checklist`. |
| `items[].language` | Optional, for highlighting (`bash`, `python`, `sql`, `yaml`, `js`...). |
| `items[].tags` | Optional array of strings. |

2. Run `npm run packs:index` (adds the file to `assets/packs/index.ts`; Metro needs static imports).
3. Run `npm test`. The pack validator checks every file: required fields, valid `type`, no duplicate
   titles, balanced `{{ }}`, a known category, 12 to 25 items, and that Study & Career is the only pack that is pinned.
4. For a built-in pack with a new category, also add it to `src/services/packs/categories.ts`.

### Merge rules (what a pack update may and may not touch)

- Items you created, or edited, have `source = 'user'`. A pack refresh **never modifies or deletes them**. Editing a pack item turns it into your own item.
- Existing pack items are matched by title. Their text is updated; **pin state, use count and last-used are kept**, so an item you unpinned is not re-pinned.
- New items in an update follow the pack default (pinned only for Study & Career).
- Items removed from the pack are deleted (unless you edited them).
- Built-in packs update when the bundled `version` changes (on app upgrade). A pack you removed is not reinstalled.

### Importing from a URL

Packs tab, **Import from URL**. `https://` only, up to 1 MB, 15 s timeout. Supported:

- a DevCheat pack (`.json`, the format above); GitHub "blob" page URLs are rewritten to raw URLs
- a tldr-pages page (`.md`), converted to a pack of `command` items; `{{path/to/file}}` becomes `{{path_to_file}}`

**Update** on an imported pack downloads the same URL again and applies the merge rules. A failed
download shows a message and changes nothing.

## Backup

Settings, **Export library (JSON)** opens the Android share sheet (save to Drive, files, email).
**Import library** lets you choose **Merge** (add what is missing, keep everything on the device)
or **Replace all** (wipe, then restore). The file holds items, tags, collections and packs with pins and usage.
It is plain text: treat it like any file containing your notes.

## Release (build the APK on GitHub)

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and a JavaScript bundle check (`expo export`) on every push and pull request.
When you push a tag that starts with `v`, it also runs `expo prebuild --platform android`,
`./gradlew assembleRelease`, aligns and signs the APK with your keystore, and attaches
`DevCheat-<tag>.apk` to a GitHub Release.

### One-time setup: signing secrets

Create the keystore (keep the file and passwords private, never commit them, and back them up:
an update must be signed with the same key as the installed app):

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore devcheat-release.keystore \
  -alias devcheat \
  -keyalg RSA -keysize 2048 -validity 10000
```

Encode it (Linux; on macOS use `base64 -i devcheat-release.keystore | tr -d '\n' > keystore.b64`):

```bash
base64 -w0 devcheat-release.keystore > keystore.b64
```

Add four repository secrets under *Settings > Secrets and variables > Actions*:

| Secret | Value |
| --- | --- |
| `KEYSTORE_BASE64` | contents of `keystore.b64` |
| `KEYSTORE_PASSWORD` | the keystore password |
| `KEY_ALIAS` | `devcheat` (the `-alias` you used) |
| `KEY_PASSWORD` | the key password (for a PKCS12 keystore like the one above, the same as the keystore password) |

With the GitHub CLI:

```bash
gh secret set KEYSTORE_BASE64 < keystore.b64
gh secret set KEYSTORE_PASSWORD
gh secret set KEY_ALIAS --body devcheat
gh secret set KEY_PASSWORD
```

### Cut a release

```bash
# bump "version" (and android.versionCode) in app.json first, then:
git tag v1.0.0
git push origin v1.0.0
```

Download `DevCheat-v1.0.0.apk` from the GitHub Release on your phone and install it (allow
"install unknown apps" for your browser). Android refuses to install an update signed with a
different key, so keep the keystore.

## Known gaps

See [WEAKNESSES.md](WEAKNESSES.md) for an honest list, [DECISIONS.md](DECISIONS.md) for why things are the way they are,
and [TEST_OUTPUT.txt](TEST_OUTPUT.txt) for real command output.
