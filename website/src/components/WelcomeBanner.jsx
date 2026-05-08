import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'pursue-welcome-dismissed'

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border-b border-blue-500/20">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-start gap-3">
        <div className="flex-1 text-sm text-slate-300 leading-relaxed">
          <span className="font-bold text-slate-100">Welcome to PURSUE</span> — the most comprehensive public archive of declassified UAP documents. Start by{' '}
          <Link to="/documents" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">reading the key documents</Link>, {' '}
          <Link to="/timeline" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">exploring the timeline</Link>, or {' '}
          <Link to="/disclosure" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">checking the disclosure index</Link> to see how much has been revealed.
        </div>
        <button
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer flex-shrink-0"
          aria-label="Dismiss welcome banner"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
