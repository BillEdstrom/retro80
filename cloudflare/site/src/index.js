// Retro80 site Worker — serves the landing page (static assets in public/) and
// handles POST /subscribe: saves the email to D1 and, when the access code is
// correct, returns the live download link for the latest GitHub release.

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/subscribe') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'invalid JSON' }, 400)
      }

      const email = String(body.email || '').trim().slice(0, 200)
      const code = String(body.code || '').trim()
      const consent = body.consent ? 1 : 0
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ ok: false, reason: 'bad-email' }, 400)
      }

      const granted = code.toUpperCase() === String(env.ACCESS_CODE || '').toUpperCase()

      // Capture the email either way (so a wrong code is still a lead). One row
      // per email; re-signups update the latest values.
      try {
        await env.DB.prepare(
          `INSERT INTO subscribers (created_at, email, consent, code, granted, app, ua)
           VALUES (?1, ?2, ?3, ?4, ?5, 'retro80', ?6)
           ON CONFLICT(email) DO UPDATE SET
             created_at=excluded.created_at, consent=excluded.consent,
             code=excluded.code, granted=MAX(subscribers.granted, excluded.granted)`
        )
          .bind(
            new Date().toISOString(),
            email,
            consent,
            code.slice(0, 64),
            granted ? 1 : 0,
            (request.headers.get('user-agent') || '').slice(0, 200)
          )
          .run()
      } catch (e) {
        return json({ ok: false, reason: 'store-failed', detail: String(e) }, 500)
      }

      if (!granted) return json({ ok: false, reason: 'bad-code' })
      const download = await latestDmgUrl(env.GITHUB_REPO)
      return json({ ok: true, download })
    }

    // Everything else: static assets (the landing page). With [assets] set,
    // matching files are served before the Worker runs; this is the fallback.
    return env.ASSETS.fetch(request)
  }
}

// Find the .dmg asset on the latest GitHub release; fall back to the releases page.
async function latestDmgUrl(repo) {
  const fallback = `https://github.com/${repo}/releases/latest`
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'user-agent': 'retro80-site', accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return fallback
    const rel = await res.json()
    const dmg = (rel.assets || []).find((a) => a.name && a.name.endsWith('.dmg'))
    return dmg ? dmg.browser_download_url : fallback
  } catch {
    return fallback
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}
