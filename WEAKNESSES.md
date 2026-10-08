# Known weaknesses and gaps

Written honestly, most important first. "Not verified" means I did not run it, so do not assume it works.

## Not verified on a real device or in a real build

1. **The app has never been run on a phone or emulator.** The build sandbox has no Android SDK and no display.
   What was actually checked: unit and screen tests (React Native Testing Library, mocked router), TypeScript, ESLint,
   and `expo export --platform android`, which bundles all JavaScript and proves every import resolves.
   Layout, spacing, scrolling feel, keyboard behaviour, the share sheet, the file picker, and TalkBack are untested.
2. **The APK was never built.** `dl.google.com` (Android SDK downloads) is blocked by the sandbox network policy, so
   `./gradlew assembleRelease` and the signing step could not run. `expo prebuild --platform android` did succeed here.
   The workflow's Gradle, `zipalign`, `apksigner` and release-upload steps are untested; expect that the first tag
   build may need a fix (for example a different build-tools path, JDK version, or `versionCode` handling).
3. **The on-device database path is untested.** All database tests run on `better-sqlite3` through the same Drizzle API.
   The app uses `expo-sqlite`'s synchronous API. I read the Drizzle expo driver and expo-sqlite's Android build flags
   (FTS5 is compiled in by default) but did not execute either on Android.
4. **First-launch cost is unmeasured on a phone.** Installing the 660 entries takes about 1.2 s on a desktop (Node +
   better-sqlite3). The app does it one pack per event-loop tick behind a "Setting up your starter library" progress
   screen, but each pack's transaction still blocks the JS thread briefly, and a phone will be several times slower than a desktop.

## Content

5. **Starter pack content was written from memory and not executed.** I stuck to mainstream commands I am confident about,
   but I did not run every snippet. Some depend on versions: `git switch/restore` (Git 2.23+), Django 5.1's
   `CheckConstraint(condition=...)`, mikefarah `yq` v4 syntax, Node 18.11/20.6 flags, Tailwind v4 setup, recent
   scikit-learn. Android shortcuts vary by manufacturer. Treat the packs as a good start, and edit anything that is wrong for you.
6. **Study & Career is generic.** APA 7 rules are summarised, not exhaustive; check your institution's guide.
7. **Variable syntax collisions.** Any `{{simple_name}}` is treated as a fill-in variable, including in Postman or Go
   templates. The form lets you leave fields empty (the placeholder is kept), but it is still a prompt you may not want.
8. **Packs are not localised** and there is no pack for languages such as Java, C#, Go or Rust.

## Behaviour

9. **Search is basic.** FTS5 `unicode61` tokens with prefix matching: no stemming, no typo tolerance, no phrase or
   `OR` syntax. Punctuation splits tokens, so `.gitignore`, `c++` and `-i` become `gitignore`, `c` and `i`. The bm25 weights are my guess.
10. **Home filters show at most 500 items** and search at most 100. Fine for the starter data, but a very large
    imported library would be truncated silently.
11. **Pack updates match items by title.** Renaming an item in an upstream pack looks like remove + add, so its pin and
    usage are lost unless you had edited it. Imported JSON packs update only when `version` changes. tldr import handles a
    single page per URL, and its placeholder conversion is lossy (`{{path/to/file}}` becomes `{{path_to_file}}`; option
    placeholders like `{{[-o|--output]}}` always collapse to the short form).
12. **Merge import matches standalone items by title + body**, so a slightly edited copy is added as a new item.
    Backups do not include theme/font settings.
13. **Orphaned tags are never pruned** from the `tags` table (they do not show anywhere; harmless but they accumulate).
14. **No sync, no cloud backup, no encryption.** Backups are plain JSON. Android's own Auto Backup may or may not
    restore the database on a new phone; not tested.
15. **Everything runs on the JS thread**: the database calls are synchronous, and a 1 MB pack import or a large backup
    parse can briefly freeze the UI.

## Polish

16. No custom app icon, adaptive icon or splash screen (Expo defaults), and no tablet/landscape layout work.
17. Accessibility: roles and labels are set on interactive elements, but contrast, touch-target sizes and TalkBack
    order were not audited. The font-size setting scales the app's own text only (not system navigation headers).
18. The syntax highlighter is a heuristic tokenizer: no multi-line strings or nested constructs, and unknown
    languages fall back to a generic rule set.
19. Delete confirmations use the native `Alert`; there is no undo.
20. Screen tests render screens with a stand-in for `expo-router`, so real navigation (params, back stack, tab state) is untested.
