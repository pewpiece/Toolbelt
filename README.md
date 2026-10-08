# DevCheat

Offline-first Android app (Expo React Native, TypeScript) that stores short, reusable
developer snippets and commands. Copy-first, not a notes app. (Full docs are completed in
the final milestone.)

## CI and releases

`.github/workflows/ci.yml` runs lint, typecheck and tests on every push and pull request.
Pushing a tag that starts with `v` (for example `v1.0.0`) additionally runs
`expo prebuild --platform android`, `./gradlew assembleRelease`, signs the APK with your
keystore and attaches `DevCheat-<tag>.apk` to a GitHub Release.

### Required repository secrets

| Secret | Meaning |
| --- | --- |
| `KEYSTORE_BASE64` | The release keystore file, base64-encoded on one line |
| `KEYSTORE_PASSWORD` | The keystore password |
| `KEY_ALIAS` | The key alias inside the keystore |
| `KEY_PASSWORD` | The password of that key |

Create the keystore (keep the file and passwords private, never commit them; back them up,
because an app update must be signed with the same key):

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

Add the four secrets under *Settings > Secrets and variables > Actions*, or with the GitHub CLI:

```bash
gh secret set KEYSTORE_BASE64 < keystore.b64
gh secret set KEYSTORE_PASSWORD   # prompts for the value
gh secret set KEY_ALIAS --body devcheat
gh secret set KEY_PASSWORD        # prompts for the value
```

Then release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```
