# Releasing Retro80

Retro80 ships as a **signed, notarized macOS app** that **auto-updates** itself
from GitHub Releases. This document is the single source of truth for cutting a
release.

> **TL;DR for a routine release:**
> ```bash
> ./scripts/release.sh 0.40.0 "What changed in this version"
> ```
> That bumps the version, builds, signs, notarizes, publishes to GitHub, and
> flips the release live. Installed users get an in-app "Update available"
> notice on their next launch.

---

## How updates reach users

- The app uses [`electron-updater`](https://www.electron.build/auto-update),
  configured in [`electron-builder.yml`](electron-builder.yml) (`publish: github`).
- On every launch the app silently checks the **latest GitHub release**. If it's
  newer, an "Update available" toast appears (code in
  [`src/main/updater.ts`](src/main/updater.ts) +
  [`src/renderer/src/components/UpdateBanner.tsx`](src/renderer/src/components/UpdateBanner.tsx)).
  Users can also trigger a check from **Retro80 menu → Check for Updates…**.
- Nothing downloads or installs without a click. The user chooses Download, then
  Restart & Install.
- The updater reads `latest-mac.yml` and the `-mac.zip` asset from the release —
  both are produced and uploaded automatically by the release script. **A release
  is invisible to the updater until it is published (not a draft) and marked
  Latest.** The script handles this.

---

## One-time setup (per machine)

You only do these once. They're already done on the original dev machine.

### 1. Apple Developer ID certificate
You need a **Developer ID Application** certificate in your login keychain
(requires a paid Apple Developer Program membership).

Easiest path — **Xcode → Settings → Accounts**:
1. Add your Apple ID if it isn't listed.
2. Select your team → **Manage Certificates…**
3. Click **+** → **Developer ID Application**.

Verify:
```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

### 2. Notarization credentials (`.env`)
Create a **gitignored** `.env` at the repo root:
```bash
APPLE_ID=you@example.com
APPLE_TEAM_ID=XXXXXXXXXX            # 10-char Team ID from developer.apple.com
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop   # from appleid.apple.com → App-Specific Passwords
```
Sanity-check the credentials without doing a full build:
```bash
set -a; . ./.env; set +a
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
```
"No submission history" (or a list) = success. A 401 = wrong credentials.

### 3. GitHub CLI
The release script uses `gh` both to publish the release and to supply the
publish token (`GH_TOKEN`), so no token is stored on disk.
```bash
gh auth status   # should show you logged in with 'repo' scope
```

> **Toolchain note:** this machine has no system Node or Homebrew. Node lives at
> `~/.local/node` and `gh` at `~/.local/bin`. The release script adds both to
> `PATH` itself, so you don't need to.

---

## Cutting a release

```bash
./scripts/release.sh <version> ["release notes"]
```

The script ([`scripts/release.sh`](scripts/release.sh)) runs these steps and
stops on the first failure:

1. **Pre-flight** — clean git tree, on `main`, `.env` present, `gh` authed,
   signing cert present, and the new version is greater than the current one.
2. **Bump** `package.json` to the new version.
3. **Build** (`npm run build`, which also bumps `build-number.json`).
4. **Commit + push** the version/build bump to `origin/main`.
5. **Sign → notarize → publish** the `.dmg`/`.zip`/`latest-mac.yml` to a GitHub
   release (electron-builder creates it as a **draft**).
6. **Publish** the draft (draft → live) with the release notes.

If you omit the notes, the script auto-generates them from the commit messages
since the last tag.

---

## Troubleshooting

**Keychain prompt keeps popping up during signing** ("codesign wants to access
key…"). The app has many nested binaries; each access prompts. Click
**"Always Allow"** (not "Allow") and enter your login password once — it sets the
keychain ACL and the prompts stop for good.

**`HTTP status code: 500 … Please try again at a later time`** during
notarization. This is a transient error on **Apple's** side, not your setup.
Just re-run `./scripts/release.sh <same version>` — your credentials are fine.
(If the version commit already landed, the pre-flight "already at version" check
will stop you; bump to the next patch, or reset the last commit and retry.)

**"Working tree is dirty"** — commit or stash your changes first; the script
wants the version bump to be the only change it introduces.

**The update doesn't show up for users.** Confirm the release is **not a draft**
and is marked **Latest**:
```bash
gh release list --repo BillEdstrom/retro80
```
Also confirm `latest-mac.yml` is attached to the release.

---

## Verifying a build is properly signed & notarized

```bash
spctl -a -vvv -t exec "/Applications/Retro80.app"   # expect: accepted, source=Notarized Developer ID
xcrun stapler validate "/Applications/Retro80.app"  # expect: The validate action worked!
```

## Testing the update flow on a single Mac

You don't need a second computer:
1. Install the current release into `/Applications` and run it.
2. Cut the next version with the release script.
3. In the running (older) app, use **Check for Updates…** → Download →
   Restart & Install. It relaunches as the new version.
