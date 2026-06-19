// Retro80 feedback Worker — receives in-app feedback + (opt-in) email signups
// and stores them in a D1 (SQLite) database. Reusable across apps via the `app`
// field on each submission.
//
// Endpoints:
//   POST /feedback        { app, version, os, type, message, email?, consent? }
//   GET  /admin?key=...   list recent submissions as JSON (token-protected)
//
// Bindings (see wrangler.toml): DB (D1). Secret: ADMIN_KEY (wrangler secret put).

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))

    if (request.method === 'POST' && url.pathname === '/feedback') {
      let body
      try {
        body = await request.json()
      } catch {
        return cors(json({ error: 'invalid JSON' }, 400))
      }
      const message = String(body.message || '').trim().slice(0, 5000)
      if (!message) return cors(json({ error: 'message is required' }, 400))

      await env.DB.prepare(
        `INSERT INTO submissions (created_at, app, version, os, type, message, email, consent)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
        .bind(
          new Date().toISOString(),
          String(body.app || 'unknown').slice(0, 64),
          String(body.version || '').slice(0, 32),
          String(body.os || '').slice(0, 64),
          String(body.type || 'other').slice(0, 32),
          message,
          body.email ? String(body.email).slice(0, 200) : null,
          body.consent ? 1 : 0
        )
        .run()

      return cors(json({ ok: true }))
    }

    if (request.method === 'GET' && url.pathname === '/admin') {
      if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
        return json({ error: 'unauthorized' }, 401)
      }
      const { results } = await env.DB.prepare(
        `SELECT * FROM submissions ORDER BY id DESC LIMIT 200`
      ).all()
      return json({ count: results.length, submissions: results })
    }

    // A bare GET to the root is handy for a quick "is it up?" check.
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'retro80-feedback' })
    }

    return json({ error: 'not found' }, 404)
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'content-type')
  return res
}
