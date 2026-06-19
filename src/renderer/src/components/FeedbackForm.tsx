import { useState } from 'react'

// In-app feedback: ideas, bugs, or anything else. Submits through the main
// process to the Cloudflare Worker (see src/main/index.ts). The optional email +
// consent checkbox is the start of the (opt-in) news/tips list.
type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; msg: string }

const TYPES = [
  { id: 'idea', label: '💡 Idea' },
  { id: 'bug', label: '🐞 Bug' },
  { id: 'other', label: '💬 Other' }
] as const

export default function FeedbackForm({ onClose }: { onClose: () => void }): JSX.Element {
  const [type, setType] = useState<'idea' | 'bug' | 'other'>('idea')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const submit = async (): Promise<void> => {
    if (!message.trim()) return
    setStatus({ kind: 'sending' })
    const res = await window.api.submitFeedback({
      type,
      message: message.trim(),
      email: email.trim() || undefined,
      consent: consent && !!email.trim()
    })
    if (res.ok) setStatus({ kind: 'sent' })
    else
      setStatus({
        kind: 'error',
        msg:
          res.reason === 'not-configured'
            ? 'Feedback delivery isn’t switched on yet.'
            : `Couldn’t send (${res.reason || 'unknown error'}).`
      })
  }

  if (status.kind === 'sent') {
    return (
      <div className="feedback">
        <p className="feedback-thanks">Thanks — your feedback was sent! 🙌</p>
        <div className="feedback-actions">
          <button className="btn btn-run" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="feedback">
      <p className="feedback-intro">
        Found a bug or have an idea? Tell us — it goes straight to the developer.
      </p>

      <div className="feedback-types">
        {TYPES.map((t) => (
          <button
            key={t.id}
            className={'feedback-type' + (type === t.id ? ' active' : '')}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        className="feedback-message"
        placeholder="What’s on your mind?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
      />

      <input
        className="feedback-email"
        type="email"
        placeholder="Your email (optional — so we can reply)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label className="feedback-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Email me Retro80 tips, new features & news (optional)
      </label>

      {status.kind === 'error' && (
        <p className="feedback-error">
          {status.msg} You can also email <strong>w.edstrom@gmail.com</strong>.
        </p>
      )}

      <div className="feedback-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-run"
          onClick={submit}
          disabled={!message.trim() || status.kind === 'sending'}
        >
          {status.kind === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
