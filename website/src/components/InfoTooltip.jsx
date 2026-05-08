import { useState, useRef, useEffect } from 'react'

export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-600/60 transition-colors text-[10px] font-bold flex items-center justify-center cursor-help ml-1"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 sm:w-72 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600/50 shadow-xl text-xs text-slate-300 leading-relaxed z-50 pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-r border-b border-slate-600/50 rotate-45 -mt-1" />
        </span>
      )}
    </span>
  )
}
