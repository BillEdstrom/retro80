# retro80-feedback (Cloudflare Worker)

Receives in-app feedback and opt-in email signups from Retro80 (and, via the
`app` field, any future app) and stores them in a D1 database.

## Endpoints
- `POST /feedback` — body `{ app, version, os, type, message, email?, consent? }`
- `GET /admin?key=<ADMIN_KEY>` — recent submissions as JSON
- `GET /` — health check

## One-time deploy

Requires a (free) Cloudflare account. `wrangler` is installed at `~/.local/bin`.

```bash
cd cloudflare/feedback-worker
wrangler login                              # opens browser; you authorize

# Create the database, then paste the printed database_id into wrangler.toml
wrangler d1 create retro80-feedback

# Create the table
wrangler d1 execute retro80-feedback --remote --file=schema.sql

# Set the admin key (any long random string) for the /admin endpoint
wrangler secret put ADMIN_KEY

# Deploy — prints your Worker URL, e.g. https://retro80-feedback.<you>.workers.dev
wrangler deploy
```

Then put the URL in the app's `.env`:
```
FEEDBACK_URL=https://retro80-feedback.<you>.workers.dev/feedback
```
…and cut a release so the app posts to it.

## Reading submissions
```bash
# JSON in the browser / curl:
curl "https://retro80-feedback.<you>.workers.dev/admin?key=<ADMIN_KEY>"

# or straight from D1:
wrangler d1 execute retro80-feedback --remote --command "SELECT * FROM submissions ORDER BY id DESC LIMIT 50"

# everyone who opted into the news/tips list:
wrangler d1 execute retro80-feedback --remote --command "SELECT DISTINCT email FROM submissions WHERE consent=1 AND email IS NOT NULL"
```
