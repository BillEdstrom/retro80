#!/usr/bin/env bash
#
# release.sh — cut a signed, notarized Retro80 release and publish it to GitHub.
# ---------------------------------------------------------------------------
# This wraps the entire release pipeline into one command. See RELEASING.md in
# the repo root for the full guide (prerequisites, troubleshooting, how the
# auto-updater consumes what this produces).
#
# USAGE:
#   ./scripts/release.sh <version> ["release notes..."]
#
#   ./scripts/release.sh 0.40.0
#   ./scripts/release.sh 0.40.0 "Adds a new game and fixes the editor gutter."
#
# WHAT IT DOES:
#   1. Pre-flight checks (clean git tree, on main, .env present, gh authed,
#      Developer ID cert in keychain).
#   2. Bumps the version in package.json.
#   3. Builds the app (also bumps build-number.json).
#   4. Commits the version + build bump and pushes to origin/main.
#   5. Signs + notarizes + publishes the .dmg/.zip + latest-mac.yml to a GitHub
#      release (created as a draft by electron-builder).
#   6. Publishes that draft (flips draft -> live) with release notes, so the
#      auto-updater can see it.
#
# PREREQUISITES (one-time, documented in RELEASING.md):
#   - Apple "Developer ID Application" certificate installed in the login keychain.
#   - A gitignored .env at the repo root with:
#       APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD
#   - The GitHub CLI (`gh`) installed and authenticated (`gh auth status`).
#
# NOTES:
#   - The FIRST signing of a session may pop a keychain dialog repeatedly —
#     click "Always Allow" (not "Allow") once and it stops.
#   - Apple's notary service occasionally returns a transient HTTP 500. If the
#     build fails there, just re-run this script; nothing else needs redoing.
#
set -euo pipefail

# --- locate repo root (this script lives in <root>/scripts) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# --- make the portable toolchain visible (no system node/homebrew here) ---
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"

die() { echo "❌ $*" >&2; exit 1; }
step() { echo ""; echo "▶ $*"; }

# --- args ---
VERSION="${1:-}"
[ -n "$VERSION" ] || die "Usage: ./scripts/release.sh <version> [\"release notes\"]"
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' \
  || die "Version must look like X.Y.Z (got: $VERSION)"
NOTES="${2:-}"
TAG="v$VERSION"

step "Pre-flight checks"

# Tooling present?
command -v node >/dev/null || die "node not found on PATH (~/.local/node/bin)"
command -v gh   >/dev/null || die "gh (GitHub CLI) not found on PATH (~/.local/bin)"

# Credentials / signing?
[ -f "$ROOT/.env" ] || die ".env not found at repo root (APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD)"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run: gh auth login"
security find-identity -v -p codesigning | grep -q "Developer ID Application" \
  || die "No 'Developer ID Application' certificate in keychain (see RELEASING.md)"

# Clean tree on main?
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || echo "⚠️  Not on 'main' (on '$BRANCH') — continuing anyway."
[ -z "$(git status --porcelain)" ] || die "Working tree is dirty — commit or stash first."

# New version must differ from current.
CURRENT="$(node -p "require('./package.json').version")"
[ "$CURRENT" != "$VERSION" ] || die "package.json is already $VERSION"
# Highest version wins (electron-updater needs the new one to be greater).
HIGHEST="$(printf '%s\n%s\n' "$CURRENT" "$VERSION" | sort -V | tail -1)"
[ "$HIGHEST" = "$VERSION" ] || die "$VERSION is not greater than current $CURRENT"

echo "✓ $CURRENT → $VERSION   branch=$BRANCH   tree=clean"

# Auto-generate release notes from commits since the last tag, if none given.
if [ -z "$NOTES" ]; then
  LAST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
  if [ -n "$LAST_TAG" ]; then
    NOTES="$(git log --pretty=format:'- %s' "$LAST_TAG"..HEAD | grep -vi '^- Release v' || true)"
  fi
  [ -n "$NOTES" ] || NOTES="Retro80 $TAG"
fi

step "Bumping version to $VERSION"
node -e "const fs=require('fs');const p=require('./package.json');p.version='$VERSION';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"

# Load .env BEFORE building: Vite bakes SENTRY_DSN / FEEDBACK_URL into the bundle
# at `npm run build` time (they're read from process.env). Sourcing afterwards
# only reaches the packaging step, which would ship them empty.
step "Loading build-time config from .env"
set -a; . "$ROOT/.env"; set +a

step "Building (also bumps build-number.json)"
npm run build
# Verify the env-driven defines actually made it into the bundle (fail loudly if
# not — `grep -q` reflects grep's own exit code, unlike `grep | head`).
if [ -n "${SENTRY_DSN:-}" ] && ! grep -q "ingest.*sentry.io" out/main/index.js; then
  die "SENTRY_DSN did not bake into the build — aborting."
fi
if [ -n "${FEEDBACK_URL:-}" ] && ! grep -q "$(printf '%s' "$FEEDBACK_URL" | sed 's/[\/&]/\\&/g; s|https\?://||')" out/main/index.js; then
  die "FEEDBACK_URL did not bake into the build — aborting."
fi

step "Committing and pushing"
git add package.json build-number.json
git commit -m "Release $TAG"
git push origin "$BRANCH"

step "Signing + notarizing + publishing to GitHub (this can take a few minutes)"
export GH_TOKEN="$(gh auth token)"
./node_modules/.bin/electron-builder --mac --publish always

step "Publishing the GitHub release (draft → live)"
gh release edit "$TAG" --repo BillEdstrom/retro80 \
  --draft=false \
  --title "Retro80 $TAG" \
  --notes "$NOTES"

echo ""
echo "✅ Released $TAG"
echo "   https://github.com/BillEdstrom/retro80/releases/tag/$TAG"
echo "   Installed users will see the in-app 'Update available' notice on their next launch."
