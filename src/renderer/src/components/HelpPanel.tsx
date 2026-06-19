import { useEffect } from 'react'
import type { ProgramHelp } from '../programHelp'

interface Props {
  help: ProgramHelp
  onClose: () => void
}

// The "operator's manual" overlay: about / how to play / tips & hints.
// Used by the TRS-80 emulator view and the Retro80 console. Esc closes.
export default function HelpPanel({ help, onClose }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="trs80-help" onClick={(e) => e.stopPropagation()}>
      <div className="trs80-help-head">
        <span>OPERATOR&apos;S MANUAL</span>
        <button className="trs80-help-close" onClick={onClose} title="Close (Esc)">
          ×
        </button>
      </div>
      <div className="trs80-help-body">
        <p className="trs80-help-about">{help.about}</p>
        <h4>HOW TO PLAY</h4>
        <ul>
          {help.play.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <h4>TIPS &amp; HINTS</h4>
        <ul>
          {help.hints.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
